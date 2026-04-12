using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Models.Correspondance;
using Models.DTO.DynamicSubjects;
using Models.GPA.OrgStructure;
using Persistence.Data;
using Persistence.Services.DynamicSubjects;
using Xunit;

namespace Persistence.Tests;

public class DynamicSubjectsAdminFieldLinksRuntimeRoundTripTests
{
    [Fact]
    public async Task UpsertAndGetAdminCategoryFieldLinks_Preserves_DisplaySettingsDynamicRuntime_ForDocSource()
    {
        await using var connectContext = CreateConnectContext();
        await using var attachContext = CreateAttachContext();
        await using var gpaContext = CreateGpaContext();

        const int categoryId = 100;
        const int mendSql = 7001;
        const string appId = "APP-UNIT";
        const string fieldKey = "DOC_SOURCE";
        const int groupId = 1;

        connectContext.Cdcategories.Add(new Cdcategory
        {
            CatId = categoryId,
            CatParent = 0,
            CatName = "طلب تجريبي",
            CatStatus = false,
            CatWorkFlow = 0,
            CatSms = false,
            CatMailNotification = false,
            StampDate = DateTime.UtcNow,
            ApplicationId = appId
        });
        connectContext.Cdmends.Add(new Cdmend
        {
            CdmendSql = 501,
            CdmendType = "Dropdown",
            CdmendTxt = fieldKey,
            CDMendLbl = "مصدر المستند",
            CdmendDatatype = "string",
            CdmendStat = false,
            Width = 0,
            Height = 0,
            IsDisabledInit = false,
            IsSearchable = true,
            ApplicationId = appId
        });
        connectContext.AdminCatalogCategoryGroups.Add(new AdminCatalogCategoryGroup
        {
            GroupId = groupId,
            CategoryId = categoryId,
            ApplicationId = appId,
            GroupName = "البيانات الأساسية",
            DisplayOrder = 1,
            IsActive = true,
            StampDate = DateTime.UtcNow
        });
        connectContext.AdminCatalogCategoryFieldBindings.Add(new AdminCatalogCategoryFieldBinding
        {
            MendSql = mendSql,
            CategoryId = categoryId,
            MendField = fieldKey,
            GroupId = groupId,
            MendStat = false
        });
        connectContext.SubjectCategoryFieldSettings.Add(new SubjectCategoryFieldSetting
        {
            MendSql = mendSql,
            DisplayOrder = 1,
            IsVisible = true,
            DisplaySettingsJson = "{\"readonly\":false,\"isReadonly\":false}",
            LastModifiedBy = "seed",
            LastModifiedAtUtc = DateTime.UtcNow
        });

        await connectContext.SaveChangesAsync();

        var service = new DynamicSubjectsService(
            connectContext,
            attachContext,
            gpaContext,
            null!,
            null!,
            null!,
            null!,
            null!,
            null!,
            null);

        const string runtimeDisplaySettingsJson = "{\"readonly\":false,\"isReadonly\":false,\"dynamicRuntime\":{\"optionLoader\":{\"trigger\":\"init\",\"integration\":{\"sourceType\":\"powerbi\",\"requestFormat\":\"json\",\"auth\":{\"mode\":\"bearerCurrent\"},\"statementId\":65,\"parameters\":[{\"name\":\"direction\",\"value\":{\"source\":\"static\",\"staticValue\":\"incoming\"}}]},\"responseListPath\":\"data\",\"responseValuePath\":\"id\",\"responseLabelPath\":\"name\"}}}";

        var upsertResponse = await service.UpsertAdminCategoryFieldLinksAsync(
            categoryId,
            new SubjectCategoryFieldLinksUpsertRequestDto
            {
                Links = new List<SubjectCategoryFieldLinkUpsertItemDto>
                {
                    new()
                    {
                        MendSql = mendSql,
                        FieldKey = fieldKey,
                        GroupId = groupId,
                        IsActive = true,
                        DisplayOrder = 1,
                        IsVisible = true,
                        DisplaySettingsJson = runtimeDisplaySettingsJson
                    }
                }
            },
            userId: "tester");

        Assert.Empty(upsertResponse.Errors);

        var storedSettings = await connectContext.SubjectCategoryFieldSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.MendSql == mendSql);
        Assert.NotNull(storedSettings);
        Assert.Contains("\"dynamicRuntime\"", storedSettings!.DisplaySettingsJson);
        Assert.Contains("\"statementId\":65", storedSettings.DisplaySettingsJson);

        var reloadResponse = await service.GetAdminCategoryFieldLinksAsync(categoryId, "tester");
        Assert.Empty(reloadResponse.Errors);

        var docSourceLink = reloadResponse.Data?
            .FirstOrDefault(item => string.Equals(item.FieldKey, fieldKey, StringComparison.OrdinalIgnoreCase));
        Assert.NotNull(docSourceLink);
        Assert.Contains("\"dynamicRuntime\"", docSourceLink!.DisplaySettingsJson);
        Assert.Contains("\"statementId\":65", docSourceLink.DisplaySettingsJson);
    }

    private static ConnectContext CreateConnectContext()
    {
        var options = new DbContextOptionsBuilder<ConnectContext>()
            .UseInMemoryDatabase($"dynamic-subjects-admin-links-{Guid.NewGuid():N}")
            .ConfigureWarnings(builder => builder.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new ConnectContext(options, new HttpContextAccessor());
    }

    private static Attach_HeldContext CreateAttachContext()
    {
        var options = new DbContextOptionsBuilder<Attach_HeldContext>()
            .UseInMemoryDatabase($"dynamic-subjects-admin-links-attach-{Guid.NewGuid():N}")
            .Options;

        return new Attach_HeldContext(options);
    }

    private static GPAContext CreateGpaContext()
    {
        var options = new DbContextOptionsBuilder<GPAContext>()
            .UseInMemoryDatabase($"dynamic-subjects-admin-links-gpa-{Guid.NewGuid():N}")
            .Options;

        return new GPAContext(options);
    }
}
