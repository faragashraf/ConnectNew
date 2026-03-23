using AutoMapper;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Models.Attachment;
using Models.DTO;
using Models.DTO.Common;
using Persistence.Data;
using Repositories;
using System.Data.SqlClient;

namespace Persistence.Repositories
{
    public class AttachMentsRepositories : IAttachMentsRepositories
    {
        private readonly ApplicationConfig _option;
        Attach_HeldContext _attach_HeldContext;
        ConnectContext _context;
        private IMapper _mapper;
        public AttachMentsRepositories(Attach_HeldContext attach_HeldContext, ConnectContext context, IOptions<ApplicationConfig> option, IMapper mapper)
        {
            _attach_HeldContext = attach_HeldContext;
            _option = option.Value;
            _context = context;
            _mapper = mapper;
        }
        public async Task<CommonResponse<string>> papperRecieve(string id, IFormFile file, string usr, string ip)
        {
            var commonResponse = new CommonResponse<string>();
            commonResponse.Errors = new List<Error>();

            if (file.Length > _option.ApiOptions.fileMaxSize)
            {
                commonResponse.Errors.Add(new Error
                {
                    Code = "-1",
                    Message = $"حجم المستند اكبر من {_option.ApiOptions.fileMaxSize / 1024 / 1024} ميجا بايت" + Environment.NewLine + "يرجى تقليل مساحة الملف وإعادة المحاولة"
                });
                return commonResponse;
            }

            AttchShipment attchShipment = new AttchShipment();
            using (var modelTransaction = _context.Database.BeginTransaction())
            using (var attachHeldTransaction = _attach_HeldContext.Database.BeginTransaction())
            {
                try
                {
                    //  Oracle DbContext Transaction 
                    var held = _context.Messages.Where(r => r.MessageId == Convert.ToInt32(id)).SingleOrDefault();
                    if (held == null)
                    {
                        commonResponse.Errors.Add(new Error
                        {
                            Code = "-1",
                            Message = "لم يتم العثور على الطلب"
                        });
                    }
                    //int EventSql = GetSequenceNextValue("Seq_Events");
                    //TkEvent vwMailItemHeldEvent = new TkEvent
                    //{
                    //    TkupSql = EventSql,
                    //    TkupTkSql = held.MessageId,
                    //    TkupEvtId = 6,
                    //    TkupTxt = "تم تسجيل استلام الأوراق",
                    //    TkupUser = usr,
                    //    TkupUserIp = ip,
                    //};

                    //await _context.TkEvents.AddAsync(vwMailItemHeldEvent);
                    await _context.SaveChangesAsync();
                    //  Sql DbContext Transaction 
                    using (var memoryStream = new MemoryStream())
                    {
                        await file.CopyToAsync(memoryStream);

                        attchShipment.AttchId = held.MessageId;
                        attchShipment.AttchNm = file.FileName;
                        attchShipment.AttchImg = memoryStream.ToArray();
                        attchShipment.AttchSize = file.Length;
                        attchShipment.AttcExt = Path.GetExtension(file.FileName);
                    }
                    await _attach_HeldContext.AttchShipments.AddAsync(attchShipment);
                    await _attach_HeldContext.SaveChangesAsync();

                    // If everything went well, commit transactions
                    modelTransaction.Commit();
                    attachHeldTransaction.Commit();
                    commonResponse.Data = "تم استلام الأوراق بنجاح";
                }
                catch (Exception ex)
                {
                    // If an error occurred, roll back both transactions
                    attachHeldTransaction.Rollback();
                    modelTransaction.Rollback();
                    commonResponse.Errors.Add(new Error
                    {
                        Code = "-1",
                        Message = ex.Message
                    });
                }
            }
            return commonResponse;
        }
        public async Task<CommonResponse<IEnumerable<AttchShipmentDto>>> getShipmentAttachment(List<int> ids)
        {
            var res = new CommonResponse<IEnumerable<AttchShipmentDto>>();
            try
            {
                var _ittachments = await _attach_HeldContext.AttchShipments.Where(x => ids.Contains(x.AttchId ) && x.ApplicationName == "Correspondance").ToArrayAsync();
                res.Data = _mapper.Map<List<AttchShipmentDto>>(_ittachments);
            }
            catch (Exception ex)
            {
                res.Errors.Add(new Error
                {
                    Code = "-1",
                    Message = ex.Message
                });
            }
            return res;
        }

        public async Task<CommonResponse<byte[]>> DownloadDocument(int id)
        {
            var res = new CommonResponse<byte[]>();
            var _ittachments = await _attach_HeldContext.AttchShipments.Where(x => x.Id == id && x.ApplicationName == "Connect" || x.ApplicationName == "Connect - Test").FirstOrDefaultAsync();
            if (_ittachments == null)
            {
                res.Errors.Add(new Error
                {
                    Code = "-1",
                    Message = "لم يتم العثور على المستند"
                });
                return res;
            }
            else
                res.Data = _ittachments.AttchImg;
            return res;
        }
        private int GetSequenceNextValue(string SeqName)
        {
            using (SqlConnection connection = new SqlConnection(_context.Database.GetConnectionString()))
            {
                connection.Open();
                using (SqlCommand command = new SqlCommand($"SELECT NEXT VALUE FOR {SeqName}", connection))
                {
                    object result = command.ExecuteScalar();
                    return Convert.ToInt32(result);
                }
            }
        }
    }
}