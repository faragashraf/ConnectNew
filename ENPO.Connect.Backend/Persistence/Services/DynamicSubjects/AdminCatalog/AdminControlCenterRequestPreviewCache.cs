using Microsoft.Extensions.Logging;
using Models.DTO.Common;
using Models.DTO.DynamicSubjects;

namespace Persistence.Services.DynamicSubjects.AdminCatalog;

public sealed class AdminControlCenterRequestPreviewCache : IAdminControlCenterRequestPreviewCache
{
    private const string VersionKeyIdentifier = "request-preview:version";
    private const string PreviewKeyPrefix = "request-preview";
    private const string PayloadSchemaVersion = "2";
    private static readonly TimeSpan VersionKeyTtl = TimeSpan.FromDays(180);

    private readonly RedisConnectionManager _redisManager;
    private readonly ILogger<AdminControlCenterRequestPreviewCache> _logger;

    public AdminControlCenterRequestPreviewCache(
        RedisConnectionManager redisManager,
        ILogger<AdminControlCenterRequestPreviewCache> logger)
    {
        _redisManager = redisManager;
        _logger = logger;
    }

    public async Task<CommonResponse<AdminControlCenterRequestPreviewDto>?> TryGetAsync(
        int requestTypeId,
        string userId,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var version = await GetOrCreateVersionAsync(cancellationToken);
            var identifier = BuildCacheIdentifier(version, requestTypeId, userId, unitId: null);
            return await _redisManager.GetFromRedisByKeyAsync<CommonResponse<AdminControlCenterRequestPreviewDto>>(
                RedisSubCategory.Cache,
                identifier);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Request preview cache read failed for requestTypeId {RequestTypeId}, userId {UserId}.",
                requestTypeId,
                userId);
            return null;
        }
    }

    public async Task SetAsync(
        int requestTypeId,
        string userId,
        CommonResponse<AdminControlCenterRequestPreviewDto> value,
        TimeSpan ttl,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var version = await GetOrCreateVersionAsync(cancellationToken);
            var identifier = BuildCacheIdentifier(version, requestTypeId, userId, unitId: null);

            await _redisManager.SaveToRedisAsync(
                RedisSubCategory.Cache,
                value,
                ttl,
                identifier);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                ex,
                "Request preview cache write failed for requestTypeId {RequestTypeId}, userId {UserId}.",
                requestTypeId,
                userId);
        }
    }

    public async Task InvalidateAllAsync(CancellationToken cancellationToken = default)
    {
        try
        {
            var currentVersion = await GetOrCreateVersionAsync(cancellationToken);
            var nextVersion = IncrementVersion(currentVersion);

            await _redisManager.SaveToRedisAsync(
                RedisSubCategory.AppSettings,
                nextVersion,
                VersionKeyTtl,
                VersionKeyIdentifier);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Request preview cache invalidation failed.");
        }
    }

    private async Task<string> GetOrCreateVersionAsync(CancellationToken cancellationToken)
    {
        var version = await _redisManager.GetFromRedisByKeyAsync<string>(
            RedisSubCategory.AppSettings,
            VersionKeyIdentifier);

        var normalizedVersion = NormalizeNullable(version);
        if (normalizedVersion != null)
        {
            return normalizedVersion;
        }

        const string initialVersion = "1";
        await _redisManager.SaveToRedisAsync(
            RedisSubCategory.AppSettings,
            initialVersion,
            VersionKeyTtl,
            VersionKeyIdentifier);

        return initialVersion;
    }

    private static string BuildCacheIdentifier(
        string version,
        int requestTypeId,
        string userId,
        string? unitId)
    {
        var normalizedVersion = NormalizeNullable(version) ?? "1";
        var normalizedUserId = NormalizeNullable(userId) ?? "_";
        var normalizedUnitId = NormalizeNullable(unitId);

        if (normalizedUnitId == null)
        {
            return $"{PreviewKeyPrefix}:schema{PayloadSchemaVersion}:v{normalizedVersion}:{requestTypeId}:{normalizedUserId}";
        }

        return $"{PreviewKeyPrefix}:schema{PayloadSchemaVersion}:v{normalizedVersion}:{requestTypeId}:{normalizedUserId}:unit:{normalizedUnitId}";
    }

    private static string IncrementVersion(string currentVersion)
    {
        if (!long.TryParse(currentVersion, out var value))
        {
            return "1";
        }

        var next = value + 1;
        if (next <= 0)
        {
            return "1";
        }

        return next.ToString();
    }

    private static string? NormalizeNullable(string? value)
    {
        var normalized = (value ?? string.Empty).Trim();
        return normalized.Length == 0 ? null : normalized;
    }
}
