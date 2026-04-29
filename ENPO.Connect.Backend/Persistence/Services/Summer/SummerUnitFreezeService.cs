using System.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Logging;
using Models.Correspondance;
using Models.DTO.Correspondance.Enums;
using Persistence.Data;

namespace Persistence.Services.Summer;

public class SummerUnitFreezeService
{
    private readonly ConnectContext _connectContext;
    private readonly ILogger? _logger;
    private const int CapacityLockTimeoutMs = 15000;

    public SummerUnitFreezeService(ConnectContext connectContext, ILogger? logger = null)
    {
        _connectContext = connectContext;
        _logger = logger;
    }

    public async Task<int> CountUsedUnitsAsync(
        int categoryId,
        string waveCode,
        int familyCount,
        int? excludedMessageId = null,
        CancellationToken cancellationToken = default)
    {
        if (categoryId <= 0 || familyCount <= 0 || string.IsNullOrWhiteSpace(waveCode))
        {
            return 0;
        }

        var activeMessageIds = await GetActiveMessageIdsForWaveAsync(categoryId, waveCode, excludedMessageId, cancellationToken);
        if (activeMessageIds.Count == 0)
        {
            return 0;
        }

        var familyFields = await _connectContext.TkmendFields
            .AsNoTracking()
            .Where(field => activeMessageIds.Contains(field.FildRelted)
                            && (field.FildKind == "FamilyCount" || field.FildKind == "SUM2026_FamilyCount"))
            .ToListAsync(cancellationToken);

        return familyFields
            .Where(field => ParseInt(field.FildTxt) == familyCount)
            .Select(field => field.FildRelted)
            .Distinct()
            .Count();
    }

    public Task<int> CountActiveFrozenAvailableUnitsAsync(
        int categoryId,
        string waveCode,
        int familyCount,
        CancellationToken cancellationToken = default)
    {
        if (categoryId <= 0 || familyCount <= 0 || string.IsNullOrWhiteSpace(waveCode))
        {
            return Task.FromResult(0);
        }

        var normalizedWaveCode = NormalizeWaveCode(waveCode);
        return _connectContext.SummerUnitFreezeDetails
            .AsNoTracking()
            .Where(detail => detail.Status == SummerUnitFreezeStatuses.FrozenAvailable
                             && detail.AssignedMessageId == null
                             && detail.Freeze.IsActive
                             && detail.Freeze.CategoryId == categoryId
                             && detail.Freeze.WaveCode == normalizedWaveCode
                             && detail.Freeze.FamilyCount == familyCount)
            .CountAsync(cancellationToken);
    }

    public Task<int> CountActiveFrozenAssignedUnitsAsync(
        int categoryId,
        string waveCode,
        int familyCount,
        CancellationToken cancellationToken = default)
    {
        if (categoryId <= 0 || familyCount <= 0 || string.IsNullOrWhiteSpace(waveCode))
        {
            return Task.FromResult(0);
        }

        var normalizedWaveCode = NormalizeWaveCode(waveCode);
        return _connectContext.SummerUnitFreezeDetails
            .AsNoTracking()
            .Where(detail => detail.Status == SummerUnitFreezeStatuses.Booked
                             && detail.AssignedMessageId != null
                             && detail.Freeze.IsActive
                             && detail.Freeze.CategoryId == categoryId
                             && detail.Freeze.WaveCode == normalizedWaveCode
                             && detail.Freeze.FamilyCount == familyCount)
            .CountAsync(cancellationToken);
    }

    public async Task<Dictionary<int, int>> CountActiveFrozenAvailableByFamilyAsync(
        int categoryId,
        string waveCode,
        CancellationToken cancellationToken = default)
    {
        if (categoryId <= 0 || string.IsNullOrWhiteSpace(waveCode))
        {
            return new Dictionary<int, int>();
        }

        var normalizedWaveCode = NormalizeWaveCode(waveCode);
        return await _connectContext.SummerUnitFreezeDetails
            .AsNoTracking()
            .Where(detail => detail.Status == SummerUnitFreezeStatuses.FrozenAvailable
                             && detail.AssignedMessageId == null
                             && detail.Freeze.IsActive
                             && detail.Freeze.CategoryId == categoryId
                             && detail.Freeze.WaveCode == normalizedWaveCode)
            .GroupBy(detail => detail.Freeze.FamilyCount)
            .Select(group => new
            {
                FamilyCount = group.Key,
                Units = group.Count()
            })
            .ToDictionaryAsync(item => item.FamilyCount, item => item.Units, cancellationToken);
    }

    public async Task<int> CalculatePublicAvailableUnitsAsync(
        int categoryId,
        string waveCode,
        int familyCount,
        int totalUnits,
        int? excludedMessageId = null,
        CancellationToken cancellationToken = default)
    {
        if (totalUnits <= 0)
        {
            return 0;
        }

        var usedUnits = await CountUsedUnitsAsync(categoryId, waveCode, familyCount, excludedMessageId, cancellationToken);
        var frozenAvailableUnits = await CountActiveFrozenAvailableUnitsAsync(categoryId, waveCode, familyCount, cancellationToken);
        return Math.Max(0, totalUnits - usedUnits - frozenAvailableUnits);
    }

    public async Task<bool> HasPublicCapacityAsync(
        int categoryId,
        string waveCode,
        int familyCount,
        int totalUnits,
        int? excludedMessageId = null,
        CancellationToken cancellationToken = default)
    {
        var availableUnits = await CalculatePublicAvailableUnitsAsync(
            categoryId,
            waveCode,
            familyCount,
            totalUnits,
            excludedMessageId,
            cancellationToken);

        return availableUnits > 0;
    }

    public async Task<bool> HasAssignableFrozenUnitAsync(
        int categoryId,
        string waveCode,
        int familyCount,
        CancellationToken cancellationToken = default)
    {
        return await CountActiveFrozenAvailableUnitsAsync(categoryId, waveCode, familyCount, cancellationToken) > 0;
    }

    public async Task<bool> TryAssignFrozenUnitAsync(
        int categoryId,
        string waveCode,
        int familyCount,
        int messageId,
        string assignedBy,
        CancellationToken cancellationToken = default)
    {
        if (messageId <= 0 || categoryId <= 0 || familyCount <= 0 || string.IsNullOrWhiteSpace(waveCode))
        {
            return false;
        }

        var normalizedWaveCode = NormalizeWaveCode(waveCode);
        var existingAssignments = await _connectContext.SummerUnitFreezeDetails
            .Include(detail => detail.Freeze)
            .Where(detail => detail.AssignedMessageId == messageId
                             && detail.Status == SummerUnitFreezeStatuses.Booked)
            .ToListAsync(cancellationToken);

        if (existingAssignments.Count > 0)
        {
            var hasMatchingAssignment = existingAssignments.Any(detail =>
                detail.Freeze.IsActive
                && detail.Freeze.CategoryId == categoryId
                && detail.Freeze.WaveCode == normalizedWaveCode
                && detail.Freeze.FamilyCount == familyCount);
            if (hasMatchingAssignment)
            {
                return true;
            }

            var normalizedAssignedBy = string.IsNullOrWhiteSpace(assignedBy) ? "SYSTEM" : assignedBy.Trim();
            var transitionAtUtc = DateTime.UtcNow;
            foreach (var existing in existingAssignments)
            {
                existing.AssignedMessageId = null;
                existing.AssignedAtUtc = null;
                existing.LastStatusChangedAtUtc = transitionAtUtc;
                if (existing.Freeze.IsActive)
                {
                    existing.Status = SummerUnitFreezeStatuses.FrozenAvailable;
                    existing.ReleasedAtUtc = null;
                    existing.ReleasedBy = null;
                }
                else
                {
                    existing.Status = SummerUnitFreezeStatuses.Released;
                    existing.ReleasedAtUtc = transitionAtUtc;
                    existing.ReleasedBy = normalizedAssignedBy;
                }
            }
        }

        var candidate = await _connectContext.SummerUnitFreezeDetails
            .Where(detail => detail.Status == SummerUnitFreezeStatuses.FrozenAvailable
                             && detail.AssignedMessageId == null
                             && detail.Freeze.IsActive
                             && detail.Freeze.CategoryId == categoryId
                             && detail.Freeze.WaveCode == normalizedWaveCode
                             && detail.Freeze.FamilyCount == familyCount)
            .OrderBy(detail => detail.Freeze.CreatedAtUtc)
            .ThenBy(detail => detail.SlotNumber)
            .FirstOrDefaultAsync(cancellationToken);

        if (candidate == null)
        {
            return false;
        }

        var nowUtc = DateTime.UtcNow;
        candidate.Status = SummerUnitFreezeStatuses.Booked;
        candidate.AssignedMessageId = messageId;
        candidate.AssignedAtUtc = nowUtc;
        candidate.ReleasedAtUtc = null;
        candidate.ReleasedBy = string.IsNullOrWhiteSpace(assignedBy) ? null : assignedBy.Trim();
        candidate.LastStatusChangedAtUtc = nowUtc;
        return true;
    }

    public async Task<int> ReleaseAssignmentsForMessageAsync(
        int messageId,
        string releasedBy,
        CancellationToken cancellationToken = default)
    {
        if (messageId <= 0)
        {
            return 0;
        }

        var assignments = await _connectContext.SummerUnitFreezeDetails
            .Include(detail => detail.Freeze)
            .Where(detail => detail.AssignedMessageId == messageId
                             && detail.Status == SummerUnitFreezeStatuses.Booked)
            .ToListAsync(cancellationToken);

        if (assignments.Count == 0)
        {
            return 0;
        }

        var releasedByValue = string.IsNullOrWhiteSpace(releasedBy) ? "SYSTEM" : releasedBy.Trim();
        var nowUtc = DateTime.UtcNow;
        foreach (var assignment in assignments)
        {
            assignment.AssignedMessageId = null;
            assignment.AssignedAtUtc = null;
            assignment.LastStatusChangedAtUtc = nowUtc;

            if (assignment.Freeze.IsActive)
            {
                assignment.Status = SummerUnitFreezeStatuses.FrozenAvailable;
                assignment.ReleasedAtUtc = null;
                assignment.ReleasedBy = null;
            }
            else
            {
                assignment.Status = SummerUnitFreezeStatuses.Released;
                assignment.ReleasedAtUtc = nowUtc;
                assignment.ReleasedBy = releasedByValue;
            }
        }

        return assignments.Count;
    }

    public Task<bool> IsMessageAssignedToFrozenUnitAsync(int messageId, CancellationToken cancellationToken = default)
    {
        if (messageId <= 0)
        {
            return Task.FromResult(false);
        }

        return _connectContext.SummerUnitFreezeDetails
            .AsNoTracking()
            .AnyAsync(detail => detail.AssignedMessageId == messageId
                                && detail.Status == SummerUnitFreezeStatuses.Booked,
                cancellationToken);
    }

    public async Task<(bool Success, SummerUnitFreezeBatch? Batch, string? ErrorCode, string? ErrorMessage)> CreateFreezeBatchAsync(
        int categoryId,
        string waveCode,
        int familyCount,
        int requestedUnitsCount,
        int totalUnits,
        string freezeType,
        string? reason,
        string? notes,
        string createdBy,
        string? requestTraceId = null,
        CancellationToken cancellationToken = default)
    {
        var traceId = string.IsNullOrWhiteSpace(requestTraceId) ? Guid.NewGuid().ToString("N") : requestTraceId.Trim();
        _logger?.LogInformation(
            "Unit-freeze create flow started in freeze service. TraceId={TraceId}, CategoryId={CategoryId}, WaveCode={WaveCode}, FamilyCount={FamilyCount}, RequestedUnitsCount={RequestedUnitsCount}",
            traceId,
            categoryId,
            waveCode,
            familyCount,
            requestedUnitsCount);

        if (categoryId <= 0 || familyCount <= 0 || requestedUnitsCount <= 0 || totalUnits <= 0 || string.IsNullOrWhiteSpace(waveCode))
        {
            _logger?.LogWarning(
                "Unit-freeze create validation failed in freeze service. TraceId={TraceId}, CategoryId={CategoryId}, WaveCode={WaveCode}, FamilyCount={FamilyCount}, RequestedUnitsCount={RequestedUnitsCount}, TotalUnits={TotalUnits}",
                traceId,
                categoryId,
                waveCode,
                familyCount,
                requestedUnitsCount,
                totalUnits);
            return (false, null, "400", "بيانات التجميد غير مكتملة.");
        }

        var normalizedWaveCode = NormalizeWaveCode(waveCode);
        var normalizedCreatedBy = string.IsNullOrWhiteSpace(createdBy) ? "SYSTEM" : createdBy.Trim();
        var normalizedFreezeType = string.IsNullOrWhiteSpace(freezeType) ? "GENERAL" : freezeType.Trim().ToUpperInvariant();
        var normalizedReason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        var normalizedNotes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();

        await using var transaction = await _connectContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        try
        {
            _logger?.LogInformation(
                "Before creating freeze batch entity. TraceId={TraceId}, CategoryId={CategoryId}, WaveCode={WaveCode}, FamilyCount={FamilyCount}",
                traceId,
                categoryId,
                normalizedWaveCode,
                familyCount);

            if (!await TryAcquireCapacityLockAsync(categoryId, normalizedWaveCode, cancellationToken))
            {
                await transaction.RollbackAsync(cancellationToken);
                _logger?.LogWarning(
                    "Capacity lock acquisition failed during freeze creation. TraceId={TraceId}, CategoryId={CategoryId}, WaveCode={WaveCode}",
                    traceId,
                    categoryId,
                    normalizedWaveCode);
                return (false, null, "409", "تعذر تنفيذ التجميد حالياً بسبب حفظ متزامن. برجاء إعادة المحاولة بعد ثوانٍ.");
            }

            var availableUnits = await CalculatePublicAvailableUnitsAsync(
                categoryId,
                normalizedWaveCode,
                familyCount,
                totalUnits,
                excludedMessageId: null,
                cancellationToken: cancellationToken);

            if (requestedUnitsCount > availableUnits)
            {
                await transaction.RollbackAsync(cancellationToken);
                _logger?.LogWarning(
                    "Requested freeze units exceed available public units. TraceId={TraceId}, RequestedUnitsCount={RequestedUnitsCount}, AvailableUnits={AvailableUnits}, CategoryId={CategoryId}, WaveCode={WaveCode}, FamilyCount={FamilyCount}",
                    traceId,
                    requestedUnitsCount,
                    availableUnits,
                    categoryId,
                    normalizedWaveCode,
                    familyCount);
                return (false, null, "409", "عدد الوحدات المطلوب تجميده أكبر من المتاح حالياً.");
            }

            var nowUtc = DateTime.UtcNow;
            var batch = new SummerUnitFreezeBatch
            {
                CategoryId = categoryId,
                WaveCode = normalizedWaveCode,
                FamilyCount = familyCount,
                RequestedUnitsCount = requestedUnitsCount,
                FreezeType = normalizedFreezeType,
                Reason = normalizedReason,
                Notes = normalizedNotes,
                CreatedBy = normalizedCreatedBy,
                CreatedAtUtc = nowUtc,
                IsActive = true
            };

            await _connectContext.SummerUnitFreezeBatches.AddAsync(batch, cancellationToken);
            await _connectContext.SaveChangesAsync(cancellationToken);
            _logger?.LogInformation(
                "After saving freeze batch. TraceId={TraceId}, FreezeId={FreezeId}, CategoryId={CategoryId}, WaveCode={WaveCode}, FamilyCount={FamilyCount}, RequestedUnitsCount={RequestedUnitsCount}",
                traceId,
                batch.FreezeId,
                batch.CategoryId,
                batch.WaveCode,
                batch.FamilyCount,
                batch.RequestedUnitsCount);

            var details = Enumerable.Range(1, requestedUnitsCount)
                .Select(slotNumber => new SummerUnitFreezeDetail
                {
                    FreezeId = batch.FreezeId,
                    SlotNumber = slotNumber,
                    Status = SummerUnitFreezeStatuses.FrozenAvailable,
                    AssignedMessageId = null,
                    AssignedAtUtc = null,
                    ReleasedAtUtc = null,
                    ReleasedBy = null,
                    LastStatusChangedAtUtc = nowUtc
                })
                .ToList();

            if (details.Count > 0)
            {
                await _connectContext.SummerUnitFreezeDetails.AddRangeAsync(details, cancellationToken);
            }

            await _connectContext.SaveChangesAsync(cancellationToken);
            _logger?.LogInformation(
                "After saving freeze detail records. TraceId={TraceId}, FreezeId={FreezeId}, DetailsCount={DetailsCount}",
                traceId,
                batch.FreezeId,
                details.Count);

            _logger?.LogInformation(
                "Before committing freeze transaction. TraceId={TraceId}, FreezeId={FreezeId}",
                traceId,
                batch.FreezeId);
            await transaction.CommitAsync(cancellationToken);
            _logger?.LogInformation(
                "Freeze transaction committed successfully. TraceId={TraceId}, FreezeId={FreezeId}",
                traceId,
                batch.FreezeId);

            return (true, batch, null, null);
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync(cancellationToken);
            _logger?.LogError(
                ex,
                "Freeze create flow failed and transaction rolled back. TraceId={TraceId}, CategoryId={CategoryId}, WaveCode={WaveCode}, FamilyCount={FamilyCount}, RequestedUnitsCount={RequestedUnitsCount}",
                traceId,
                categoryId,
                normalizedWaveCode,
                familyCount,
                requestedUnitsCount);
            throw;
        }
        finally
        {
            _logger?.LogInformation(
                "Unit-freeze create flow ended in freeze service. TraceId={TraceId}",
                traceId);
        }
    }

    public async Task<(bool Success, SummerUnitFreezeBatch? Batch, string? ErrorCode, string? ErrorMessage)> ReleaseFreezeBatchAsync(
        int freezeId,
        string releasedBy,
        CancellationToken cancellationToken = default)
    {
        if (freezeId <= 0)
        {
            return (false, null, "400", "رقم التجميد مطلوب.");
        }

        await using var transaction = await _connectContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        try
        {
            var batch = await _connectContext.SummerUnitFreezeBatches
                .Include(item => item.Details)
                .FirstOrDefaultAsync(item => item.FreezeId == freezeId, cancellationToken);

            if (batch == null)
            {
                await transaction.RollbackAsync(cancellationToken);
                return (false, null, "404", "عملية التجميد غير موجودة.");
            }

            if (batch.IsActive && !await TryAcquireCapacityLockAsync(batch.CategoryId, batch.WaveCode, cancellationToken))
            {
                await transaction.RollbackAsync(cancellationToken);
                return (false, null, "409", "تعذر تنفيذ فك التجميد حالياً بسبب حفظ متزامن. برجاء إعادة المحاولة بعد ثوانٍ.");
            }

            if (!batch.IsActive)
            {
                await transaction.RollbackAsync(cancellationToken);
                return (true, batch, null, null);
            }

            var normalizedReleasedBy = string.IsNullOrWhiteSpace(releasedBy) ? "SYSTEM" : releasedBy.Trim();
            var nowUtc = DateTime.UtcNow;

            batch.IsActive = false;
            batch.ReleasedAtUtc = nowUtc;
            batch.ReleasedBy = normalizedReleasedBy;

            foreach (var detail in batch.Details)
            {
                if (detail.Status == SummerUnitFreezeStatuses.FrozenAvailable && detail.AssignedMessageId == null)
                {
                    detail.Status = SummerUnitFreezeStatuses.Released;
                    detail.ReleasedAtUtc = nowUtc;
                    detail.ReleasedBy = normalizedReleasedBy;
                    detail.LastStatusChangedAtUtc = nowUtc;
                }
            }

            await _connectContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return (true, batch, null, null);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public IQueryable<SummerUnitFreezeBatch> BuildFreezeBatchesQuery()
    {
        return _connectContext.SummerUnitFreezeBatches;
    }

    private async Task<List<int>> GetActiveMessageIdsForWaveAsync(
        int categoryId,
        string waveCode,
        int? excludedMessageId,
        CancellationToken cancellationToken)
    {
        var normalizedWaveCode = NormalizeWaveCode(waveCode);
        if (normalizedWaveCode.Length == 0)
        {
            return new List<int>();
        }

        var matchingWaveMessageIds = await _connectContext.TkmendFields
            .AsNoTracking()
            .Where(field => (field.FildKind == "SummerCamp" || field.FildKind == "SUM2026_WaveCode" || field.FildKind == "WaveCode")
                            && field.FildTxt == normalizedWaveCode)
            .Select(field => field.FildRelted)
            .Distinct()
            .ToListAsync(cancellationToken);

        if (matchingWaveMessageIds.Count == 0)
        {
            return new List<int>();
        }

        var query = _connectContext.Messages
            .AsNoTracking()
            .Where(message => matchingWaveMessageIds.Contains(message.MessageId)
                              && message.CategoryCd == categoryId
                              && message.Status != MessageStatus.Rejected);

        if (excludedMessageId.HasValue)
        {
            query = query.Where(message => message.MessageId != excludedMessageId.Value);
        }

        return await query
            .Select(message => message.MessageId)
            .ToListAsync(cancellationToken);
    }

    private static int ParseInt(string? value)
    {
        return int.TryParse((value ?? string.Empty).Trim(), out var parsed) ? parsed : 0;
    }

    private static string NormalizeWaveCode(string? waveCode)
    {
        return (waveCode ?? string.Empty).Trim();
    }

    private async Task<bool> TryAcquireCapacityLockAsync(int categoryId, string waveCode, CancellationToken cancellationToken)
    {
        if (!_connectContext.Database.IsSqlServer())
        {
            return true;
        }

        var currentTransaction = _connectContext.Database.CurrentTransaction;
        if (currentTransaction == null)
        {
            return true;
        }

        var connection = _connectContext.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken);
        }

        await using var command = connection.CreateCommand();
        command.Transaction = currentTransaction.GetDbTransaction();
        command.CommandText = @"
DECLARE @result int;
EXEC @result = sp_getapplock
    @Resource = @resource,
    @LockMode = 'Exclusive',
    @LockOwner = 'Transaction',
    @LockTimeout = @timeout;
SELECT @result;
";

        var resourceParam = command.CreateParameter();
        resourceParam.ParameterName = "@resource";
        resourceParam.Value = $"SUMMER_CAPACITY_{categoryId}_{NormalizeWaveCode(waveCode).ToUpperInvariant()}";
        command.Parameters.Add(resourceParam);

        var timeoutParam = command.CreateParameter();
        timeoutParam.ParameterName = "@timeout";
        timeoutParam.Value = CapacityLockTimeoutMs;
        command.Parameters.Add(timeoutParam);

        var resultObject = await command.ExecuteScalarAsync(cancellationToken);
        var resultCode = Convert.ToInt32(resultObject ?? -999);
        return resultCode >= 0;
    }
}
