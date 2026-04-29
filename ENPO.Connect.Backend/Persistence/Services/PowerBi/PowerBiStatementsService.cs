using Microsoft.EntityFrameworkCore;
using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.PowerBi;
using Models.GPA;
using Persistence.Data;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Persistence.Services.PowerBi;

public sealed class PowerBiStatementsService : IPowerBiStatementsService
{
    private static readonly string[] DefaultSqlTypes = new[]
    {
        "SELECT",
        "INSERT",
        "UPDATE",
        "DELETE",
        "MERGE",
        "PLSQL"
    };

    private static readonly string[] DefaultDatabases = new[]
    {
        "ORACLE",
        "SQL"
    };

    private readonly GPAContext _gpaContext;
    private readonly ConnectContext _connectContext;

    public PowerBiStatementsService(
        GPAContext gpaContext,
        ConnectContext connectContext)
    {
        _gpaContext = gpaContext;
        _connectContext = connectContext;
    }

    public async Task<CommonResponse<IEnumerable<PowerBiStatementDto>>> GetStatementsAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<IEnumerable<PowerBiStatementDto>>();
        try
        {
            if (!EnsureAuthorizedUser(userId, response))
            {
                return response;
            }

            var statements = await _gpaContext.PredefinedSqlStatements
                .AsNoTracking()
                .OrderByDescending(item => item.StatementId)
                .ToListAsync(cancellationToken);

            response.Data = statements.Select(MapStatement).ToList();
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<PowerBiStatementDto>> GetStatementByIdAsync(
        int statementId,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<PowerBiStatementDto>();
        try
        {
            if (!EnsureAuthorizedUser(userId, response))
            {
                return response;
            }

            var statement = await _gpaContext.PredefinedSqlStatements
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.StatementId == statementId, cancellationToken);

            if (statement == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "السجل غير موجود." });
                return response;
            }

            response.Data = MapStatement(statement);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<PowerBiStatementLookupsDto>> GetLookupsAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<PowerBiStatementLookupsDto>();
        try
        {
            if (!EnsureAuthorizedUser(userId, response))
            {
                return response;
            }

            var statementRows = await _gpaContext.PredefinedSqlStatements
                .AsNoTracking()
                .Select(item => new
                {
                    item.ApplicationId,
                    item.SchemaName,
                    item.SqlType,
                    item.DatabaseName
                })
                .ToListAsync(cancellationToken);

            var applicationIdsFromConnect = await _connectContext.Set<Application>()
                .AsNoTracking()
                .Select(item => item.ApplicationId)
                .ToListAsync(cancellationToken);

            response.Data = new PowerBiStatementLookupsDto
            {
                ApplicationIds = BuildDistinctList(
                    applicationIdsFromConnect.Concat(statementRows.Select(item => item.ApplicationId))),
                SchemaNames = BuildDistinctList(statementRows.Select(item => item.SchemaName)),
                SqlTypes = BuildDistinctList(DefaultSqlTypes.Concat(statementRows.Select(item => item.SqlType))),
                Databases = DefaultDatabases.ToList()
            };
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<PowerBiStatementDto>> CreateStatementAsync(
        PowerBiStatementUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<PowerBiStatementDto>();
        try
        {
            if (!EnsureAuthorizedUser(userId, response))
            {
                return response;
            }

            if (!TryBuildPayload(request, response, out var payload))
            {
                return response;
            }

            int resolvedStatementId;
            if (payload.StatementId.HasValue)
            {
                resolvedStatementId = payload.StatementId.Value;
                var statementIdExists = await _gpaContext.PredefinedSqlStatements
                    .AsNoTracking()
                    .AnyAsync(item => item.StatementId == resolvedStatementId, cancellationToken);

                if (statementIdExists)
                {
                    response.Errors.Add(new Error { Code = "409", Message = "رقم الاستعلام موجود بالفعل." });
                    return response;
                }
            }
            else
            {
                var maxStatementId = await _gpaContext.PredefinedSqlStatements
                    .AsNoTracking()
                    .MaxAsync(item => (int?)item.StatementId, cancellationToken) ?? 0;

                resolvedStatementId = maxStatementId + 1;
            }

            var entity = new PredefinedSqlStatement
            {
                StatementId = resolvedStatementId,
                ApplicationId = payload.ApplicationId,
                SchemaName = payload.SchemaName,
                SqlType = payload.SqlType,
                SqlStatement = payload.SqlStatement,
                Parameters = payload.Parameters,
                Description = payload.Description,
                DatabaseName = payload.Database,
                CreatedAt = DateTime.Now
            };

            _gpaContext.PredefinedSqlStatements.Add(entity);
            await _gpaContext.SaveChangesAsync(cancellationToken);

            response.Data = MapStatement(entity);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<PowerBiStatementDto>> UpdateStatementAsync(
        int statementId,
        PowerBiStatementUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<PowerBiStatementDto>();
        try
        {
            if (!EnsureAuthorizedUser(userId, response))
            {
                return response;
            }

            if (!TryBuildPayload(request, response, out var payload))
            {
                return response;
            }

            var existing = await _gpaContext.PredefinedSqlStatements
                .FirstOrDefaultAsync(item => item.StatementId == statementId, cancellationToken);

            if (existing == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "السجل غير موجود." });
                return response;
            }

            var targetStatementId = payload.StatementId ?? statementId;
            if (targetStatementId <= 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "رقم الاستعلام غير صالح." });
                return response;
            }

            if (targetStatementId != statementId)
            {
                var newIdExists = await _gpaContext.PredefinedSqlStatements
                    .AsNoTracking()
                    .AnyAsync(item => item.StatementId == targetStatementId, cancellationToken);

                if (newIdExists)
                {
                    response.Errors.Add(new Error { Code = "409", Message = "رقم الاستعلام الجديد موجود بالفعل." });
                    return response;
                }

                var replacement = new PredefinedSqlStatement
                {
                    StatementId = targetStatementId,
                    ApplicationId = payload.ApplicationId,
                    SchemaName = payload.SchemaName,
                    SqlType = payload.SqlType,
                    SqlStatement = payload.SqlStatement,
                    Parameters = payload.Parameters,
                    Description = payload.Description,
                    DatabaseName = payload.Database,
                    CreatedAt = existing.CreatedAt
                };

                _gpaContext.PredefinedSqlStatements.Add(replacement);
                _gpaContext.PredefinedSqlStatements.Remove(existing);
                await _gpaContext.SaveChangesAsync(cancellationToken);

                response.Data = MapStatement(replacement);
                return response;
            }

            existing.ApplicationId = payload.ApplicationId;
            existing.SchemaName = payload.SchemaName;
            existing.SqlType = payload.SqlType;
            existing.SqlStatement = payload.SqlStatement;
            existing.Parameters = payload.Parameters;
            existing.Description = payload.Description;
            existing.DatabaseName = payload.Database;

            await _gpaContext.SaveChangesAsync(cancellationToken);
            response.Data = MapStatement(existing);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<PowerBiStatementDeleteResultDto>> DeleteStatementAsync(
        int statementId,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<PowerBiStatementDeleteResultDto>();
        try
        {
            if (!EnsureAuthorizedUser(userId, response))
            {
                return response;
            }

            var existing = await _gpaContext.PredefinedSqlStatements
                .FirstOrDefaultAsync(item => item.StatementId == statementId, cancellationToken);

            if (existing == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "السجل غير موجود." });
                return response;
            }

            _gpaContext.PredefinedSqlStatements.Remove(existing);
            await _gpaContext.SaveChangesAsync(cancellationToken);

            response.Data = new PowerBiStatementDeleteResultDto
            {
                Deleted = true,
                StatementId = statementId
            };
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    private static PowerBiStatementDto MapStatement(PredefinedSqlStatement entity)
    {
        return new PowerBiStatementDto
        {
            StatementId = entity.StatementId,
            ApplicationId = entity.ApplicationId,
            SchemaName = entity.SchemaName,
            SqlType = entity.SqlType,
            SqlStatement = entity.SqlStatement,
            Parameters = entity.Parameters,
            Description = entity.Description,
            CreatedAt = entity.CreatedAt,
            Database = NormalizeDatabase(entity.DatabaseName) ?? entity.DatabaseName
        };
    }

    private static List<string> BuildDistinctList(IEnumerable<string?> values)
    {
        return values
            .Select(NormalizeNullable)
            .Where(item => item != null)
            .Cast<string>()
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(item => item, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static bool EnsureAuthorizedUser<T>(string userId, CommonResponse<T> response)
    {
        var normalizedUser = NormalizeNullable(userId);
        if (normalizedUser != null)
        {
            return true;
        }

        response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
        return false;
    }

    private static bool TryBuildPayload(
        PowerBiStatementUpsertRequestDto? request,
        CommonResponse<PowerBiStatementDto> response,
        out StatementPayload payload)
    {
        payload = new StatementPayload();
        var safeRequest = request ?? new PowerBiStatementUpsertRequestDto();

        payload.StatementId = safeRequest.StatementId.HasValue && safeRequest.StatementId.Value > 0
            ? safeRequest.StatementId.Value
            : null;

        payload.ApplicationId = NormalizeNullable(safeRequest.ApplicationId);
        if (payload.ApplicationId == null)
        {
            response.Errors.Add(new Error { Code = "400", Message = "Application ID مطلوب." });
        }

        payload.SchemaName = NormalizeNullable(safeRequest.SchemaName);
        if (payload.SchemaName == null)
        {
            response.Errors.Add(new Error { Code = "400", Message = "Schema Name مطلوب." });
        }

        payload.SqlType = NormalizeNullable(safeRequest.SqlType);
        if (payload.SqlType == null)
        {
            response.Errors.Add(new Error { Code = "400", Message = "SQL Type مطلوب." });
        }

        payload.Database = NormalizeDatabase(safeRequest.Database);
        if (payload.Database == null)
        {
            response.Errors.Add(new Error { Code = "400", Message = "Database مطلوب." });
        }
        else if (payload.Database != "ORACLE" && payload.Database != "SQL")
        {
            response.Errors.Add(new Error { Code = "400", Message = "Database يجب أن تكون ORACLE أو SQL فقط." });
        }

        payload.SqlStatement = NormalizeNullable(safeRequest.SqlStatement);
        if (payload.SqlStatement == null)
        {
            response.Errors.Add(new Error { Code = "400", Message = "SQL Statement مطلوب." });
        }

        payload.Parameters = NormalizeNullable(safeRequest.Parameters);
        payload.Description = NormalizeNullable(safeRequest.Description);

        return response.Errors.Count == 0;
    }

    private static void AddUnhandledError<T>(CommonResponse<T> response)
    {
        response.Errors.Add(new Error
        {
            Code = "500",
            Message = "حدث خطأ غير متوقع أثناء معالجة الطلب."
        });
    }

    private static string? NormalizeNullable(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        return value.Trim();
    }

    private static string? NormalizeDatabase(string? value)
    {
        var normalized = NormalizeNullable(value);
        if (normalized == null)
        {
            return null;
        }

        if (string.Equals(normalized, "ORACLE", StringComparison.OrdinalIgnoreCase))
        {
            return "ORACLE";
        }

        if (string.Equals(normalized, "SQL", StringComparison.OrdinalIgnoreCase)
            || string.Equals(normalized, "SQLSERVER", StringComparison.OrdinalIgnoreCase))
        {
            return "SQL";
        }

        return normalized.ToUpperInvariant();
    }

    private sealed class StatementPayload
    {
        public int? StatementId { get; set; }

        public string? ApplicationId { get; set; }

        public string? SchemaName { get; set; }

        public string? SqlType { get; set; }

        public string? SqlStatement { get; set; }

        public string? Parameters { get; set; }

        public string? Description { get; set; }

        public string? Database { get; set; }
    }
}
