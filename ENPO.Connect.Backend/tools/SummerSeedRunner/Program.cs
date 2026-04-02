using System.Globalization;
using System.Reflection;
using System.Text.Encodings.Web;
using System.Text.Json;
using AutoMapper;
using ENPO.CreateLogFile;
using ENPO.Dto.Utilities;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Models.AutoMapping;
using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.Correspondance;
using Models.DTO.Correspondance.Enums;
using Models.DTO.Correspondance.Summer;
using Persistence.Data;
using Persistence.HelperServices;
using Persistence.Services;
using Persistence.Services.Notifications;
using Persistence.Services.Summer;

var options = SeedRunnerOptions.Parse(args);
var prettyJsonOptions = new JsonSerializerOptions
{
    WriteIndented = true,
    Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
};

var repoRoot = ResolveRepoRoot();
var apiDir = Path.Combine(repoRoot, "ENPO.Connect.Backend", "Api");
var reportsDir = Path.Combine(repoRoot, "ENPO.Connect.Backend", "tools", "SummerSeedRunner", "reports");
Directory.CreateDirectory(reportsDir);

var configuration = new ConfigurationBuilder()
    .SetBasePath(apiDir)
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: false)
    .AddJsonFile("appsettings.Development.json", optional: true, reloadOnChange: false)
    .Build();

var connectCs = configuration.GetConnectionString("ConnectConnectingString")
               ?? throw new InvalidOperationException("ConnectionStrings:ConnectConnectingString is missing.");
var attachCs = configuration.GetConnectionString("HeldAttach")
               ?? throw new InvalidOperationException("ConnectionStrings:HeldAttach is missing.");

var appConfig = configuration.GetSection("ApplicationConfig").Get<ApplicationConfig>() ?? new ApplicationConfig();
var blacklistOptions = configuration.GetSection(ResortBookingBlacklistOptions.SectionName).Get<ResortBookingBlacklistOptions>()
                      ?? new ResortBookingBlacklistOptions();
var blacklistMonitor = new StaticOptionsMonitor<ResortBookingBlacklistOptions>(blacklistOptions);

var mapper = new MapperConfiguration(cfg => cfg.AddProfile<MappingProfile>()).CreateMapper();
var connectOptions = new DbContextOptionsBuilder<ConnectContext>()
    .UseSqlServer(connectCs, sql =>
    {
        sql.MigrationsAssembly(typeof(ConnectContext).Assembly.GetName().Name);
        sql.CommandTimeout(300);
    })
    .Options;
var attachOptions = new DbContextOptionsBuilder<Attach_HeldContext>()
    .UseSqlServer(attachCs, sql => sql.CommandTimeout(300))
    .Options;
var gpaOptions = new DbContextOptionsBuilder<GPAContext>()
    .UseInMemoryDatabase("SummerSeedRunner_GPA")
    .Options;

await using var connectContext = new ConnectContext(connectOptions, new HttpContextAccessor());
await using var attachContext = new Attach_HeldContext(attachOptions);
await using var gpaContext = new GPAContext(gpaOptions);

var runId = DateTime.UtcNow.ToString("yyyyMMdd_HHmmss", CultureInfo.InvariantCulture);
var backupPath = Path.Combine(reportsDir, $"phase1-backup-{runId}.json");
var reportPath = string.IsNullOrWhiteSpace(options.ReportPath)
    ? Path.Combine(reportsDir, $"phase1-report-{runId}.json")
    : Path.GetFullPath(options.ReportPath);

var reviewSnapshot = await BuildReviewSnapshotAsync(connectContext);

var summerCategoryIds = reviewSnapshot.SummerCategories
    .Select(item => item.CategoryId)
    .ToHashSet();

if (summerCategoryIds.Count == 0)
{
    throw new InvalidOperationException("No summer categories were discovered in the target database.");
}

var beforeCounts = await CaptureSummerCountsAsync(connectContext, attachContext, summerCategoryIds);
var preDeleteMessageIds = await connectContext.Messages
    .AsNoTracking()
    .Where(message => summerCategoryIds.Contains(message.CategoryCd))
    .Select(message => message.MessageId)
    .OrderBy(messageId => messageId)
    .ToListAsync();

var preDeleteOwnerPool = await BuildOwnerPoolFromExistingSummerRequestsAsync(connectContext, preDeleteMessageIds);

var backupSnapshot = new
{
    GeneratedAtUtc = DateTime.UtcNow,
    SeedOptions = options,
    SummerCategoryIds = summerCategoryIds,
    Review = reviewSnapshot,
    BeforeCounts = beforeCounts,
    SummerMessageIds = preDeleteMessageIds,
    ExistingOwnerPoolSize = preDeleteOwnerPool.Count
};

await File.WriteAllTextAsync(
    backupPath,
    JsonSerializer.Serialize(backupSnapshot, prettyJsonOptions));

if (options.DryRun)
{
    Console.WriteLine("[DRY-RUN] Snapshot created. No delete/generate actions were executed.");
    Console.WriteLine($"Backup snapshot: {backupPath}");
    return;
}

if (options.WipeExistingFirst)
{
    await DeleteExistingSummerRequestsAsync(connectContext, attachContext, preDeleteMessageIds);
}

var afterDeleteCounts = await CaptureSummerCountsAsync(connectContext, attachContext, summerCategoryIds);
var postDeleteOrphans = await CaptureOrphanChecksAsync(connectContext, summerCategoryIds);

var destinationCatalog = await LoadDestinationCatalogAsync(connectContext, options.SeasonYear);
var catalogByCategory = destinationCatalog
    .GroupBy(destination => destination.CategoryId)
    .Select(group => group.First())
    .ToDictionary(destination => destination.CategoryId, destination => destination);

var destinationWeights = ResolveDestinationWeights(options, catalogByCategory.Values.ToList());
var capacityRules = LoadSummerCapacityRulesFromHandler();
var summerPricingService = new SummerPricingService(connectContext);
var summerUnitFreezeService = new SummerUnitFreezeService(connectContext);
var publicSlotCapacities = await BuildPublicSlotCapacitiesAsync(
    connectContext,
    summerPricingService,
    options,
    catalogByCategory,
    capacityRules);
var planningResult = BuildRequestPlan(
    options,
    catalogByCategory,
    destinationWeights,
    publicSlotCapacities);

var blacklistService = new SummerBookingBlacklistService(blacklistMonitor);
var ownerPool = BuildFinalOwnerPool(
    preDeleteOwnerPool,
    options.TotalRequests,
    options.RandomSeed,
    blacklistService);

var logger = new ENPOCreateLogFile(
    "/tmp/connect_seed_logs",
    $"SummerSeedRunner_{runId}",
    FileExtension.txt);

var helper = new helperService(
    gpaContext,
    connectContext,
    attachContext,
    appConfig,
    logger,
    mapper,
    null!);

var messageRequestService = new MessageRequestService(
    connectContext,
    attachContext,
    gpaContext,
    helper,
    mapper,
    logger);

var notificationService = new NoopNotificationService();

var handler = new HandleEmployeeCategories(
    connectContext,
    attachContext,
    gpaContext,
    helper,
    mapper,
    logger,
    messageRequestService,
    notificationService,
    summerPricingService,
    blacklistService,
    summerUnitFreezeService);

var runtimeOptions = new SummerRequestRuntimeOptions
{
    SuppressNotifications = true,
    SkipResponseHydration = true
};

var random = new Random(options.RandomSeed);
var createdMessageIds = new List<int>(options.TotalRequests);
var seedErrors = new List<string>();

for (var index = 0; index < planningResult.Assignments.Count; index += 1)
{
    var assignment = planningResult.Assignments[index];
    var owner = ownerPool[index];

    var destination = catalogByCategory[assignment.CategoryId];
    var wave = destination.Waves.First(item => string.Equals(item.Code, assignment.WaveCode, StringComparison.OrdinalIgnoreCase));
    var stayMode = ResolveStayMode(destination, random);
    var proxy = random.NextDouble() < options.ProxyRatio;
    var extraCount = ResolveExtraCount(destination.MaxExtraMembers, random);

    var messageRequest = BuildMessageRequest(
        options,
        index,
        destination,
        wave,
        assignment.FamilyCount,
        extraCount,
        stayMode,
        proxy,
        owner,
        random);

    var response = new CommonResponse<MessageDto>();
    var categoryInfo = helper.GetType(destination.CategoryId);
    if (categoryInfo == null)
    {
        throw new InvalidOperationException($"Category '{destination.CategoryId}' cannot be resolved from CDCategory.");
    }

    await handler.SummerRequests(
        messageRequest,
        categoryInfo,
        response,
        owner.FileNumber,
        runtimeOptions);

    if (!response.IsSuccess)
    {
        var errorText = string.Join(" | ", response.Errors.Select(error => $"{error.Code}:{error.Message}"));
        seedErrors.Add($"Request #{index + 1} failed ({destination.CategoryId}/{assignment.WaveCode}/{assignment.FamilyCount}, owner={owner.FileNumber}): {errorText}");
        continue;
    }

    var createdMessageId = response.Data?.MessageId
        ?? messageRequest.MessageId
        ?? 0;

    if (createdMessageId <= 0)
    {
        seedErrors.Add($"Request #{index + 1} returned success without a message id.");
        continue;
    }

    createdMessageIds.Add(createdMessageId);
}

if (createdMessageIds.Count != options.TotalRequests)
{
    var failureReportPath = Path.Combine(
        Path.GetDirectoryName(reportPath)!,
        $"phase1-failure-{runId}.json");

    var failureReport = new
    {
        GeneratedAtUtc = DateTime.UtcNow,
        Options = options,
        CreatedCount = createdMessageIds.Count,
        TargetCount = options.TotalRequests,
        ErrorsCount = seedErrors.Count,
        Errors = seedErrors,
        Plan = planningResult,
        CreatedSample = createdMessageIds.Take(20).ToList()
    };

    Directory.CreateDirectory(Path.GetDirectoryName(failureReportPath)!);
    await File.WriteAllTextAsync(
        failureReportPath,
        JsonSerializer.Serialize(failureReport, prettyJsonOptions));

    var firstError = seedErrors.FirstOrDefault() ?? "N/A";
    throw new InvalidOperationException(
        $"Seeding failed to reach target count. Created={createdMessageIds.Count}, Target={options.TotalRequests}, Errors={seedErrors.Count}, FailureReport={failureReportPath}, FirstError={firstError}");
}

var afterSeedCounts = await CaptureSummerCountsAsync(connectContext, attachContext, summerCategoryIds);
var verification = await BuildVerificationAsync(
    connectContext,
    destinationCatalog,
    createdMessageIds,
    summerCategoryIds,
    options);

var report = new SeedExecutionReport
{
    GeneratedAtUtc = DateTime.UtcNow,
    Options = options,
    BackupPath = backupPath,
    Review = reviewSnapshot,
    Cleanup = new CleanupReport
    {
        WipeExistingFirst = options.WipeExistingFirst,
        BeforeCounts = beforeCounts,
        AfterDeleteCounts = afterDeleteCounts,
        AfterSeedCounts = afterSeedCounts,
        OrphanChecksAfterDelete = postDeleteOrphans
    },
    Plan = planningResult,
    Result = new ExecutionResult
    {
        CreatedMessagesCount = createdMessageIds.Count,
        CreatedMessageIdsSample = createdMessageIds.Take(10).ToList(),
        Errors = seedErrors
    },
    Verification = verification
};

Directory.CreateDirectory(Path.GetDirectoryName(reportPath)!);
await File.WriteAllTextAsync(
    reportPath,
    JsonSerializer.Serialize(report, prettyJsonOptions));

Console.WriteLine($"Backup snapshot: {backupPath}");
Console.WriteLine($"Execution report: {reportPath}");
Console.WriteLine($"Created messages: {createdMessageIds.Count}");
Console.WriteLine($"Proxy bookings: {verification.ProxyBookingsCount}");
Console.WriteLine("Destination breakdown:");
foreach (var item in verification.ByDestination.OrderBy(item => item.Key))
{
    Console.WriteLine($"  {item.Key}: {item.Value}");
}

static string ResolveRepoRoot()
{
    var current = Directory.GetCurrentDirectory();
    for (var i = 0; i < 8; i += 1)
    {
        var candidate = Path.Combine(current, "ENPO.Connect.Backend", "Api", "appsettings.json");
        if (File.Exists(candidate))
        {
            return current;
        }

        var parent = Directory.GetParent(current);
        if (parent == null)
        {
            break;
        }

        current = parent.FullName;
    }

    throw new InvalidOperationException("Repository root could not be resolved.");
}

static async Task<ReviewSnapshot> BuildReviewSnapshotAsync(ConnectContext connectContext)
{
    var categories = await connectContext.Cdcategories
        .AsNoTracking()
        .Where(category => category.CatId == 147 || category.CatId == 148 || category.CatId == 149)
        .Select(category => new ReviewCategory
        {
            CategoryId = category.CatId,
            Name = category.CatName ?? string.Empty,
            ParentCategoryId = category.CatParent,
            Stockholder = category.Stockholder
        })
        .OrderBy(category => category.CategoryId)
        .ToListAsync();

    var fields = await connectContext.CdCategoryMands
        .AsNoTracking()
        .Where(item => !item.MendStat && (item.MendCategory == 147 || item.MendCategory == 148 || item.MendCategory == 149))
        .Join(
            connectContext.Cdmends.AsNoTracking(),
            mand => mand.MendField,
            mend => mend.CdmendTxt,
            (mand, mend) => new ReviewCategoryField
            {
                CategoryId = mand.MendCategory,
                FieldKind = mand.MendField,
                Label = mend.CDMendLbl ?? string.Empty,
                Required = mend.Required ?? false,
                FieldType = mend.CdmendType ?? string.Empty,
                GroupId = mand.MendGroup
            })
        .OrderBy(item => item.CategoryId)
        .ThenBy(item => item.GroupId)
        .ThenBy(item => item.FieldKind)
        .ToListAsync();

    var migrationNames = await connectContext.Database
        .SqlQueryRaw<string>("SELECT [MigrationId] AS [Value] FROM [__EFMigrationsHistory] ORDER BY [MigrationId];")
        .ToListAsync();

    var destinationCatalogRow = await connectContext.Cdmends
        .AsNoTracking()
        .Where(item => item.CdmendTxt == SummerWorkflowDomainConstants.DestinationCatalogMend)
        .OrderByDescending(item => item.CdmendSql)
        .Select(item => new
        {
            item.CdmendTxt,
            item.ApplicationId,
            item.CdmendType,
            item.CdmendDatatype,
            PayloadLength = (item.CdmendTbl ?? string.Empty).Length
        })
        .FirstOrDefaultAsync();

    var pricingCatalogRow = await connectContext.Cdmends
        .AsNoTracking()
        .Where(item => item.CdmendTxt == SummerWorkflowDomainConstants.PricingCatalogMend)
        .OrderByDescending(item => item.CdmendSql)
        .Select(item => new
        {
            item.CdmendTxt,
            item.ApplicationId,
            item.CdmendType,
            item.CdmendDatatype,
            PayloadLength = (item.CdmendTbl ?? string.Empty).Length
        })
        .FirstOrDefaultAsync();

    return new ReviewSnapshot
    {
        SummerCategories = categories,
        CategoryFields = fields,
        AppliedMigrations = migrationNames,
        DestinationCatalog = destinationCatalogRow == null
            ? null
            : new ReviewCatalogRow
            {
                Key = destinationCatalogRow.CdmendTxt ?? string.Empty,
                ApplicationId = destinationCatalogRow.ApplicationId ?? string.Empty,
                FieldType = destinationCatalogRow.CdmendType ?? string.Empty,
                DataType = destinationCatalogRow.CdmendDatatype ?? string.Empty,
                PayloadLength = destinationCatalogRow.PayloadLength
            },
        PricingCatalog = pricingCatalogRow == null
            ? null
            : new ReviewCatalogRow
            {
                Key = pricingCatalogRow.CdmendTxt ?? string.Empty,
                ApplicationId = pricingCatalogRow.ApplicationId ?? string.Empty,
                FieldType = pricingCatalogRow.CdmendType ?? string.Empty,
                DataType = pricingCatalogRow.CdmendDatatype ?? string.Empty,
                PayloadLength = pricingCatalogRow.PayloadLength
            }
    };
}

static async Task<Dictionary<string, int>> CaptureSummerCountsAsync(
    ConnectContext connectContext,
    Attach_HeldContext attachContext,
    HashSet<int> summerCategoryIds)
{
    var messageIds = await connectContext.Messages
        .AsNoTracking()
        .Where(message => summerCategoryIds.Contains(message.CategoryCd))
        .Select(message => message.MessageId)
        .ToListAsync();

    var replyIds = messageIds.Count == 0
        ? new List<int>()
        : await connectContext.Replies
            .AsNoTracking()
            .Where(reply => messageIds.Contains(reply.MessageId))
            .Select(reply => reply.ReplyId)
            .ToListAsync();

    var result = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
    {
        ["Messages"] = messageIds.Count,
        ["Replies"] = messageIds.Count == 0
            ? 0
            : await connectContext.Replies.CountAsync(reply => messageIds.Contains(reply.MessageId)),
        ["Fields"] = messageIds.Count == 0
            ? 0
            : await connectContext.TkmendFields.CountAsync(field => messageIds.Contains(field.FildRelted)),
        ["History"] = messageIds.Count == 0
            ? 0
            : await connectContext.MessageHistories.CountAsync(history => messageIds.Contains(history.MessageId)),
        ["MessageRelationsByMessage"] = messageIds.Count == 0
            ? 0
            : await connectContext.MessagesRelations.CountAsync(relation => messageIds.Contains(relation.MessageId)),
        ["MessageRelationsByRelated"] = messageIds.Count == 0
            ? 0
            : await connectContext.MessagesRelations.CountAsync(relation =>
                relation.RelatedMessageId.HasValue && messageIds.Contains(relation.RelatedMessageId.Value)),
        ["MessageStockholders"] = messageIds.Count == 0
            ? 0
            : await connectContext.MessageStockholders.CountAsync(item =>
                item.MessageId.HasValue && messageIds.Contains(item.MessageId.Value)),
        ["RequestTokens"] = messageIds.Count == 0
            ? 0
            : await connectContext.RequestTokens.CountAsync(item => messageIds.Contains(item.MessageId)),
        ["FreezeAssignments"] = messageIds.Count == 0
            ? 0
            : await connectContext.SummerUnitFreezeDetails.CountAsync(item => item.AssignedMessageId.HasValue && messageIds.Contains(item.AssignedMessageId.Value)),
        ["Attachments_MessageLevel"] = messageIds.Count == 0
            ? 0
            : await attachContext.AttchShipments.CountAsync(item => messageIds.Contains(item.AttchId)),
        ["Attachments_ReplyLevel"] = replyIds.Count == 0
            ? 0
            : await attachContext.AttchShipments.CountAsync(item => replyIds.Contains(item.AttchId))
    };

    return result;
}

static async Task<List<string>> CaptureOrphanChecksAsync(ConnectContext connectContext, HashSet<int> summerCategoryIds)
{
    var messages = await connectContext.Messages
        .AsNoTracking()
        .Where(message => summerCategoryIds.Contains(message.CategoryCd))
        .Select(message => message.MessageId)
        .ToListAsync();

    var messageIdSet = messages.ToHashSet();

    var orphanReplies = await connectContext.Replies
        .AsNoTracking()
        .Where(reply => !connectContext.Messages.Any(message => message.MessageId == reply.MessageId))
        .CountAsync();

    var orphanFields = await connectContext.TkmendFields
        .AsNoTracking()
        .Where(field => !connectContext.Messages.Any(message => message.MessageId == field.FildRelted))
        .CountAsync();

    var orphanHistory = await connectContext.MessageHistories
        .AsNoTracking()
        .Where(item => !connectContext.Messages.Any(message => message.MessageId == item.MessageId))
        .CountAsync();

    var summary = new List<string>
    {
        $"GlobalOrphanReplies={orphanReplies}",
        $"GlobalOrphanFields={orphanFields}",
        $"GlobalOrphanHistory={orphanHistory}",
        $"SummerMessageCount={messageIdSet.Count}"
    };

    return summary;
}

static async Task<List<OwnerSeed>> BuildOwnerPoolFromExistingSummerRequestsAsync(
    ConnectContext connectContext,
    List<int> summerMessageIds)
{
    if (summerMessageIds.Count == 0)
    {
        return new List<OwnerSeed>();
    }

    var messages = await connectContext.Messages
        .AsNoTracking()
        .Where(message => summerMessageIds.Contains(message.MessageId))
        .Select(message => new { message.MessageId, message.CreatedBy })
        .ToListAsync();

    var fields = await connectContext.TkmendFields
        .AsNoTracking()
        .Where(field => summerMessageIds.Contains(field.FildRelted))
        .ToListAsync();

    var byMessage = fields
        .GroupBy(field => field.FildRelted)
        .ToDictionary(group => group.Key, group => group.ToList());

    var result = new Dictionary<string, OwnerSeed>(StringComparer.OrdinalIgnoreCase);

    foreach (var message in messages)
    {
        byMessage.TryGetValue(message.MessageId, out var messageFields);
        messageFields ??= new List<TkmendField>();

        var fileNumber = FirstFieldValue(messageFields, SummerWorkflowDomainConstants.EmployeeIdFieldKinds);
        if (string.IsNullOrWhiteSpace(fileNumber))
        {
            fileNumber = (message.CreatedBy ?? string.Empty).Trim();
        }

        if (string.IsNullOrWhiteSpace(fileNumber))
        {
            continue;
        }

        var normalizedFile = fileNumber.Trim();
        if (result.ContainsKey(normalizedFile))
        {
            continue;
        }

        var name = FirstFieldValue(messageFields, SummerWorkflowDomainConstants.EmployeeNameFieldKinds);
        var nationalId = FirstFieldValue(messageFields, SummerWorkflowDomainConstants.EmployeeNationalIdFieldKinds);
        var phone = FirstFieldValue(messageFields, SummerWorkflowDomainConstants.EmployeePhoneFieldKinds);
        var extraPhone = FirstFieldValue(messageFields, SummerWorkflowDomainConstants.EmployeeExtraPhoneFieldKinds);

        result[normalizedFile] = new OwnerSeed(
            FileNumber: normalizedFile,
            Name: string.IsNullOrWhiteSpace(name) ? "موظف حالي بيانات تجريبية" : name.Trim(),
            NationalId: NormalizeNationalId(nationalId, normalizedFile),
            Phone: NormalizePhone(phone, "010"),
            ExtraPhone: NormalizePhone(extraPhone, "011"));
    }

    return result.Values.ToList();
}

static List<OwnerSeed> BuildFinalOwnerPool(
    List<OwnerSeed> existing,
    int target,
    int randomSeed,
    SummerBookingBlacklistService blacklistService)
{
    var result = new List<OwnerSeed>();
    var usedFileNumbers = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

    foreach (var owner in existing)
    {
        var normalized = (owner.FileNumber ?? string.Empty).Trim();
        if (normalized.Length == 0 || usedFileNumbers.Contains(normalized) || blacklistService.IsBlocked(normalized))
        {
            continue;
        }

        result.Add(owner with
        {
            FileNumber = normalized,
            Name = string.IsNullOrWhiteSpace(owner.Name) ? "موظف حالي بيانات تجريبية" : owner.Name.Trim(),
            NationalId = NormalizeNationalId(owner.NationalId, normalized),
            Phone = NormalizePhone(owner.Phone, "010"),
            ExtraPhone = NormalizePhone(owner.ExtraPhone, "011")
        });
        usedFileNumbers.Add(normalized);
    }

    var random = new Random(randomSeed + 901);
    var serial = 1;
    while (result.Count < target)
    {
        var fileNumber = $"96{serial:00000000}";
        serial += 1;

        if (usedFileNumbers.Contains(fileNumber) || blacklistService.IsBlocked(fileNumber))
        {
            continue;
        }

        var nationalId = $"29901{serial:000000000}";
        var owner = new OwnerSeed(
            FileNumber: fileNumber,
            Name: $"موظف اختبار رقم {serial}",
            NationalId: nationalId.Length >= 14 ? nationalId[..14] : nationalId.PadRight(14, '0'),
            Phone: $"010{random.Next(10_000_000, 99_999_999)}",
            ExtraPhone: $"011{random.Next(10_000_000, 99_999_999)}");

        result.Add(owner);
        usedFileNumbers.Add(fileNumber);
    }

    return result.Take(target).ToList();
}

static async Task DeleteExistingSummerRequestsAsync(
    ConnectContext connectContext,
    Attach_HeldContext attachContext,
    List<int> summerMessageIds)
{
    var messageIds = (summerMessageIds ?? new List<int>())
        .Where(id => id > 0)
        .Distinct()
        .ToList();

    if (messageIds.Count == 0)
    {
        return;
    }

    var replyIds = await connectContext.Replies
        .AsNoTracking()
        .Where(reply => messageIds.Contains(reply.MessageId))
        .Select(reply => reply.ReplyId)
        .Distinct()
        .ToListAsync();

    await using var attachTransaction = await attachContext.Database.BeginTransactionAsync();
    await using var connectTransaction = await connectContext.Database.BeginTransactionAsync();

    try
    {
        var nowUtc = DateTime.UtcNow;

        // Release any booked frozen slots that reference summer requests to be deleted.
        await connectContext.SummerUnitFreezeDetails
            .Where(detail => detail.AssignedMessageId.HasValue
                             && messageIds.Contains(detail.AssignedMessageId.Value)
                             && detail.Status == SummerUnitFreezeStatuses.Booked
                             && detail.Freeze.IsActive)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(detail => detail.AssignedMessageId, detail => (int?)null)
                .SetProperty(detail => detail.AssignedAtUtc, detail => (DateTime?)null)
                .SetProperty(detail => detail.LastStatusChangedAtUtc, detail => nowUtc)
                .SetProperty(detail => detail.Status, detail => SummerUnitFreezeStatuses.FrozenAvailable)
                .SetProperty(detail => detail.ReleasedAtUtc, detail => (DateTime?)null)
                .SetProperty(detail => detail.ReleasedBy, detail => (string?)null));

        await connectContext.SummerUnitFreezeDetails
            .Where(detail => detail.AssignedMessageId.HasValue
                             && messageIds.Contains(detail.AssignedMessageId.Value)
                             && detail.Status == SummerUnitFreezeStatuses.Booked
                             && !detail.Freeze.IsActive)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(detail => detail.AssignedMessageId, detail => (int?)null)
                .SetProperty(detail => detail.AssignedAtUtc, detail => (DateTime?)null)
                .SetProperty(detail => detail.LastStatusChangedAtUtc, detail => nowUtc)
                .SetProperty(detail => detail.Status, detail => SummerUnitFreezeStatuses.Released)
                .SetProperty(detail => detail.ReleasedAtUtc, detail => nowUtc)
                .SetProperty(detail => detail.ReleasedBy, detail => "SUMMER_SEED_RUNNER"));

        if (replyIds.Count > 0)
        {
            await attachContext.AttchShipments
                .Where(item => messageIds.Contains(item.AttchId) || replyIds.Contains(item.AttchId))
                .ExecuteDeleteAsync();
        }
        else
        {
            await attachContext.AttchShipments
                .Where(item => messageIds.Contains(item.AttchId))
                .ExecuteDeleteAsync();
        }

        await connectContext.RequestTokens
            .Where(item => messageIds.Contains(item.MessageId))
            .ExecuteDeleteAsync();

        await connectContext.MessageStockholders
            .Where(item => item.MessageId.HasValue && messageIds.Contains(item.MessageId.Value))
            .ExecuteDeleteAsync();

        await connectContext.MessagesRelations
            .Where(item => messageIds.Contains(item.MessageId)
                           || (item.RelatedMessageId.HasValue && messageIds.Contains(item.RelatedMessageId.Value)))
            .ExecuteDeleteAsync();

        await connectContext.MessageHistories
            .Where(item => messageIds.Contains(item.MessageId))
            .ExecuteDeleteAsync();

        await connectContext.TkmendFields
            .Where(item => messageIds.Contains(item.FildRelted))
            .ExecuteDeleteAsync();

        await connectContext.Replies
            .Where(item => messageIds.Contains(item.MessageId))
            .ExecuteDeleteAsync();

        await connectContext.Messages
            .Where(item => messageIds.Contains(item.MessageId))
            .ExecuteDeleteAsync();

        await connectTransaction.CommitAsync();
        await attachTransaction.CommitAsync();
    }
    catch
    {
        await connectTransaction.RollbackAsync();
        await attachTransaction.RollbackAsync();
        throw;
    }
}

static async Task<List<SummerDestinationConfigDto>> LoadDestinationCatalogAsync(
    ConnectContext connectContext,
    int seasonYear)
{
    var payload = await connectContext.Cdmends
        .AsNoTracking()
        .Where(item => item.CdmendTxt == SummerWorkflowDomainConstants.DestinationCatalogMend)
        .OrderByDescending(item => item.CdmendSql)
        .Select(item => item.CdmendTbl)
        .FirstOrDefaultAsync();

    var raw = (payload ?? string.Empty).Trim();
    if (raw.Length == 0)
    {
        throw new InvalidOperationException("Destination catalog payload is empty.");
    }

    var jsonOptions = new JsonSerializerOptions
    {
        PropertyNameCaseInsensitive = true
    };

    List<SummerDestinationConfigDto> destinations;
    if (raw.StartsWith("{", StringComparison.Ordinal))
    {
        var parsed = JsonSerializer.Deserialize<DestinationCatalogPayload>(raw, jsonOptions)
                     ?? new DestinationCatalogPayload();
        if (parsed.SeasonYear > 0 && parsed.SeasonYear != seasonYear)
        {
            throw new InvalidOperationException(
                $"Destination catalog season mismatch. Requested={seasonYear}, Catalog={parsed.SeasonYear}.");
        }

        destinations = parsed.Destinations ?? new List<SummerDestinationConfigDto>();
    }
    else if (raw.StartsWith("[", StringComparison.Ordinal))
    {
        destinations = JsonSerializer.Deserialize<List<SummerDestinationConfigDto>>(raw, jsonOptions)
                       ?? new List<SummerDestinationConfigDto>();
    }
    else
    {
        throw new InvalidOperationException("Destination catalog payload is not valid JSON.");
    }

    var todayUtcDate = DateTime.UtcNow.Date;

    return destinations
        .Where(item => item.CategoryId > 0)
        .Select(item => new SummerDestinationConfigDto
        {
            CategoryId = item.CategoryId,
            Name = (item.Name ?? string.Empty).Trim(),
            Slug = (item.Slug ?? string.Empty).Trim(),
            MaxExtraMembers = item.MaxExtraMembers,
            StayModes = (item.StayModes ?? new List<SummerStayModeDefinitionDto>())
                .Where(mode => !string.IsNullOrWhiteSpace(mode.Code))
                .Select(mode => new SummerStayModeDefinitionDto
                {
                    Code = (mode.Code ?? string.Empty).Trim(),
                    Label = (mode.Label ?? string.Empty).Trim()
                })
                .ToList(),
            Apartments = (item.Apartments ?? new List<SummerApartmentDefinitionDto>())
                .Where(apartment => apartment.FamilyCount > 0 && apartment.Apartments > 0)
                .GroupBy(apartment => apartment.FamilyCount)
                .Select(group => new SummerApartmentDefinitionDto
                {
                    FamilyCount = group.Key,
                    Apartments = group.Sum(apartment => apartment.Apartments)
                })
                .OrderBy(apartment => apartment.FamilyCount)
                .ToList(),
            FamilyOptions = (item.Apartments ?? new List<SummerApartmentDefinitionDto>())
                .Where(apartment => apartment.FamilyCount > 0 && apartment.Apartments > 0)
                .Select(apartment => apartment.FamilyCount)
                .Distinct()
                .OrderBy(value => value)
                .ToList(),
            Waves = (item.Waves ?? new List<SummerWaveDefinitionDto>())
                .Where(wave => !string.IsNullOrWhiteSpace(wave.Code))
                .Where(wave =>
                {
                    if (!SummerCalendarRules.TryParseWaveLabelDateUtc(wave.StartsAtLabel, out var waveStartUtc))
                    {
                        return true;
                    }

                    return waveStartUtc.Date >= todayUtcDate;
                })
                .Select(wave => new SummerWaveDefinitionDto
                {
                    Code = (wave.Code ?? string.Empty).Trim(),
                    StartsAtLabel = (wave.StartsAtLabel ?? string.Empty).Trim(),
                    StartsAtIso = wave.StartsAtIso
                })
                .OrderBy(wave => wave.Code)
                .ToList()
        })
        .Where(item => item.Waves.Count > 0 && item.Apartments.Count > 0)
        .OrderBy(item => item.CategoryId)
        .ToList();
}

static Dictionary<int, double> ResolveDestinationWeights(
    SeedRunnerOptions options,
    List<SummerDestinationConfigDto> destinations)
{
    var weights = new Dictionary<int, double>();

    foreach (var destination in destinations)
    {
        if (options.DestinationWeights.TryGetValue(destination.CategoryId, out var explicitWeight)
            && explicitWeight > 0)
        {
            weights[destination.CategoryId] = explicitWeight;
            continue;
        }

        var capacityWeight = destination.Apartments.Sum(item => item.Apartments);
        weights[destination.CategoryId] = Math.Max(1, capacityWeight);
    }

    return weights;
}

static SeedPlanReport BuildRequestPlan(
    SeedRunnerOptions options,
    Dictionary<int, SummerDestinationConfigDto> catalogByCategory,
    Dictionary<int, double> destinationWeights,
    Dictionary<CapacitySlot, int> slotCapacities)
{
    var remainingBySlot = slotCapacities
        .Where(item => item.Value > 0)
        .ToDictionary(item => item.Key, item => item.Value);

    var random = new Random(options.RandomSeed);
    var assignments = new List<RequestAssignment>();

    foreach (var destination in catalogByCategory.Values.OrderBy(item => item.CategoryId))
    {
        foreach (var wave in destination.Waves.OrderBy(item => item.Code))
        {
            foreach (var apartment in destination.Apartments.OrderBy(item => item.FamilyCount))
            {
                var slot = new CapacitySlot(destination.CategoryId, wave.Code, apartment.FamilyCount);
                if (!remainingBySlot.TryGetValue(slot, out var remaining) || remaining <= 0)
                {
                    continue;
                }

                assignments.Add(new RequestAssignment(slot.CategoryId, slot.WaveCode, slot.FamilyCount));
                remainingBySlot[slot] = remaining - 1;
            }
        }
    }

    while (assignments.Count < options.TotalRequests)
    {
        var availableDestinations = remainingBySlot
            .Where(item => item.Value > 0)
            .GroupBy(item => item.Key.CategoryId)
            .Select(group => group.Key)
            .ToList();

        if (availableDestinations.Count == 0)
        {
            throw new InvalidOperationException("No capacity remains to reach requested total.");
        }

        var destinationId = PickWeighted(
            availableDestinations,
            item => destinationWeights.TryGetValue(item, out var weight) ? weight : 1d,
            random);

        var availableSlots = remainingBySlot
            .Where(item => item.Value > 0 && item.Key.CategoryId == destinationId)
            .Select(item => item.Key)
            .ToList();

        var selectedSlot = PickWeighted(
            availableSlots,
            slot => remainingBySlot[slot],
            random);

        assignments.Add(new RequestAssignment(selectedSlot.CategoryId, selectedSlot.WaveCode, selectedSlot.FamilyCount));
        remainingBySlot[selectedSlot] -= 1;
    }

    var byDestination = assignments
        .GroupBy(item => item.CategoryId)
        .ToDictionary(group => group.Key.ToString(CultureInfo.InvariantCulture), group => group.Count());

    var byWave = assignments
        .GroupBy(item => $"{item.CategoryId}:{item.WaveCode}")
        .ToDictionary(group => group.Key, group => group.Count());

    var byFamily = assignments
        .GroupBy(item => $"{item.CategoryId}:{item.FamilyCount}")
        .ToDictionary(group => group.Key, group => group.Count());

    var baselineCoverageCount = remainingBySlot.Count;

    return new SeedPlanReport
    {
        SeasonYear = options.SeasonYear,
        RandomSeed = options.RandomSeed,
        TotalRequests = options.TotalRequests,
        BaselineCoverageCount = baselineCoverageCount,
        Assignments = assignments,
        ByDestination = byDestination,
        ByWave = byWave,
        ByFamily = byFamily,
        RemainingCapacityBySlot = remainingBySlot.ToDictionary(
            item => $"{item.Key.CategoryId}:{item.Key.WaveCode}:{item.Key.FamilyCount}",
            item => item.Value)
    };
}

static async Task<Dictionary<CapacitySlot, int>> BuildPublicSlotCapacitiesAsync(
    ConnectContext connectContext,
    SummerPricingService summerPricingService,
    SeedRunnerOptions options,
    Dictionary<int, SummerDestinationConfigDto> catalogByCategory,
    Dictionary<int, Dictionary<int, int>> capacityRules)
{
    var categoryIds = catalogByCategory.Keys.ToHashSet();
    var frozenRows = await connectContext.SummerUnitFreezeDetails
        .AsNoTracking()
        .Where(detail => detail.Status == SummerUnitFreezeStatuses.FrozenAvailable
                         && detail.AssignedMessageId == null
                         && detail.Freeze.IsActive
                         && categoryIds.Contains(detail.Freeze.CategoryId))
        .GroupBy(detail => new
        {
            detail.Freeze.CategoryId,
            detail.Freeze.WaveCode,
            detail.Freeze.FamilyCount
        })
        .Select(group => new
        {
            group.Key.CategoryId,
            group.Key.WaveCode,
            group.Key.FamilyCount,
            FrozenUnits = group.Count()
        })
        .ToListAsync();

    var frozenBySlot = frozenRows.ToDictionary(
        item => new CapacitySlot(item.CategoryId, NormalizeWaveCode(item.WaveCode), item.FamilyCount),
        item => item.FrozenUnits);

    var result = new Dictionary<CapacitySlot, int>();
    foreach (var destination in catalogByCategory.Values.OrderBy(item => item.CategoryId))
    {
        var preferredStayMode = ResolvePreferredStayModeForPlanning(destination);
        var capacitiesByFamily = ResolveCapacitiesByFamily(destination, capacityRules);
        foreach (var wave in destination.Waves)
        {
            var normalizedWave = NormalizeWaveCode(wave.Code);
            foreach (var capacity in capacitiesByFamily)
            {
                var slot = new CapacitySlot(destination.CategoryId, normalizedWave, capacity.Key);
                var frozenUnits = frozenBySlot.TryGetValue(slot, out var frozen) ? frozen : 0;
                var publicCapacity = Math.Max(0, capacity.Value - frozenUnits);
                if (publicCapacity <= 0)
                {
                    continue;
                }

                var pricingCheck = await summerPricingService.GetQuoteAsync(new SummerPricingQuoteRequest
                {
                    CategoryId = destination.CategoryId,
                    SeasonYear = options.SeasonYear,
                    WaveCode = normalizedWave,
                    WaveLabel = wave.StartsAtLabel,
                    FamilyCount = capacity.Key,
                    ExtraCount = 0,
                    PersonsCount = capacity.Key,
                    StayMode = preferredStayMode,
                    IsProxyBooking = false,
                    DestinationName = destination.Name
                });

                if (!pricingCheck.IsSuccess || pricingCheck.Data == null)
                {
                    continue;
                }

                result[slot] = publicCapacity;
            }
        }
    }

    return result;
}

static string ResolvePreferredStayModeForPlanning(SummerDestinationConfigDto destination)
{
    var stayModes = (destination.StayModes ?? new List<SummerStayModeDefinitionDto>())
        .Where(mode => !string.IsNullOrWhiteSpace(mode.Code))
        .Select(mode => mode.Code.Trim())
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToList();

    var residenceOnly = stayModes.FirstOrDefault(mode =>
        string.Equals(mode, SummerWorkflowDomainConstants.StayModes.ResidenceOnly, StringComparison.OrdinalIgnoreCase));
    if (!string.IsNullOrWhiteSpace(residenceOnly))
    {
        return residenceOnly;
    }

    if (stayModes.Count > 0)
    {
        return stayModes[0];
    }

    return SummerWorkflowDomainConstants.StayModes.ResidenceOnly;
}

static string NormalizeWaveCode(string? waveCode)
{
    return (waveCode ?? string.Empty).Trim().ToUpperInvariant();
}

static Dictionary<int, int> ResolveCapacitiesByFamily(
    SummerDestinationConfigDto destination,
    Dictionary<int, Dictionary<int, int>> capacityRules)
{
    var catalogFamilies = destination.Apartments
        .Where(apartment => apartment.FamilyCount > 0)
        .Select(apartment => apartment.FamilyCount)
        .ToHashSet();

    if (capacityRules.TryGetValue(destination.CategoryId, out var rulesByFamily)
        && rulesByFamily.Count > 0)
    {
        var intersection = rulesByFamily
            .Where(item => item.Key > 0
                           && item.Value > 0
                           && (catalogFamilies.Count == 0 || catalogFamilies.Contains(item.Key)))
            .OrderBy(item => item.Key)
            .ToDictionary(item => item.Key, item => item.Value);

        if (intersection.Count > 0)
        {
            return intersection;
        }
    }

    return destination.Apartments
        .Where(apartment => apartment.FamilyCount > 0 && apartment.Apartments > 0)
        .GroupBy(apartment => apartment.FamilyCount)
        .Select(group => new { FamilyCount = group.Key, Units = group.Sum(item => item.Apartments) })
        .OrderBy(item => item.FamilyCount)
        .ToDictionary(item => item.FamilyCount, item => item.Units);
}

static Dictionary<int, Dictionary<int, int>> LoadSummerCapacityRulesFromHandler()
{
    var field = typeof(HandleEmployeeCategories).GetField(
        "SummerCapacityRules",
        BindingFlags.NonPublic | BindingFlags.Static);

    if (field?.GetValue(null) is not Dictionary<int, Dictionary<int, int>> rawRules || rawRules.Count == 0)
    {
        throw new InvalidOperationException("Unable to read SummerCapacityRules from HandleEmployeeCategories.");
    }

    return rawRules
        .Where(categoryRule => categoryRule.Key > 0 && categoryRule.Value != null)
        .ToDictionary(
            categoryRule => categoryRule.Key,
            categoryRule => categoryRule.Value
                .Where(item => item.Key > 0 && item.Value > 0)
                .ToDictionary(item => item.Key, item => item.Value));
}

static MessageRequest BuildMessageRequest(
    SeedRunnerOptions options,
    int index,
    SummerDestinationConfigDto destination,
    SummerWaveDefinitionDto wave,
    int familyCount,
    int extraCount,
    string stayMode,
    bool isProxy,
    OwnerSeed owner,
    Random random)
{
    var requestNumber = index + 1;
    var subject = $"طلب مصيف تجريبي {destination.Name} - {wave.Code}";
    var notes = $"بيانات اختبار آلية - Phase1 - Req#{requestNumber}";

    var fields = new List<TkmendField>();

    void AddField(string kind, string value, int instanceGroupId = 1)
    {
        fields.Add(new TkmendField
        {
            FildSql = 0,
            FildRelted = 0,
            FildKind = kind,
            FildTxt = value,
            InstanceGroupId = instanceGroupId
        });
    }

    AddField("SummerSeasonYear", options.SeasonYear.ToString(CultureInfo.InvariantCulture));
    AddField("SUM2026_SeasonYear", options.SeasonYear.ToString(CultureInfo.InvariantCulture));

    AddField("SummerDestinationId", destination.CategoryId.ToString(CultureInfo.InvariantCulture));
    AddField("SUM2026_DestinationId", destination.CategoryId.ToString(CultureInfo.InvariantCulture));
    AddField("SummerDestinationName", destination.Name);
    AddField("SUM2026_DestinationName", destination.Name);

    AddField("SummerCamp", wave.Code);
    AddField("SUM2026_WaveCode", wave.Code);
    AddField("SummerCampLabel", string.IsNullOrWhiteSpace(wave.StartsAtLabel) ? wave.Code : wave.StartsAtLabel);
    AddField("SUM2026_WaveLabel", string.IsNullOrWhiteSpace(wave.StartsAtLabel) ? wave.Code : wave.StartsAtLabel);

    AddField("FamilyCount", familyCount.ToString(CultureInfo.InvariantCulture));
    AddField("SUM2026_FamilyCount", familyCount.ToString(CultureInfo.InvariantCulture));
    AddField("Over_Count", extraCount.ToString(CultureInfo.InvariantCulture));
    AddField("SUM2026_ExtraCount", extraCount.ToString(CultureInfo.InvariantCulture));

    AddField("SummerStayMode", stayMode);
    AddField("SUM2026_StayMode", stayMode);

    AddField("SummerProxyMode", isProxy ? "true" : "false");
    AddField("SUM2026_ProxyMode", isProxy ? "true" : "false");

    AddField("Summer_UseFrozenUnit", "false");
    AddField("SUM2026_UseFrozenUnit", "false");

    AddField("Emp_Name", owner.Name);
    AddField("SUM2026_OwnerName", owner.Name);

    AddField("Emp_Id", owner.FileNumber);
    AddField("SUM2026_OwnerFileNumber", owner.FileNumber);

    AddField("NationalId", owner.NationalId);
    AddField("SUM2026_OwnerNationalId", owner.NationalId);

    AddField("PhoneNumber", owner.Phone);
    AddField("Emp_MobileNumber", owner.Phone);
    AddField("SUM2026_OwnerPhone", owner.Phone);

    AddField("ExtraPhoneNumber", owner.ExtraPhone);
    AddField("MobileNumber", owner.ExtraPhone);
    AddField("SUM2026_OwnerExtraPhone", owner.ExtraPhone);

    AddField("Description", notes);
    AddField("SUM2026_Notes", notes);

    var personsCount = familyCount + extraCount;
    if (personsCount > 1 && random.NextDouble() < options.IncludeCompanionsRatio)
    {
        var companionName = $"مرافق اختبار رقم {requestNumber}";
        var relation = random.NextDouble() < 0.12 ? "أخرى" : "ابن";
        AddField("SUM2026_CompanionName", companionName, 1);
        AddField("SUM2026_CompanionRelation", relation, 1);
        AddField("SUM2026_CompanionNationalId", BuildCompanionNationalId(requestNumber), 1);
        AddField("SUM2026_CompanionAge", relation == "ابن" ? random.Next(5, 18).ToString(CultureInfo.InvariantCulture) : string.Empty, 1);
        if (relation == "أخرى")
        {
            AddField("SUM2026_CompanionRelationOther", "قريب من الدرجة الثانية", 1);
        }
    }

    return new MessageRequest
    {
        MessageId = 0,
        RequestRef = $"SEED-PH1-{requestNumber:0000}",
        Subject = subject,
        Description = notes,
        CreatedBy = owner.FileNumber,
        AssignedSectorId = string.Empty,
        UnitId = 0,
        CurrentResponsibleSectorId = string.Empty,
        Type = 0,
        CategoryCd = destination.CategoryId,
        Fields = fields,
        files = new List<IFormFile>()
    };
}

static string ResolveStayMode(SummerDestinationConfigDto destination, Random random)
{
    var stayModes = destination.StayModes
        .Where(mode => !string.IsNullOrWhiteSpace(mode.Code))
        .Select(mode => mode.Code.Trim())
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .ToList();

    if (stayModes.Count == 0)
    {
        return SummerWorkflowDomainConstants.StayModes.ResidenceOnly;
    }

    var residenceOnly = stayModes.FirstOrDefault(mode => string.Equals(mode, SummerWorkflowDomainConstants.StayModes.ResidenceOnly, StringComparison.OrdinalIgnoreCase));
    var withTransport = stayModes.FirstOrDefault(mode => string.Equals(mode, SummerWorkflowDomainConstants.StayModes.ResidenceWithTransport, StringComparison.OrdinalIgnoreCase));

    if (withTransport != null && residenceOnly != null)
    {
        return random.NextDouble() < 0.65 ? residenceOnly : withTransport;
    }

    return stayModes[0];
}

static int ResolveExtraCount(int maxExtraMembers, Random random)
{
    if (maxExtraMembers <= 0)
    {
        return 0;
    }

    var roll = random.NextDouble();
    if (roll < 0.72)
    {
        return 0;
    }

    if (roll < 0.92)
    {
        return Math.Min(1, maxExtraMembers);
    }

    return Math.Min(2, maxExtraMembers);
}

static async Task<VerificationReport> BuildVerificationAsync(
    ConnectContext connectContext,
    List<SummerDestinationConfigDto> destinationCatalog,
    List<int> createdMessageIds,
    HashSet<int> summerCategoryIds,
    SeedRunnerOptions options)
{
    var messages = await connectContext.Messages
        .AsNoTracking()
        .Where(message => createdMessageIds.Contains(message.MessageId))
        .OrderBy(message => message.MessageId)
        .ToListAsync();

    var fields = await connectContext.TkmendFields
        .AsNoTracking()
        .Where(field => createdMessageIds.Contains(field.FildRelted))
        .ToListAsync();

    var fieldsByMessage = fields
        .GroupBy(field => field.FildRelted)
        .ToDictionary(group => group.Key, group => group.ToList());

    var categories = await connectContext.Cdcategories
        .AsNoTracking()
        .Where(category => summerCategoryIds.Contains(category.CatId))
        .ToDictionaryAsync(category => category.CatId, category => (category.CatName ?? string.Empty).Trim());

    var byDestination = messages
        .GroupBy(message => message.CategoryCd)
        .ToDictionary(
            group => categories.TryGetValue(group.Key, out var name) && name.Length > 0
                ? name
                : group.Key.ToString(CultureInfo.InvariantCulture),
            group => group.Count());

    var byWave = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
    var byFamilyCount = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
    var byStatus = messages
        .GroupBy(message => message.Status)
        .ToDictionary(group => group.Key.ToString(), group => group.Count());

    var proxyCount = 0;
    var invalidMessages = new List<string>();

    var validWavesByCategory = destinationCatalog
        .ToDictionary(
            destination => destination.CategoryId,
            destination => destination.Waves
                .Select(wave => wave.Code)
                .Where(code => !string.IsNullOrWhiteSpace(code))
                .ToHashSet(StringComparer.OrdinalIgnoreCase));

    var validFamiliesByCategory = destinationCatalog
        .ToDictionary(
            destination => destination.CategoryId,
            destination => destination.Apartments
                .Where(item => item.FamilyCount > 0)
                .Select(item => item.FamilyCount)
                .ToHashSet());

    foreach (var message in messages)
    {
        fieldsByMessage.TryGetValue(message.MessageId, out var messageFields);
        messageFields ??= new List<TkmendField>();

        var waveCode = FirstFieldValue(messageFields, SummerWorkflowDomainConstants.WaveCodeFieldKinds);
        var familyText = FirstFieldValue(messageFields, SummerWorkflowDomainConstants.FamilyCountFieldKinds);
        var familyCount = int.TryParse(familyText, out var parsedFamily) ? parsedFamily : 0;
        var proxyText = FirstFieldValue(messageFields, SummerWorkflowDomainConstants.ProxyModeFieldKinds);
        var destinationIdText = FirstFieldValue(messageFields, SummerWorkflowDomainConstants.DestinationIdFieldKinds);

        var waveKey = string.IsNullOrWhiteSpace(waveCode)
            ? "-"
            : waveCode.Trim();
        byWave[waveKey] = byWave.TryGetValue(waveKey, out var waveCount)
            ? waveCount + 1
            : 1;

        var familyKey = familyCount > 0
            ? familyCount.ToString(CultureInfo.InvariantCulture)
            : "-";
        byFamilyCount[familyKey] = byFamilyCount.TryGetValue(familyKey, out var familyCountValue)
            ? familyCountValue + 1
            : 1;

        if (ParseBool(proxyText))
        {
            proxyCount += 1;
        }

        if (string.IsNullOrWhiteSpace(waveCode)
            || familyCount <= 0
            || !validWavesByCategory.TryGetValue(message.CategoryCd, out var validWaves)
            || !validWaves.Contains(waveCode)
            || !validFamiliesByCategory.TryGetValue(message.CategoryCd, out var validFamilies)
            || !validFamilies.Contains(familyCount))
        {
            invalidMessages.Add($"Invalid destination/wave/family mapping for MessageID={message.MessageId}");
        }

        if (int.TryParse(destinationIdText, out var destinationFromField)
            && destinationFromField > 0
            && destinationFromField != message.CategoryCd)
        {
            invalidMessages.Add($"Destination field mismatch for MessageID={message.MessageId}: Field={destinationFromField}, CategoryCd={message.CategoryCd}");
        }
    }

    var slotUsage = messages
        .Select(message =>
        {
            fieldsByMessage.TryGetValue(message.MessageId, out var messageFields);
            messageFields ??= new List<TkmendField>();
            var waveCode = FirstFieldValue(messageFields, SummerWorkflowDomainConstants.WaveCodeFieldKinds);
            var familyText = FirstFieldValue(messageFields, SummerWorkflowDomainConstants.FamilyCountFieldKinds);
            var familyCount = int.TryParse(familyText, out var parsedFamily) ? parsedFamily : 0;
            return new { message.CategoryCd, WaveCode = waveCode, FamilyCount = familyCount };
        })
        .Where(item => !string.IsNullOrWhiteSpace(item.WaveCode) && item.FamilyCount > 0)
        .GroupBy(item => new CapacitySlot(item.CategoryCd, item.WaveCode, item.FamilyCount))
        .ToDictionary(group => group.Key, group => group.Count());

    var capacityViolations = new List<string>();
    foreach (var destination in destinationCatalog)
    {
        var capacityByFamily = destination.Apartments
            .Where(item => item.FamilyCount > 0)
            .ToDictionary(item => item.FamilyCount, item => item.Apartments);

        foreach (var wave in destination.Waves)
        {
            foreach (var family in capacityByFamily)
            {
                var slot = new CapacitySlot(destination.CategoryId, wave.Code, family.Key);
                if (!slotUsage.TryGetValue(slot, out var used))
                {
                    continue;
                }

                if (used > family.Value)
                {
                    capacityViolations.Add(
                        $"Capacity exceeded at {destination.CategoryId}/{wave.Code}/{family.Key}: used={used}, total={family.Value}");
                }
            }
        }
    }

    var orphanChecks = await CaptureOrphanChecksAsync(connectContext, summerCategoryIds);

    var sampleRows = messages
        .Take(10)
        .Select(message =>
        {
            fieldsByMessage.TryGetValue(message.MessageId, out var messageFields);
            messageFields ??= new List<TkmendField>();
            return new VerificationSample
            {
                MessageId = message.MessageId,
                RequestRef = message.RequestRef ?? string.Empty,
                CategoryId = message.CategoryCd,
                CategoryName = categories.TryGetValue(message.CategoryCd, out var categoryName) ? categoryName : string.Empty,
                WaveCode = FirstFieldValue(messageFields, SummerWorkflowDomainConstants.WaveCodeFieldKinds),
                FamilyCount = ParseIntSafe(FirstFieldValue(messageFields, SummerWorkflowDomainConstants.FamilyCountFieldKinds)),
                Proxy = ParseBool(FirstFieldValue(messageFields, SummerWorkflowDomainConstants.ProxyModeFieldKinds)),
                Status = message.Status.ToString()
            };
        })
        .ToList();

    return new VerificationReport
    {
        CreatedCount = createdMessageIds.Count,
        ByDestination = byDestination,
        ByWave = byWave,
        ByFamilyCount = byFamilyCount,
        ByStatus = byStatus,
        ProxyBookingsCount = proxyCount,
        InvalidRecords = invalidMessages,
        CapacityViolations = capacityViolations,
        OrphanChecks = orphanChecks,
        Samples = sampleRows
    };
}

static string FirstFieldValue(IEnumerable<TkmendField> fields, IEnumerable<string> aliases)
{
    foreach (var alias in aliases)
    {
        if (string.IsNullOrWhiteSpace(alias))
        {
            continue;
        }

        var found = fields.FirstOrDefault(field => string.Equals(field.FildKind, alias, StringComparison.OrdinalIgnoreCase));
        if (found != null)
        {
            var value = (found.FildTxt ?? string.Empty).Trim();
            if (value.Length > 0)
            {
                return value;
            }
        }
    }

    return string.Empty;
}

static bool ParseBool(string? value)
{
    var normalized = (value ?? string.Empty).Trim();
    if (normalized.Length == 0)
    {
        return false;
    }

    return normalized.Equals("true", StringComparison.OrdinalIgnoreCase)
           || normalized.Equals("1", StringComparison.OrdinalIgnoreCase)
           || normalized.Equals("yes", StringComparison.OrdinalIgnoreCase)
           || normalized.Equals("y", StringComparison.OrdinalIgnoreCase)
           || normalized.Equals("نعم", StringComparison.OrdinalIgnoreCase);
}

static int ParseIntSafe(string? value)
{
    return int.TryParse((value ?? string.Empty).Trim(), out var parsed) ? parsed : 0;
}

static string NormalizeNationalId(string? value, string fallbackSeed)
{
    var digits = new string((value ?? string.Empty).Where(char.IsDigit).ToArray());
    if (digits.Length >= 14)
    {
        return digits[..14];
    }

    var fallbackDigits = new string((fallbackSeed ?? string.Empty).Where(char.IsDigit).ToArray());
    if (fallbackDigits.Length == 0)
    {
        fallbackDigits = "99999999999999";
    }

    var combined = (digits + fallbackDigits + "00000000000000");
    return combined[..14];
}

static string NormalizePhone(string? value, string prefix)
{
    var digits = new string((value ?? string.Empty).Where(char.IsDigit).ToArray());
    if (digits.Length >= 11)
    {
        return digits[..11];
    }

    var fallback = (prefix + "00000000");
    var merged = (digits + fallback);
    return merged[..11];
}

static string BuildCompanionNationalId(int requestNumber)
{
    var baseText = $"30101{requestNumber:000000000}";
    return baseText[..14];
}

static T PickWeighted<T>(IReadOnlyList<T> items, Func<T, double> weightSelector, Random random)
{
    if (items.Count == 0)
    {
        throw new InvalidOperationException("Cannot select from an empty set.");
    }

    var total = 0d;
    var weights = new double[items.Count];

    for (var i = 0; i < items.Count; i += 1)
    {
        var weight = Math.Max(0d, weightSelector(items[i]));
        weights[i] = weight;
        total += weight;
    }

    if (total <= 0d)
    {
        return items[random.Next(items.Count)];
    }

    var roll = random.NextDouble() * total;
    var running = 0d;
    for (var i = 0; i < items.Count; i += 1)
    {
        running += weights[i];
        if (roll <= running)
        {
            return items[i];
        }
    }

    return items[^1];
}

internal sealed class StaticOptionsMonitor<T> : IOptionsMonitor<T>
{
    private readonly T _value;

    public StaticOptionsMonitor(T value)
    {
        _value = value;
    }

    public T CurrentValue => _value;

    public T Get(string? name) => _value;

    public IDisposable OnChange(Action<T, string?> listener)
    {
        return new NoopDisposable();
    }

    private sealed class NoopDisposable : IDisposable
    {
        public void Dispose()
        {
        }
    }
}

internal sealed class NoopNotificationService : IConnectNotificationService
{
    private static Task<CommonResponse<bool>> Success()
    {
        return Task.FromResult(new CommonResponse<bool> { Data = true });
    }

    public string RenderTemplate(string? template, IReadOnlyDictionary<string, string?> placeholders)
    {
        return template ?? string.Empty;
    }

    public Task<CommonResponse<bool>> SendSmsAsync(SmsDispatchRequest request, CancellationToken cancellationToken = default)
    {
        return Success();
    }

    public Task<CommonResponse<bool>> SendSmsByMultiMessagesAsync(SmsDispatchRequest request, CancellationToken cancellationToken = default)
    {
        return Success();
    }

    public Task<CommonResponse<bool>> SendSignalRToUserAsync(SignalRDispatchRequest request, CancellationToken cancellationToken = default)
    {
        return Success();
    }

    public Task<CommonResponse<bool>> SendSignalRToGroupAsync(SignalRGroupDispatchRequest request, CancellationToken cancellationToken = default)
    {
        return Success();
    }

    public Task<CommonResponse<bool>> SendSignalRToGroupsAsync(SignalRGroupsDispatchRequest request, CancellationToken cancellationToken = default)
    {
        return Success();
    }

    public Task<CommonResponse<bool>> SendWhatsAppAsync(WhatsAppDispatchRequest request, CancellationToken cancellationToken = default)
    {
        return Success();
    }

    public Task<CommonResponse<bool>> SendEmailAsync(EmailDispatchRequest request, CancellationToken cancellationToken = default)
    {
        return Success();
    }
}

internal sealed class DestinationCatalogPayload
{
    public int SeasonYear { get; set; }
    public List<SummerDestinationConfigDto>? Destinations { get; set; }
}

internal sealed record CapacitySlot(int CategoryId, string WaveCode, int FamilyCount);
internal sealed record OwnerSeed(string FileNumber, string Name, string NationalId, string Phone, string ExtraPhone);
internal sealed record RequestAssignment(int CategoryId, string WaveCode, int FamilyCount);

internal sealed class SeedRunnerOptions
{
    public int TotalRequests { get; set; } = 500;
    public int RandomSeed { get; set; } = 20260402;
    public int SeasonYear { get; set; } = SummerWorkflowDomainConstants.DefaultSeasonYear;
    public bool DryRun { get; set; }
    public bool WipeExistingFirst { get; set; } = true;
    public double ProxyRatio { get; set; } = 0.12;
    public double IncludeCompanionsRatio { get; set; } = 0.35;
    public string ReportPath { get; set; } = string.Empty;
    public Dictionary<int, double> DestinationWeights { get; set; } = new();

    public static SeedRunnerOptions Parse(string[] args)
    {
        var options = new SeedRunnerOptions();
        foreach (var raw in args ?? Array.Empty<string>())
        {
            if (string.IsNullOrWhiteSpace(raw) || !raw.StartsWith("--", StringComparison.Ordinal))
            {
                continue;
            }

            var index = raw.IndexOf('=');
            var key = index > 0 ? raw[2..index] : raw[2..];
            var value = index > 0 ? raw[(index + 1)..] : "true";
            key = key.Trim();
            value = value.Trim();

            switch (key.ToLowerInvariant())
            {
                case "totalrequests":
                    if (int.TryParse(value, out var total) && total > 0)
                    {
                        options.TotalRequests = total;
                    }
                    break;
                case "randomseed":
                    if (int.TryParse(value, out var seed))
                    {
                        options.RandomSeed = seed;
                    }
                    break;
                case "seasonyear":
                    if (int.TryParse(value, out var season) && season > 0)
                    {
                        options.SeasonYear = season;
                    }
                    break;
                case "proxyratio":
                    if (double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var proxy)
                        && proxy >= 0d
                        && proxy <= 1d)
                    {
                        options.ProxyRatio = proxy;
                    }
                    break;
                case "includecompanionsratio":
                    if (double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var companions)
                        && companions >= 0d
                        && companions <= 1d)
                    {
                        options.IncludeCompanionsRatio = companions;
                    }
                    break;
                case "dryrun":
                    options.DryRun = ParseOptionBool(value);
                    break;
                case "wipeexistingfirst":
                    options.WipeExistingFirst = ParseOptionBool(value);
                    break;
                case "reportpath":
                    options.ReportPath = value;
                    break;
                case "destinationweights":
                    options.DestinationWeights = ParseWeights(value);
                    break;
            }
        }

        return options;
    }

    private static Dictionary<int, double> ParseWeights(string value)
    {
        var result = new Dictionary<int, double>();
        var chunks = (value ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        foreach (var chunk in chunks)
        {
            var pair = chunk.Split(':', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            if (pair.Length != 2)
            {
                continue;
            }

            if (!int.TryParse(pair[0], out var categoryId) || categoryId <= 0)
            {
                continue;
            }

            if (!double.TryParse(pair[1], NumberStyles.Float, CultureInfo.InvariantCulture, out var weight)
                || weight <= 0d)
            {
                continue;
            }

            result[categoryId] = weight;
        }

        return result;
    }

    private static bool ParseOptionBool(string? value)
    {
        var normalized = (value ?? string.Empty).Trim();
        if (normalized.Length == 0)
        {
            return false;
        }

        return normalized.Equals("true", StringComparison.OrdinalIgnoreCase)
               || normalized.Equals("1", StringComparison.OrdinalIgnoreCase)
               || normalized.Equals("yes", StringComparison.OrdinalIgnoreCase)
               || normalized.Equals("y", StringComparison.OrdinalIgnoreCase)
               || normalized.Equals("نعم", StringComparison.OrdinalIgnoreCase);
    }
}

internal sealed class SeedExecutionReport
{
    public DateTime GeneratedAtUtc { get; set; }
    public SeedRunnerOptions Options { get; set; } = new();
    public string BackupPath { get; set; } = string.Empty;
    public ReviewSnapshot Review { get; set; } = new();
    public CleanupReport Cleanup { get; set; } = new();
    public SeedPlanReport Plan { get; set; } = new();
    public ExecutionResult Result { get; set; } = new();
    public VerificationReport Verification { get; set; } = new();
}

internal sealed class ReviewSnapshot
{
    public List<ReviewCategory> SummerCategories { get; set; } = new();
    public List<ReviewCategoryField> CategoryFields { get; set; } = new();
    public List<string> AppliedMigrations { get; set; } = new();
    public ReviewCatalogRow? DestinationCatalog { get; set; }
    public ReviewCatalogRow? PricingCatalog { get; set; }
}

internal sealed class ReviewCategory
{
    public int CategoryId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int ParentCategoryId { get; set; }
    public int? Stockholder { get; set; }
}

internal sealed class ReviewCategoryField
{
    public int CategoryId { get; set; }
    public string FieldKind { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public bool Required { get; set; }
    public string FieldType { get; set; } = string.Empty;
    public int GroupId { get; set; }
}

internal sealed class ReviewCatalogRow
{
    public string Key { get; set; } = string.Empty;
    public string ApplicationId { get; set; } = string.Empty;
    public string FieldType { get; set; } = string.Empty;
    public string DataType { get; set; } = string.Empty;
    public int PayloadLength { get; set; }
}

internal sealed class CleanupReport
{
    public bool WipeExistingFirst { get; set; }
    public Dictionary<string, int> BeforeCounts { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, int> AfterDeleteCounts { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, int> AfterSeedCounts { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public List<string> OrphanChecksAfterDelete { get; set; } = new();
}

internal sealed class SeedPlanReport
{
    public int SeasonYear { get; set; }
    public int RandomSeed { get; set; }
    public int TotalRequests { get; set; }
    public int BaselineCoverageCount { get; set; }
    public List<RequestAssignment> Assignments { get; set; } = new();
    public Dictionary<string, int> ByDestination { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, int> ByWave { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, int> ByFamily { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, int> RemainingCapacityBySlot { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

internal sealed class ExecutionResult
{
    public int CreatedMessagesCount { get; set; }
    public List<int> CreatedMessageIdsSample { get; set; } = new();
    public List<string> Errors { get; set; } = new();
}

internal sealed class VerificationReport
{
    public int CreatedCount { get; set; }
    public Dictionary<string, int> ByDestination { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, int> ByWave { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, int> ByFamilyCount { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, int> ByStatus { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public int ProxyBookingsCount { get; set; }
    public List<string> InvalidRecords { get; set; } = new();
    public List<string> CapacityViolations { get; set; } = new();
    public List<string> OrphanChecks { get; set; } = new();
    public List<VerificationSample> Samples { get; set; } = new();
}

internal sealed class VerificationSample
{
    public int MessageId { get; set; }
    public string RequestRef { get; set; } = string.Empty;
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public string WaveCode { get; set; } = string.Empty;
    public int FamilyCount { get; set; }
    public bool Proxy { get; set; }
    public string Status { get; set; } = string.Empty;
}
