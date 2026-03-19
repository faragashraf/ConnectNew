using AutoMapper;
using ENPO.CreateLogFile;
using ENPO.Dto.Utilities;
using ExcelDataReader;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Models.DTO;
using Models.DTO.Common;
using Models.GPA;
using Models.GPA.LTRA;
using Oracle.ManagedDataAccess.Client;
using Persistence.Data;
using Persistence.UnitOfWorks;
using System.Data;
using System.Globalization;
using System.Reflection;
using System.Text;

namespace Persistence.Repositories
{
    public class landTransportRepository : ILandTransport
    {
        private readonly ENPOCreateLogFile _logger;
        ApplicationConfig _options;
        private readonly IConfiguration _config;
        private IMapper _mapper;
        private readonly GPAContext _gPAContext;

        public landTransportRepository(GPAContext gPAContext, IMapper mapper, IOptions<ApplicationConfig> options)
        {
            _gPAContext = gPAContext;
            _mapper = mapper;
            _options = options.Value;
            _logger = new ENPOCreateLogFile("C:\\Connect_Log", "landTransport_Log" + DateTime.Today.ToString("dd-MMM-yyyy"), FileExtension.txt);

        }
        public CommonResponse<IEnumerable<VwLtraTransTraficPrint>> GetTransportationRequestsToPrint(int pageNumber, int pageSize)
        {
            var res = new CommonResponse<IEnumerable<VwLtraTransTraficPrint>>();

            try
            {
                res.Data = _gPAContext.VwLtraTransTraficPrints.Where(x => !x.IsPrint).ToList();
            }
            catch (Exception ex)
            {
                res.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }
            return res;
        }
        public CommonResponse<string> UpdateRequestToPrintStatus(string barcode, string plateNumber, string userId)
        {
            var res = new CommonResponse<string>();

            try
            {
                var _ltraRegistration = _gPAContext.LtraRegistrations.Where(x => x.Barcode == barcode && x.PlateNumber == plateNumber).FirstOrDefault();

                if (_ltraRegistration == null)
                {
                    res.Errors.Add(new Error { Code = "-1", Message = "لم يتم العثور على الطلب" });
                    return res;
                }


                _ltraRegistration.IsPrint = true;


                var track = new Tracking
                {
                    CreatedBy = userId,
                    CreationDate = DateTime.Now,
                    FileName = "",
                    PostType = "",
                    ServiceType = "LtraRegistrations",
                    TableName = "LtraRegistrations",
                    TransId = barcode,
                    Description = "Update IsPrint feild as printed Letter"

                };
                _gPAContext.Tracking.Add(track);


                var res_Create_Pr = Create_RLTT_Item(barcode, plateNumber, userId);

                if (res_Create_Pr.IsSuccess && !res_Create_Pr.Data.Equals("0"))
                {
                    res.Data += Environment.NewLine + $"تم إنشاء شحنة للرخصة رقم {plateNumber} برقم {res_Create_Pr.Data}";
                    _gPAContext.SaveChanges();
                }
                else
                {
                    res_Create_Pr.Errors.ToList().ForEach(err =>
                    {
                        res.Errors.Add(err);
                    });
                }
            }
            catch (Exception ex)
            {
                res.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }
            return res;
        }
        public CommonResponse<List<VwLtraTransTraficPrint>> GetLLTR_request(string barcode)
        {
            var res = new CommonResponse<List<VwLtraTransTraficPrint>>();

            try
            {
                var _ltraRegistration = _gPAContext.VwLtraTransTraficPrints
                    .Where(x => (x.Barcode.ToUpper() == barcode.ToUpper() || x.RlttBarcode.ToUpper() == barcode.ToUpper()) 
           //         && x.PlateNumber == plateNumber
                    )
                    .ToList();
                if (_ltraRegistration != null)
                {
                    res.Data = _ltraRegistration;
                }

            }
            catch (Exception ex)
            {
                res.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }
            return res;
        }
        public async Task<CommonResponse<string>> UploadData(IFormFile file, string userId, string ip)
        {
            var commonResponse = new CommonResponse<string>();
            commonResponse.Errors = new List<Error>();
            var folderName = Path.Combine(@"uploads\LtraRegistration\", userId + "-" + DateTime.Now.Year + DateTime.Now.Millisecond + "_" + ip.Replace(".", "-") + file.FileName);

            try
            {
                //string tempFilePath = Path.Combine(Path.GetTempPath(), Path.GetRandomFileName()); // Generate a unique temp file name         
                Stream fileStream = new FileStream(folderName, FileMode.CreateNew);
                await file.CopyToAsync(fileStream);
                fileStream.Close();

                var _registrationList = retrieveExcel(folderName, commonResponse);
                List<string> _predefinedColums = _options.ApiOptions.LtraExcelColumns;
                var ListValidationResult = ValidateAndFilterExcelColumns(_registrationList, _predefinedColums, commonResponse);
                var filteredRegistrations = MapToLtraRegistrations(ListValidationResult);

                if (!commonResponse.IsSuccess)
                    return commonResponse;
                var lastList = await ValidateLtraRegistration(filteredRegistrations, commonResponse, userId, ip);
                if (commonResponse.IsSuccess)
                {
                    await _gPAContext.LtraRegistrations.AddRangeAsync(lastList);
                    await _gPAContext.SaveChangesAsync();
                    foreach (var item in _registrationList)
                    {
                        var res_Pr = await Event_135_Pr(item.Barcode);

                        if (res_Pr.IsSuccess && res_Pr.Data.Equals("Event Created Successfully", StringComparison.CurrentCultureIgnoreCase))
                        {
                            var smsMessage = "";

                            if (!item.ReplyRequestStatus.Equals("Accept"))
                            {
                                smsMessage = _options.ApiOptions.EventSMSARejected;
                            }
                            else
                            {
                                smsMessage = string.Format(_options.ApiOptions.EventSMSAccepted, item.OfficeAName);
                            }

                            var _smsResponse = ENPO.Notifications.ENPONotifications.EnqueueSms(new ENPO.Dto.Notifications.SmsSendQueue
                            {
                                Message = smsMessage,
                                MobileNumber = item.PhoneNumber,
                                ServiceName = "LTRA EVENT 135",
                                ReferenceNo = item.CompanyName,
                                UserId = userId,
                                Status = 0
                            },_gPAContext.Database.GetConnectionString()!);

                            if (!_smsResponse.IsSuccess)
                            {
                                foreach (var err in _smsResponse.Errors)
                                {
                                    commonResponse.Errors.Add(new Error { Code = err.Code, Message = err.Message });
                                }
                            }
                        }
                        else
                        {
                            res_Pr.Errors.ToList().ForEach(err =>
                            {
                                commonResponse.Errors.Add(err);
                            });

                            return commonResponse;
                        }
                    }
                    commonResponse.Data = "تم إضافة عدد " + _registrationList.Count() + " بيان بنجاح";

                }
                else
                {
                    return commonResponse;
                }
            }
            catch (Exception ex)
            {
                commonResponse.Errors.Add(new Error
                {
                    Code = "-1",
                    Message = ex.Message 
                });
            }
            return commonResponse;
        }

        private List<LtraRegistrationDto> retrieveExcel(string fileStream, CommonResponse<string> commonResponse)
        {
            List<LtraRegistrationDto> registrationList = new List<LtraRegistrationDto>();
            try
            {
                Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
                var stream = File.Open(fileStream, FileMode.Open, FileAccess.Read);
                var reader = ExcelReaderFactory.CreateReader(stream);
                var result = reader.AsDataSet();
                var tables = result.Tables.Cast<DataTable>();
                var _table = tables.First();
                stream.Close();
                // Preprocess column-to-property mappings
                var headerRow = _table.Rows[0];
                var columnMappings = new List<(int ColumnIndex, PropertyInfo Property)>();

                for (int col = 0; col < _table.Columns.Count; col++)
                {
                    string columnName = headerRow[col].ToString().Trim().Replace("_", "");
                    var prop = typeof(LtraRegistrationDto).GetProperty(columnName,
                        BindingFlags.IgnoreCase | BindingFlags.Public | BindingFlags.Instance);
                    if (prop != null)
                    {
                        columnMappings.Add((col, prop));
                    }
                }
                // Process data rows starting from index 2 (adjust as needed)
                for (int i = 2; i < _table.Rows.Count; i++)
                {
                    var item = new LtraRegistrationDto();
                    DataRow row = _table.Rows[i];

                    foreach (var (colIndex, prop) in columnMappings)
                    {
                        object value = row[colIndex];

                        if (value == DBNull.Value)
                            value = null;

                        Type propType = prop.PropertyType;
                        Type targetType = Nullable.GetUnderlyingType(propType) ?? propType;

                        try
                        {
                            if (value != null)
                            {
                                if (value.GetType() != targetType)
                                    value = Convert.ChangeType(value, targetType);
                            }

                            prop.SetValue(item, value);
                        }
                        catch
                        {
                            // Handle conversion errors (e.g., log, skip invalid data)
                        }
                    }
                    registrationList.Add(item);
                    // Use 'item' here (e.g., add to a list)
                }
            }
            catch (Exception ex)
            {
                commonResponse.Errors.Add(new Error
                {
                    Code = "-1",
                    Message = ex.Message + ex.InnerException?.Message.ToString()
                });
            }
            return registrationList;
        }
        private async Task<List<LtraRegistration>> ValidateLtraRegistration(List<LtraRegistration> ltraRegistrations, CommonResponse<string> commonResponse, string userId, string ip)
        {
            List<LtraRegistration> ltraRegistrationsNew = new List<LtraRegistration>();

            var plateNumbers = ltraRegistrations.Select(r => r.PlateNumber).ToList();
            var barcodes = ltraRegistrations.Select(r => r.Barcode).ToList();

            var _domainObject = await _gPAContext.LtraRegistrations
                .Where(r => plateNumbers.Contains(r.PlateNumber) && barcodes.Contains(r.Barcode))
                .ToListAsync();


            if (_domainObject.Any())
            {
                _domainObject.ForEach(async item =>
                {
                    commonResponse.Errors.Add(new Error
                    {
                        Code = "-1",
                        Message = $"تم إضافة البيان من قبل للرخصة رقم {item.PlateNumber}"
                    });
                });
                return _domainObject;
            }
            ltraRegistrations.ForEach(item =>
           {
               if (!ValidateReplyStatus(item.ReplyStatus))
               {
                   commonResponse.Data = "";
                   commonResponse.Errors.Add(new Error
                   {
                       Code = "-1",
                       Message = $"خطأ في حالة طلب السيارة للرخصة رقم {item.PlateNumber} {Environment.NewLine}   {item.ReplyStatus} : نص الحالة"
                   });
               }
               if (!ValidateReplyStatus(item.ReplyRequestStatus))
               {
                   commonResponse.Errors.Add(new Error
                   {
                       Code = "-1",
                       Message = $"خطأ في حالة طلب رخصة المزاولة للرخصة رقم {item.PlateNumber} {Environment.NewLine}  {item.ReplyRequestStatus} : نص الحالة"
                   });
               }

               var toDate = DateTime.ParseExact(item.ReplyLicenseTo, "dd-MM-yyyy", CultureInfo.InvariantCulture);
               var fromDate = DateTime.ParseExact(item.ReplyLicenseFrom, "dd-MM-yyyy", CultureInfo.InvariantCulture);

               if (toDate < fromDate)
               {
                   commonResponse.Data = "";
                   commonResponse.Errors.Add(new Error
                   {
                       Code = "-1",
                       Message = $"تاريخ انتهاء الرخصة قبل تاريخ بداية الترخيص للرخصة رقم {item.PlateNumber}"
                   });
               }

               item.ClientIp = ip;
               item.CreatedBy = userId;
               ltraRegistrationsNew.Add(item);
           });
            return ltraRegistrationsNew;
        }
        public bool IsValidDate(object value)
        {
            if (value == null)
                return false;

            // Check if it's already a DateTime
            if (value is DateTime)
                return true;

            // Check if it's a parseable string


            // Attempt conversion for other types (e.g., numbers, etc.)
            try
            {
                if (value is string str)
                {
                    DateTime result;
                    return DateTime.TryParse(
                        str,
                        CultureInfo.InvariantCulture,
                        DateTimeStyles.None,
                        out result
                    );
                }
                // Try converting using Convert.ToDateTime
                var convertedDate = Convert.ToDateTime(value, CultureInfo.InvariantCulture);
                return true;
            }
            catch (Exception ex)
            {
                // Final fallback: try converting to string and parsing
                DateTime result;
                return DateTime.TryParse(
                    value.ToString(),
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.None,
                    out result
                );
            }
        }
        private bool ValidateReplyStatus(string stateValue)
        {
            bool _result = false;
            if (stateValue is null)
            {
                _result = false;
            }
            else if (stateValue.Equals("Accept", StringComparison.CurrentCultureIgnoreCase) ||
                    stateValue.Equals("Reject", StringComparison.CurrentCultureIgnoreCase))
            {
                _result = true;
            }
            else
            {
                _result = true;
            }
            return _result;
        }
        private List<LtraRegistration> MapToLtraRegistrations(List<Dictionary<string, object>> filteredData)
        {
            var result = new List<LtraRegistration>();
            var props = typeof(LtraRegistration).GetProperties(BindingFlags.Public | BindingFlags.Instance);

            foreach (var dict in filteredData)
            {
                var instance = new LtraRegistration();

                foreach (var kvp in dict)
                {
                    var prop = props.FirstOrDefault(p =>
                        p.Name.Equals(kvp.Key, StringComparison.OrdinalIgnoreCase));

                    if (prop != null && prop.CanWrite && kvp.Value != null)
                    {
                        try
                        {
                            object? value = Convert.ChangeType(kvp.Value, Nullable.GetUnderlyingType(prop.PropertyType) ?? prop.PropertyType);
                            prop.SetValue(instance, value);
                        }
                        catch
                        {
                            // Optional: log conversion issues
                        }
                    }
                }

                result.Add(instance);
            }

            return result;
        }
        private async Task<CommonResponse<string>> Event_135_Pr(string Barcode)
        {
            var response = new CommonResponse<string>();
            response.Errors = new List<Error>();
            int arg_n_return = 0;
            string arg_v_message = "";
            try
            {
                var param = new List<OracleParameter>();
                param.Add(new OracleParameter("V_BARCODE", OracleDbType.NVarchar2, Barcode, ParameterDirection.Input));
                param.Add(new OracleParameter("V_OUT", OracleDbType.Int32, arg_n_return, ParameterDirection.Output));
                param.Add(new OracleParameter("V_OUT_RESPONSE_MESSAGE", OracleDbType.NVarchar2, 8000, arg_v_message, ParameterDirection.Output));

                string sql;
                sql = "BEGIN mail_user.PROC_CREATE_EVENT_RLTT_135(:V_BARCODE,:V_OUT,:V_OUT_RESPONSE_MESSAGE);END;";//:SCT,:IMT,:PAY_WAY,
                var items = await _gPAContext.Database.ExecuteSqlRawAsync(sql, param.ToArray());
                //arg_n_return = Convert.ToInt32(param[1].Value ?? 0); // Handle NULL
                arg_v_message = param[2].Value?.ToString() ?? "";
                response.Data = arg_v_message;
            }
            catch (Exception ex)
            {
                response.Errors.Add(new Error
                {
                    Code = "ex",
                    Message = ex.Message
                });
            }
            return response;
        }
        private CommonResponse<string> Create_RLTT_Item(string Barcode, string plateNo, string user)
        {
            var response = new CommonResponse<string>();
            response.Errors = new List<Error>();
            int arg_n_return = 0;
            string arg_v_message = "";
            try
            {
                var param = new List<OracleParameter>();
                param.Add(new OracleParameter("V_PLATE_NUMBER", OracleDbType.NVarchar2, 1000, plateNo, ParameterDirection.Input));
                param.Add(new OracleParameter("V_BARCODE", OracleDbType.NVarchar2, 1000, Barcode, ParameterDirection.Input));
                param.Add(new OracleParameter("V_USERCODE", OracleDbType.NVarchar2, 1000, user, ParameterDirection.Input));
                param.Add(new OracleParameter("V_OUT", OracleDbType.NVarchar2, 4000, arg_v_message, ParameterDirection.Output));

                string sql;
                sql = "BEGIN mail_user.PROC_CREATE_RLTT_BARCODE(:V_PLATE_NUMBER,:V_BARCODE,:V_USERCODE,:V_OUT);END;";//:SCT,:IMT,:PAY_WAY,

                var items = _gPAContext.Database.ExecuteSqlRaw(sql, param.ToArray());
                arg_v_message = param[3].Value?.ToString() ?? "";
                if (arg_v_message.Equals("0"))
                {
                    response.Errors.Add(new Error
                    {
                        Code = "ex",
                        Message = "هناك خطأ في إنشاء الباركود الجديد"
                    });
                }
                else
                {
                    response.Data = arg_v_message;
                }
            }
            catch (Exception ex)
            {
                response.Errors.Add(new Error
                {
                    Code = "ex",
                    Message = ex.Message
                });
            }
            return response;
        }
        private bool ValidateExcelColumns(List<LtraRegistration> registrations, List<string> expectedColumns, CommonResponse<string> commonResponse)
        {
            try
            {
                if (registrations == null || !registrations.Any())
                {
                    commonResponse.Errors.Add(new Error
                    {
                        Code = "-1",
                        Message = "قائمة التسجيلات فارغة أو غير صالحة."
                    });
                    return false;
                }

                var actualColumns = typeof(LtraRegistration).GetProperties()
                    .Select(prop => prop.Name)
                    .ToList();

                foreach (var expectedColumn in expectedColumns)
                {
                    if (!actualColumns.Any(column => column.Equals(expectedColumn, StringComparison.OrdinalIgnoreCase)))
                    {
                        commonResponse.Errors.Add(new Error
                        {
                            Code = "-1",
                            Message = $"العمود المطلوب مفقود: {expectedColumn}"
                        });
                        return false;
                    }
                }

                if (actualColumns.Count != expectedColumns.Count())
                {
                    commonResponse.Errors.Add(new Error
                    {
                        Code = "-1",
                        Message = "عدد الأعمدة في قائمة التسجيلات لا يتطابق مع العدد المتوقع."
                    });
                    return false;
                }

                return true;
            }
            catch (Exception ex)
            {
                commonResponse.Errors.Add(new Error
                {
                    Code = "-1",
                    Message = $"حدث خطأ أثناء التحقق من صحة قائمة التسجيلات: {ex.Message}"
                });
                return false;
            }
        }

        private List<Dictionary<string, object>> ValidateAndFilterExcelColumns(List<LtraRegistrationDto> registrations, List<string> expectedColumns, CommonResponse<string> commonResponse)
        {
            var result = new List<Dictionary<string, object>>();

            try
            {
                if (registrations == null || !registrations.Any())
                {
                    commonResponse.Errors.Add(new Error
                    {
                        Code = "-1",
                        Message = "قائمة التسجيلات فارغة أو غير صالحة."
                    });
                    return result;
                }

                var properties = typeof(LtraRegistrationDto).GetProperties(BindingFlags.Public | BindingFlags.Instance);

                var actualColumnNames = properties.Select(p => p.Name).ToList();

                //// Check if any expected column is missing in the class
                //foreach (var expectedColumn in expectedColumns)
                //{
                //    if (!actualColumnNames.Any(name => name.Equals(expectedColumn, StringComparison.OrdinalIgnoreCase)))
                //    {
                //        commonResponse.Errors.Add(new Error
                //        {
                //            Code = "-1",
                //            Message = $"العمود المطلوب مفقود: {expectedColumn}"
                //        });
                //        return result;
                //    }
                //}

                // Filter each registration to only include expected columns
                foreach (var reg in registrations)
                {
                    var dict = new Dictionary<string, object>();

                    foreach (var col in expectedColumns)
                    {
                        var prop = properties.FirstOrDefault(p => p.Name.Equals(col, StringComparison.OrdinalIgnoreCase));
                        if (prop != null)
                        {
                            dict[col] = prop.GetValue(reg);
                        }
                    }

                    result.Add(dict);
                }

                return result;
            }
            catch (Exception ex)
            {
                commonResponse.Errors.Add(new Error
                {
                    Code = "-1",
                    Message = $"حدث خطأ أثناء التحقق من الأعمدة وتصفية البيانات: {ex.Message}"
                });
                return result;
            }
        }




    }

}