using System.IO;
using System.Text;
using System.Threading;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Models.Attachment;
using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.Correspondance.Enums;
using Models.DTO.Correspondance.Summer;
using Persistence.Data;
using Persistence.Services;
using Persistence.Services.Notifications;
using Persistence.Services.Summer;
using Xunit;

namespace Persistence.Tests;

public class SummerWorkflowServiceLifecycleTests
{
    public static IEnumerable<object[]> TransferMatrixCases()
    {
        yield return new object[] { false, false, "PENDING_PAYMENT", false, false, MessageStatus.New };
        yield return new object[] { true, false, "PAID", false, true, MessageStatus.InProgress };
        yield return new object[] { true, true, "PENDING_PAYMENT", true, true, MessageStatus.InProgress };
    }

    [Fact]
    public async Task PayAsync_WhenWithinPaymentWindow_SetsPaidFields()
    {
        await using var connectContext = CreateConnectContext();
        await using var attachContext = CreateAttachContext();
        await using var gpaContext = CreateGpaContext();

        SeedSummerCatalog(connectContext);
        SeedCategories(connectContext);
        var messageId = SeedMessage(connectContext, isPaid: false, paymentDueAtUtc: DateTime.UtcNow.AddHours(6));
        await connectContext.SaveChangesAsync();

        var service = CreateService(connectContext, attachContext, gpaContext);

        var response = await service.PayAsync(new SummerPayRequest
        {
            MessageId = messageId,
            PaidAtUtc = DateTimeOffset.UtcNow,
            Notes = "سداد اختبار",
            files = new List<IFormFile> { BuildInMemoryFile("receipt.pdf") }
        }, userId: "emp-1", ip: "127.0.0.1");

        Assert.True(response.IsSuccess);
        Assert.NotNull(response.Data);

        var messageFields = await connectContext.TkmendFields
            .Where(field => field.FildRelted == messageId)
            .ToListAsync();

        Assert.Equal("PAID", GetFieldValue(messageFields, SummerWorkflowDomainConstants.PaymentStatusFieldKind));
        Assert.False(string.IsNullOrWhiteSpace(GetFieldValue(messageFields, SummerWorkflowDomainConstants.PaidAtUtcFieldKind)));
        Assert.Equal("false", GetFieldValue(messageFields, "Summer_TransferRequiresRePayment"));
        Assert.Contains(connectContext.Replies, reply => reply.MessageId == messageId);
        Assert.Contains(attachContext.AttchShipments, attachment => attachment.AttchNm == "receipt.pdf");
    }

    [Fact]
    public async Task PayAsync_WhenOutsidePaymentWindow_ReturnsDueDateError()
    {
        await using var connectContext = CreateConnectContext();
        await using var attachContext = CreateAttachContext();
        await using var gpaContext = CreateGpaContext();

        SeedSummerCatalog(connectContext);
        SeedCategories(connectContext);
        var messageId = SeedMessage(connectContext, isPaid: false, paymentDueAtUtc: DateTime.UtcNow.AddHours(-1));
        await connectContext.SaveChangesAsync();

        var service = CreateService(connectContext, attachContext, gpaContext);
        var response = await service.PayAsync(new SummerPayRequest
        {
            MessageId = messageId,
            PaidAtUtc = DateTimeOffset.UtcNow,
            files = new List<IFormFile> { BuildInMemoryFile("receipt.pdf") }
        }, userId: "emp-1", ip: "127.0.0.1");

        Assert.False(response.IsSuccess);
        Assert.Contains(response.Errors, error => error.Message.Contains("انتهت مهلة السداد", StringComparison.Ordinal));
    }

    [Fact]
    public async Task PayAsync_WhenInstallmentPaidFieldHasDuplicates_UpdatesLatestPersistedRow()
    {
        await using var connectContext = CreateConnectContext();
        await using var attachContext = CreateAttachContext();
        await using var gpaContext = CreateGpaContext();

        SeedSummerCatalog(connectContext);
        SeedCategories(connectContext);
        var messageId = SeedMessage(connectContext, isPaid: false, paymentDueAtUtc: DateTime.UtcNow.AddHours(6));
        AddField(connectContext, 50001, messageId, "Summer_PaymentInstallment1Paid", "false");
        AddField(connectContext, 50002, messageId, "Summer_PaymentInstallment1Paid", "false");
        await connectContext.SaveChangesAsync();

        var service = CreateService(connectContext, attachContext, gpaContext);

        var response = await service.PayAsync(new SummerPayRequest
        {
            MessageId = messageId,
            PaidAtUtc = DateTimeOffset.UtcNow,
            Notes = "سداد اختبار مع تكرار الحقول",
            files = new List<IFormFile> { BuildInMemoryFile("receipt.pdf") }
        }, userId: "emp-1", ip: "127.0.0.1");

        Assert.True(response.IsSuccess);
        Assert.NotNull(response.Data);
        Assert.Equal("PAID", response.Data!.PaymentStateCode);

        var messageFields = await connectContext.TkmendFields
            .Where(field => field.FildRelted == messageId)
            .ToListAsync();

        Assert.Equal("true", GetLatestFieldValueBySql(messageFields, "Summer_PaymentInstallment1Paid"));
    }

    [Fact]
    public async Task AutoCancelExpiredUnpaidRequestsAsync_WhenFirstInstallmentIsMarkedPaid_DoesNotCancelRequest()
    {
        await using var connectContext = CreateConnectContext();
        await using var attachContext = CreateAttachContext();
        await using var gpaContext = CreateGpaContext();

        SeedSummerCatalog(connectContext);
        SeedCategories(connectContext);
        var messageId = SeedMessage(connectContext, isPaid: false, paymentDueAtUtc: DateTime.UtcNow.AddHours(-2));
        AddField(connectContext, 50001, messageId, "Summer_PaymentInstallment1Paid", "false");
        AddField(connectContext, 50002, messageId, "Summer_PaymentInstallment1Paid", "true");
        await connectContext.SaveChangesAsync();

        var service = CreateService(connectContext, attachContext, gpaContext);
        var cancelledCount = await service.AutoCancelExpiredUnpaidRequestsAsync();

        Assert.Equal(0, cancelledCount);

        var updatedMessage = await connectContext.Messages.FirstAsync(item => item.MessageId == messageId);
        Assert.NotEqual(MessageStatus.Rejected, updatedMessage.Status);

        var messageFieldsAfter = await connectContext.TkmendFields
            .Where(field => field.FildRelted == messageId)
            .ToListAsync();
        Assert.NotEqual("CANCELLED_AUTO", GetFieldValue(messageFieldsAfter, SummerWorkflowDomainConstants.PaymentStatusFieldKind));
    }

    [Fact]
    public async Task AutoCancelExpiredUnpaidRequestsAsync_WhenPaymentStatusIsPaid_DoesNotCancelRequest()
    {
        await using var connectContext = CreateConnectContext();
        await using var attachContext = CreateAttachContext();
        await using var gpaContext = CreateGpaContext();

        SeedSummerCatalog(connectContext);
        SeedCategories(connectContext);
        var messageId = SeedMessage(connectContext, isPaid: false, paymentDueAtUtc: DateTime.UtcNow.AddHours(-2));
        AddField(connectContext, 50011, messageId, SummerWorkflowDomainConstants.PaymentStatusFieldKind, "PAID");
        await connectContext.SaveChangesAsync();

        var service = CreateService(connectContext, attachContext, gpaContext);
        var cancelledCount = await service.AutoCancelExpiredUnpaidRequestsAsync();

        Assert.Equal(0, cancelledCount);

        var updatedMessage = await connectContext.Messages.FirstAsync(item => item.MessageId == messageId);
        Assert.NotEqual(MessageStatus.Rejected, updatedMessage.Status);
    }

    [Theory]
    [MemberData(nameof(TransferMatrixCases))]
    public async Task TransferAsync_MatrixCoverage_HandlesPaymentAndReviewFlags(
        bool isPaidBeforeTransfer,
        bool changeFamilyCount,
        string expectedPaymentStatus,
        bool expectedRequiresRePayment,
        bool expectedNeedsReview,
        MessageStatus expectedStatus)
    {
        await using var connectContext = CreateConnectContext();
        await using var attachContext = CreateAttachContext();
        await using var gpaContext = CreateGpaContext();

        SeedSummerCatalog(connectContext);
        SeedCategories(connectContext);
        var messageId = SeedMessage(
            connectContext,
            isPaid: isPaidBeforeTransfer,
            paymentDueAtUtc: DateTime.UtcNow.AddHours(6));
        await connectContext.SaveChangesAsync();

        var service = CreateService(connectContext, attachContext, gpaContext);
        var response = await service.TransferAsync(new SummerTransferRequest
        {
            MessageId = messageId,
            ToCategoryId = 149,
            ToWaveCode = "W08",
            NewFamilyCount = changeFamilyCount ? 3 : 2,
            NewExtraCount = 0,
            Notes = "تحويل اختبار"
        }, userId: "emp-1", ip: "127.0.0.1");

        Assert.True(response.IsSuccess);
        Assert.NotNull(response.Data);
        Assert.Equal(expectedNeedsReview, response.Data!.NeedsTransferReview);

        var message = await connectContext.Messages.FirstAsync(item => item.MessageId == messageId);
        Assert.Equal(149, message.CategoryCd);
        Assert.Equal(expectedStatus, message.Status);

        var messageFields = await connectContext.TkmendFields
            .Where(field => field.FildRelted == messageId)
            .ToListAsync();

        Assert.Equal(expectedPaymentStatus, GetFieldValue(messageFields, SummerWorkflowDomainConstants.PaymentStatusFieldKind));
        var transferRequiresRePaymentToken = GetFieldValue(messageFields, "Summer_TransferRequiresRePayment");
        if (expectedRequiresRePayment)
        {
            Assert.Equal("true", transferRequiresRePaymentToken);
        }
        else
        {
            Assert.True(
                string.IsNullOrWhiteSpace(transferRequiresRePaymentToken)
                || string.Equals(transferRequiresRePaymentToken, "false", StringComparison.OrdinalIgnoreCase));
        }

        Assert.Equal("1", GetFieldValue(messageFields, "Summer_TransferCount"));

        if (expectedRequiresRePayment)
        {
            Assert.Equal(string.Empty, GetFieldValue(messageFields, SummerWorkflowDomainConstants.PaidAtUtcFieldKind));
        }
    }

    [Fact]
    public async Task TransferAsync_WhenRepeated_BlocksSecondTransfer()
    {
        await using var connectContext = CreateConnectContext();
        await using var attachContext = CreateAttachContext();
        await using var gpaContext = CreateGpaContext();

        SeedSummerCatalog(connectContext);
        SeedCategories(connectContext);
        var messageId = SeedMessage(connectContext, isPaid: false, paymentDueAtUtc: DateTime.UtcNow.AddHours(6));
        await connectContext.SaveChangesAsync();

        var service = CreateService(connectContext, attachContext, gpaContext);
        var firstTransfer = await service.TransferAsync(new SummerTransferRequest
        {
            MessageId = messageId,
            ToCategoryId = 149,
            ToWaveCode = "W08",
            NewFamilyCount = 2,
            NewExtraCount = 0
        }, userId: "emp-1", ip: "127.0.0.1");

        Assert.True(firstTransfer.IsSuccess);

        var secondTransfer = await service.TransferAsync(new SummerTransferRequest
        {
            MessageId = messageId,
            ToCategoryId = 148,
            ToWaveCode = "W14",
            NewFamilyCount = 2,
            NewExtraCount = 0
        }, userId: "emp-1", ip: "127.0.0.1");

        Assert.False(secondTransfer.IsSuccess);
        Assert.Contains(secondTransfer.Errors, error => error.Message.Contains("مرة واحدة", StringComparison.Ordinal));
    }

    [Fact]
    public async Task CancelAsync_WhenCalledTwice_BlocksSecondCancellation()
    {
        await using var connectContext = CreateConnectContext();
        await using var attachContext = CreateAttachContext();
        await using var gpaContext = CreateGpaContext();

        SeedSummerCatalog(connectContext);
        SeedCategories(connectContext);
        var messageId = SeedMessage(connectContext, isPaid: false, paymentDueAtUtc: DateTime.UtcNow.AddHours(6));
        await connectContext.SaveChangesAsync();

        var service = CreateService(connectContext, attachContext, gpaContext);
        var firstCancel = await service.CancelAsync(new SummerCancelRequest
        {
            MessageId = messageId,
            Reason = "اعتذار اختبار"
        }, userId: "emp-1", ip: "127.0.0.1");

        Assert.True(firstCancel.IsSuccess);

        var secondCancel = await service.CancelAsync(new SummerCancelRequest
        {
            MessageId = messageId,
            Reason = "تكرار اعتذار"
        }, userId: "emp-1", ip: "127.0.0.1");

        Assert.False(secondCancel.IsSuccess);
        Assert.Contains(secondCancel.Errors, error => error.Message.Contains("اعتذار سابق", StringComparison.Ordinal));

        var updatedMessage = await connectContext.Messages.FirstAsync(item => item.MessageId == messageId);
        Assert.Equal(MessageStatus.Rejected, updatedMessage.Status);

        var messageFields = await connectContext.TkmendFields
            .Where(field => field.FildRelted == messageId)
            .ToListAsync();
        Assert.Equal("CANCELLED", GetFieldValue(messageFields, SummerWorkflowDomainConstants.PaymentStatusFieldKind));
    }

    private static TestableSummerWorkflowService CreateService(
        ConnectContext connectContext,
        Attach_HeldContext attachContext,
        GPAContext gpaContext)
    {
        return new TestableSummerWorkflowService(
            connectContext,
            attachContext,
            gpaContext,
            helperService: null!,
            new NoopNotificationService(),
            Options.Create(new ApplicationConfig()),
            new StaticOptionsMonitor<ResortBookingBlacklistOptions>(new ResortBookingBlacklistOptions()),
            NullLogger<SummerWorkflowService>.Instance);
    }

    private static ConnectContext CreateConnectContext()
    {
        var options = new DbContextOptionsBuilder<ConnectContext>()
            .UseInMemoryDatabase($"summer-workflow-lifecycle-connect-{Guid.NewGuid():N}")
            .ConfigureWarnings(builder => builder.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new ConnectContext(options, new HttpContextAccessor());
    }

    private static Attach_HeldContext CreateAttachContext()
    {
        var options = new DbContextOptionsBuilder<Attach_HeldContext>()
            .UseInMemoryDatabase($"summer-workflow-lifecycle-attach-{Guid.NewGuid():N}")
            .ConfigureWarnings(builder => builder.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new Attach_HeldContext(options);
    }

    private static GPAContext CreateGpaContext()
    {
        var options = new DbContextOptionsBuilder<GPAContext>()
            .UseInMemoryDatabase($"summer-workflow-lifecycle-gpa-{Guid.NewGuid():N}")
            .Options;

        return new GPAContext(options);
    }

    private static void SeedCategories(ConnectContext context)
    {
        context.Cdcategories.AddRange(
            new Cdcategory
            {
                CatId = 148,
                CatParent = 0,
                CatName = "راس البر",
                CatStatus = true,
                CatMend = null,
                CatWorkFlow = 0,
                CatSms = false,
                CatMailNotification = false,
                StampDate = DateTime.UtcNow,
                ApplicationId = SummerWorkflowDomainConstants.DynamicApplicationId,
                Stockholder = 101
            },
            new Cdcategory
            {
                CatId = 149,
                CatParent = 0,
                CatName = "بورفؤاد",
                CatStatus = true,
                CatMend = null,
                CatWorkFlow = 0,
                CatSms = false,
                CatMailNotification = false,
                StampDate = DateTime.UtcNow,
                ApplicationId = SummerWorkflowDomainConstants.DynamicApplicationId,
                Stockholder = 101
            });
    }

    private static void SeedSummerCatalog(ConnectContext context)
    {
        var payload = @"{
  ""seasonYear"": 2026,
  ""destinations"": [
    {
      ""categoryId"": 148,
      ""slug"": ""raselbar"",
      ""name"": ""راس البر"",
      ""maxExtraMembers"": 2,
      ""apartments"": [
        { ""familyCount"": 2, ""apartments"": 5 },
        { ""familyCount"": 4, ""apartments"": 5 }
      ],
      ""waves"": [
        { ""code"": ""W14"", ""startsAtLabel"": ""6/9/2026 - الأحد"" }
      ]
    },
    {
      ""categoryId"": 149,
      ""slug"": ""portfouad"",
      ""name"": ""بورفؤاد"",
      ""maxExtraMembers"": 2,
      ""apartments"": [
        { ""familyCount"": 2, ""apartments"": 5 },
        { ""familyCount"": 3, ""apartments"": 5 }
      ],
      ""waves"": [
        { ""code"": ""W08"", ""startsAtLabel"": ""23/7/2026 - الخميس"" }
      ]
    }
  ]
}";

        context.Cdmends.Add(new Cdmend
        {
            CdmendSql = 990001,
            CdmendType = "Textarea",
            CdmendTxt = SummerWorkflowDomainConstants.DestinationCatalogMend,
            CDMendLbl = "Destination Catalog",
            Placeholder = string.Empty,
            DefaultValue = string.Empty,
            CdmendTbl = payload,
            CdmendDatatype = "json",
            Required = false,
            RequiredTrue = false,
            Email = false,
            Pattern = false,
            MinValue = null,
            MaxValue = null,
            Cdmendmask = null,
            CdmendStat = false,
            Width = 0,
            Height = 0,
            IsDisabledInit = false,
            IsSearchable = false,
            ApplicationId = SummerWorkflowDomainConstants.DynamicApplicationId
        });
    }

    private static int SeedMessage(
        ConnectContext context,
        bool isPaid,
        DateTime paymentDueAtUtc)
    {
        const int messageId = 780001;
        var createdAtUtc = DateTime.UtcNow.AddHours(-2);
        var paidAtUtc = DateTime.UtcNow.AddHours(-1);
        var waveLabel = "الفوج الرابع عشر - الأحد 6/9/2026";

        context.Messages.Add(new Message
        {
            MessageId = messageId,
            CategoryCd = 148,
            Status = MessageStatus.New,
            Priority = Priority.Medium,
            CreatedDate = createdAtUtc,
            CreatedBy = "emp-1",
            RequestRef = "SUM-780001"
        });

        var fieldId = 1000;
        AddField(context, fieldId++, messageId, "Emp_Id", "emp-1");
        AddField(context, fieldId++, messageId, "Emp_Name", "موظف اختبار");
        AddField(context, fieldId++, messageId, "Phone", "01000000000");
        AddField(context, fieldId++, messageId, "SummerSeasonYear", "2026");
        AddField(context, fieldId++, messageId, "SummerCamp", "W14");
        AddField(context, fieldId++, messageId, "SUM2026_WaveCode", "W14");
        AddField(context, fieldId++, messageId, "SummerCampLabel", waveLabel);
        AddField(context, fieldId++, messageId, "SUM2026_WaveLabel", waveLabel);
        AddField(context, fieldId++, messageId, "FamilyCount", "2");
        AddField(context, fieldId++, messageId, "SUM2026_FamilyCount", "2");
        AddField(context, fieldId++, messageId, "Over_Count", "0");
        AddField(context, fieldId++, messageId, "SUM2026_ExtraCount", "0");
        AddField(context, fieldId++, messageId, "SUM2026_DestinationId", "148");
        AddField(context, fieldId++, messageId, "SUM2026_DestinationName", "راس البر");
        AddField(context, fieldId++, messageId, SummerWorkflowDomainConstants.RequestCreatedAtUtcFieldKind, createdAtUtc.ToString("o"));
        AddField(context, fieldId++, messageId, SummerWorkflowDomainConstants.PaymentDueAtUtcFieldKind, paymentDueAtUtc.ToString("o"));
        AddField(context, fieldId++, messageId, SummerWorkflowDomainConstants.PaymentStatusFieldKind, isPaid ? "PAID" : "PENDING_PAYMENT");
        AddField(context, fieldId++, messageId, SummerWorkflowDomainConstants.PaidAtUtcFieldKind, isPaid ? paidAtUtc.ToString("o") : string.Empty);
        AddField(context, fieldId++, messageId, SummerWorkflowDomainConstants.PricingFieldKinds.AccommodationTotal, "1800");
        AddField(context, fieldId++, messageId, SummerWorkflowDomainConstants.PricingFieldKinds.TransportationTotal, "0");
        AddField(context, fieldId++, messageId, SummerWorkflowDomainConstants.PricingFieldKinds.InsuranceAmount, "200");
        AddField(context, fieldId++, messageId, SummerWorkflowDomainConstants.PricingFieldKinds.ProxyInsuranceAmount, "300");
        AddField(context, fieldId++, messageId, SummerWorkflowDomainConstants.PricingFieldKinds.AppliedInsuranceAmount, "200");
        AddField(context, fieldId++, messageId, SummerWorkflowDomainConstants.PricingFieldKinds.GrandTotal, "2000");
        AddField(context, fieldId++, messageId, "SummerProxyMode", "false");
        AddField(context, fieldId++, messageId, "Summer_TransferCount", "0");

        return messageId;
    }

    private static void AddField(ConnectContext context, int fieldSql, int messageId, string kind, string? value)
    {
        context.TkmendFields.Add(new TkmendField
        {
            FildSql = fieldSql,
            FildRelted = messageId,
            FildKind = kind,
            FildTxt = value
        });
    }

    private static string GetFieldValue(IEnumerable<TkmendField> fields, string kind)
    {
        return fields
            .Where(field => string.Equals(field.FildKind, kind, StringComparison.OrdinalIgnoreCase))
            .Select(field => field.FildTxt ?? string.Empty)
            .LastOrDefault() ?? string.Empty;
    }

    private static string GetLatestFieldValueBySql(IEnumerable<TkmendField> fields, string kind)
    {
        return fields
            .Where(field => string.Equals(field.FildKind, kind, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(field => field.FildSql)
            .Select(field => field.FildTxt ?? string.Empty)
            .FirstOrDefault() ?? string.Empty;
    }

    private static IFormFile BuildInMemoryFile(string fileName)
    {
        var payload = Encoding.UTF8.GetBytes("mock file");
        return new InMemoryFormFile(fileName, "application/pdf", payload);
    }

    private sealed class InMemoryFormFile : IFormFile
    {
        private readonly byte[] _payload;

        public InMemoryFormFile(string fileName, string contentType, byte[] payload)
        {
            _payload = payload ?? Array.Empty<byte>();
            FileName = fileName;
            Name = "file";
            ContentType = contentType;
            ContentDisposition = string.Empty;
            Headers = new HeaderDictionary();
            Length = _payload.LongLength;
        }

        public string ContentType { get; }

        public string ContentDisposition { get; }

        public IHeaderDictionary Headers { get; }

        public long Length { get; }

        public string Name { get; }

        public string FileName { get; }

        public Stream OpenReadStream()
        {
            return new MemoryStream(_payload, writable: false);
        }

        public void CopyTo(Stream target)
        {
            using var stream = OpenReadStream();
            stream.CopyTo(target);
        }

        public Task CopyToAsync(Stream target, CancellationToken cancellationToken = default)
        {
            using var stream = OpenReadStream();
            stream.CopyTo(target);
            return Task.CompletedTask;
        }
    }

    private sealed class TestableSummerWorkflowService : SummerWorkflowService
    {
        private int _replySeed = 880000;

        public TestableSummerWorkflowService(
            ConnectContext connectContext,
            Attach_HeldContext attachHeldContext,
            GPAContext gpaContext,
            Persistence.HelperServices.helperService helperService,
            IConnectNotificationService notificationService,
            IOptions<ApplicationConfig> options,
            IOptionsMonitor<ResortBookingBlacklistOptions> resortBookingBlacklistOptions,
            Microsoft.Extensions.Logging.ILogger<SummerWorkflowService> logger)
            : base(
                connectContext,
                attachHeldContext,
                gpaContext,
                helperService,
                notificationService,
                options,
                resortBookingBlacklistOptions,
                logger)
        {
        }

        protected override bool ValidateAttachmentFileSizes<T>(List<IFormFile>? files, CommonResponse<T> response)
        {
            return true;
        }

        protected override Reply CreateReplyEntity(int messageId, string msg, string userId, string parentSectorId, string ip)
        {
            return new Reply
            {
                ReplyId = Interlocked.Increment(ref _replySeed),
                MessageId = messageId,
                Message = msg,
                AuthorId = userId,
                NextResponsibleSectorId = parentSectorId,
                CreatedDate = DateTime.UtcNow,
                Ip = ip
            };
        }

        protected override Task SaveReplyAttachmentsAsync(List<IFormFile> files, int replyId, List<AttchShipment> attachments)
        {
            foreach (var file in files)
            {
                attachments.Add(new AttchShipment
                {
                    AttchId = replyId,
                    AttchNm = file.FileName,
                    AttcExt = Path.GetExtension(file.FileName),
                    AttchSize = file.Length,
                    AttchImg = Array.Empty<byte>()
                });
            }

            return Task.CompletedTask;
        }
    }

    private sealed class NoopNotificationService : IConnectNotificationService
    {
        public string RenderTemplate(string? template, IReadOnlyDictionary<string, string?> placeholders)
            => template ?? string.Empty;

        public Task<CommonResponse<bool>> SendSmsAsync(SmsDispatchRequest request, CancellationToken cancellationToken = default)
            => Task.FromResult(new CommonResponse<bool> { Data = true });

        public Task<CommonResponse<bool>> SendSmsByMultiMessagesAsync(SmsDispatchRequest request, CancellationToken cancellationToken = default)
            => Task.FromResult(new CommonResponse<bool> { Data = true });

        public Task<CommonResponse<bool>> SendSignalRToUserAsync(SignalRDispatchRequest request, CancellationToken cancellationToken = default)
            => Task.FromResult(new CommonResponse<bool> { Data = true });

        public Task<CommonResponse<bool>> SendSignalRToGroupAsync(SignalRGroupDispatchRequest request, CancellationToken cancellationToken = default)
            => Task.FromResult(new CommonResponse<bool> { Data = true });

        public Task<CommonResponse<bool>> SendSignalRToGroupsAsync(SignalRGroupsDispatchRequest request, CancellationToken cancellationToken = default)
            => Task.FromResult(new CommonResponse<bool> { Data = true });

        public Task<CommonResponse<bool>> SendWhatsAppAsync(WhatsAppDispatchRequest request, CancellationToken cancellationToken = default)
            => Task.FromResult(new CommonResponse<bool> { Data = true });

        public Task<CommonResponse<bool>> SendEmailAsync(EmailDispatchRequest request, CancellationToken cancellationToken = default)
            => Task.FromResult(new CommonResponse<bool> { Data = true });
    }

    private sealed class StaticOptionsMonitor<T> : IOptionsMonitor<T>
    {
        private sealed class NoopDisposable : IDisposable
        {
            public void Dispose()
            {
            }
        }

        public StaticOptionsMonitor(T value)
        {
            CurrentValue = value;
        }

        public T CurrentValue { get; }

        public T Get(string? name) => CurrentValue;

        public IDisposable OnChange(Action<T, string?> listener) => new NoopDisposable();
    }
}
