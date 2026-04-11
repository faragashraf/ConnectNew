using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.DynamicSubjects;
using Models.GPA.OrgStructure;
using Persistence.Data;
using Persistence.Services.DynamicSubjects.AdminCatalog;
using Persistence.Services.DynamicSubjects.RuntimeCatalog;
using Xunit;

namespace Persistence.Tests;

public class RequestRuntimeCatalogServiceTests
{
    [Fact]
    public async Task GetAvailableRegistrationTreeAsync_ReturnsOnlyRuntimeStartableRequestsForUserUnits()
    {
        await using var connectContext = CreateConnectContext();
        await using var gpaContext = CreateGpaContext();

        SeedApplication(connectContext, "APP1", "تطبيق الاختبار");
        SeedCategory(connectContext, 100, 0, "وحدة 100", "APP1");
        SeedCategory(connectContext, 101, 100, "طلب متاح", "APP1");
        SeedCategory(connectContext, 102, 100, "طلب محجوب runtime", "APP1");
        SeedCategory(connectContext, 200, 0, "وحدة 200", "APP1");
        SeedCategory(connectContext, 201, 200, "طلب خارج نطاق الوحدة", "APP1");

        SeedFieldBinding(connectContext, 101);
        SeedFieldBinding(connectContext, 102);
        SeedFieldBinding(connectContext, 201);

        SeedUserUnit(gpaContext, "unit-user", 100);

        await connectContext.SaveChangesAsync();
        await gpaContext.SaveChangesAsync();

        var resolver = new StubRequestPreviewResolver((requestTypeId, _) =>
            BuildPreview(
                requestTypeId,
                isAvailable: requestTypeId == 101 || requestTypeId == 201,
                reason: requestTypeId == 102 ? "محجوب runtime" : "متاح"));

        var service = new RequestRuntimeCatalogService(connectContext, gpaContext, resolver);
        var response = await service.GetAvailableRegistrationTreeAsync("unit-user", "APP1");

        Assert.Empty(response.Errors);
        Assert.NotNull(response.Data);
        Assert.Equal(1, response.Data!.TotalAvailableRequests);

        var startableIds = FlattenNodes(response.Data)
            .Where(node => node.CanStart)
            .Select(node => node.CategoryId)
            .ToList();

        Assert.Contains(101, startableIds);
        Assert.DoesNotContain(102, startableIds);
        Assert.DoesNotContain(201, startableIds);
    }

    [Fact]
    public async Task GetAvailableRegistrationTreeAsync_AllowsSpecificUserWithoutUnitMembership()
    {
        await using var connectContext = CreateConnectContext();
        await using var gpaContext = CreateGpaContext();

        SeedApplication(connectContext, "APP2", "تطبيق المستخدم الفردي");
        SeedCategory(connectContext, 300, 0, "وحدة 300", "APP2");
        SeedCategory(connectContext, 301, 300, "طلب للمستخدم الفردي", "APP2");
        SeedFieldBinding(connectContext, 301);

        connectContext.SubjectTypeRequestAvailabilities.Add(new SubjectTypeRequestAvailability
        {
            CategoryId = 301,
            AvailabilityMode = "Restricted",
            SelectedNodeType = "SpecificUser",
            SelectedNodeUserId = "solo-user",
            SelectionLabelAr = "المستخدم الفردي",
            LastModifiedBy = "SYSTEM",
            LastModifiedAtUtc = DateTime.UtcNow
        });

        await connectContext.SaveChangesAsync();
        await gpaContext.SaveChangesAsync();

        var resolver = new StubRequestPreviewResolver((requestTypeId, userId) =>
            BuildPreview(
                requestTypeId,
                isAvailable: requestTypeId == 301 && userId == "solo-user",
                reason: userId == "solo-user" ? "متاح لمستخدم محدد" : "غير متاح"));

        var service = new RequestRuntimeCatalogService(connectContext, gpaContext, resolver);

        var allowedResponse = await service.GetAvailableRegistrationTreeAsync("solo-user", "APP2");
        Assert.Empty(allowedResponse.Errors);
        Assert.NotNull(allowedResponse.Data);
        Assert.Equal(1, allowedResponse.Data!.TotalAvailableRequests);

        var allowedStartable = FlattenNodes(allowedResponse.Data)
            .Where(node => node.CanStart)
            .Select(node => node.CategoryId)
            .ToList();
        Assert.Contains(301, allowedStartable);

        var deniedResponse = await service.GetAvailableRegistrationTreeAsync("another-user", "APP2");
        Assert.Empty(deniedResponse.Errors);
        Assert.NotNull(deniedResponse.Data);
        Assert.Equal(0, deniedResponse.Data!.TotalAvailableRequests);
    }

    private static IEnumerable<RequestRuntimeCatalogNodeDto> FlattenNodes(RequestRuntimeCatalogDto catalog)
    {
        foreach (var app in catalog.Applications ?? new List<RequestRuntimeCatalogApplicationDto>())
        {
            foreach (var node in FlattenAppNodes(app.Categories))
            {
                yield return node;
            }
        }
    }

    private static IEnumerable<RequestRuntimeCatalogNodeDto> FlattenAppNodes(IEnumerable<RequestRuntimeCatalogNodeDto> nodes)
    {
        foreach (var node in nodes ?? Enumerable.Empty<RequestRuntimeCatalogNodeDto>())
        {
            yield return node;
            foreach (var child in FlattenAppNodes(node.Children ?? new List<RequestRuntimeCatalogNodeDto>()))
            {
                yield return child;
            }
        }
    }

    private static AdminControlCenterRequestPreviewDto BuildPreview(int requestTypeId, bool isAvailable, string reason)
    {
        return new AdminControlCenterRequestPreviewDto
        {
            RequestTypeId = requestTypeId,
            RequestTypeName = $"RT-{requestTypeId}",
            IsAvailable = isAvailable,
            AvailabilityReasons = new List<string> { reason }
        };
    }

    private static void SeedApplication(ConnectContext context, string appId, string appName)
    {
        context.Set<Application>().Add(new Application
        {
            ApplicationId = appId,
            ApplicationName = appName,
            IsActive = true,
            StampDate = DateTime.UtcNow
        });
    }

    private static void SeedCategory(ConnectContext context, int id, int parentId, string name, string appId)
    {
        context.Cdcategories.Add(new Cdcategory
        {
            CatId = id,
            CatParent = parentId,
            CatName = name,
            CatStatus = false,
            ApplicationId = appId,
            StampDate = DateTime.UtcNow
        });
    }

    private static void SeedFieldBinding(ConnectContext context, int categoryId)
    {
        context.AdminCatalogCategoryFieldBindings.Add(new AdminCatalogCategoryFieldBinding
        {
            CategoryId = categoryId,
            MendSql = categoryId * 10,
            MendField = $"FIELD_{categoryId}",
            MendStat = false,
            GroupId = 1
        });
    }

    private static void SeedUserUnit(GPAContext context, string userId, decimal unitId)
    {
        context.UserPositions.Add(new UserPosition
        {
            PositionId = unitId,
            UserId = userId,
            UnitId = unitId,
            StartDate = DateTime.Today.AddDays(-1),
            EndDate = DateTime.Today.AddDays(1),
            IsActive = true,
            IsManager = false
        });
    }

    private static ConnectContext CreateConnectContext()
    {
        var options = new DbContextOptionsBuilder<ConnectContext>()
            .UseInMemoryDatabase($"request-runtime-catalog-connect-{Guid.NewGuid():N}")
            .ConfigureWarnings(builder => builder.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new ConnectContext(options, new HttpContextAccessor());
    }

    private static GPAContext CreateGpaContext()
    {
        var options = new DbContextOptionsBuilder<GPAContext>()
            .UseInMemoryDatabase($"request-runtime-catalog-gpa-{Guid.NewGuid():N}")
            .Options;

        return new GPAContext(options);
    }

    private sealed class StubRequestPreviewResolver : IAdminControlCenterRequestPreviewResolver
    {
        private readonly Func<int, string, AdminControlCenterRequestPreviewDto> _builder;

        public StubRequestPreviewResolver(Func<int, string, AdminControlCenterRequestPreviewDto> builder)
        {
            _builder = builder;
        }

        public Task<CommonResponse<AdminControlCenterRequestPreviewDto>> ResolveAsync(
            int requestTypeId,
            string userId,
            CancellationToken cancellationToken = default)
        {
            var response = new CommonResponse<AdminControlCenterRequestPreviewDto>
            {
                Data = _builder(requestTypeId, userId)
            };

            return Task.FromResult(response);
        }
    }
}
