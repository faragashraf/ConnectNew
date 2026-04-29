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

    [Fact]
    public async Task UpsertAndGetAdminCategoryFieldLinks_Preserves_InternalTokenAuthRuntime_ForDocSource()
    {
        await using var connectContext = CreateConnectContext();
        await using var attachContext = CreateAttachContext();
        await using var gpaContext = CreateGpaContext();

        const int categoryId = 101;
        const int mendSql = 7002;
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
            CdmendSql = 502,
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
            DisplaySettingsJson = "{\"readonly\":false}",
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

        const string runtimeDisplaySettingsJson = "{\"readonly\":false,\"dynamicRuntime\":{\"optionLoader\":{\"trigger\":\"change\",\"integration\":{\"sourceType\":\"powerbi\",\"requestFormat\":\"json\",\"auth\":{\"mode\":\"token\",\"token\":{\"source\":\"static\",\"staticValue\":\"TOKEN_123\"}},\"statementId\":65},\"responseListPath\":\"data\",\"responseValuePath\":\"id\",\"responseLabelPath\":\"name\"}}}";

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
        Assert.Contains("\"mode\":\"token\"", storedSettings!.DisplaySettingsJson);
        Assert.Contains("\"statementId\":65", storedSettings.DisplaySettingsJson);

        var reloadResponse = await service.GetAdminCategoryFieldLinksAsync(categoryId, "tester");
        Assert.Empty(reloadResponse.Errors);

        var docSourceLink = reloadResponse.Data?
            .FirstOrDefault(item => string.Equals(item.FieldKey, fieldKey, StringComparison.OrdinalIgnoreCase));
        Assert.NotNull(docSourceLink);
        Assert.Contains("\"mode\":\"token\"", docSourceLink!.DisplaySettingsJson);
        Assert.Contains("\"TOKEN_123\"", docSourceLink.DisplaySettingsJson);
    }

    [Fact]
    public async Task UpsertAndGetAdminCategoryFieldLinks_Preserves_ExternalBasicAuthRuntime_ForDocSource()
    {
        await using var connectContext = CreateConnectContext();
        await using var attachContext = CreateAttachContext();
        await using var gpaContext = CreateGpaContext();

        const int categoryId = 102;
        const int mendSql = 7003;
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
            CdmendSql = 503,
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
            DisplaySettingsJson = "{\"readonly\":false}",
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

        const string runtimeDisplaySettingsJson = "{\"readonly\":false,\"dynamicRuntime\":{\"optionLoader\":{\"trigger\":\"change\",\"integration\":{\"sourceType\":\"external\",\"requestFormat\":\"json\",\"auth\":{\"mode\":\"basic\",\"username\":{\"source\":\"static\",\"staticValue\":\"api_user\"},\"password\":{\"source\":\"static\",\"staticValue\":\"api_password\"}},\"fullUrl\":\"https://example.test/api/options\",\"method\":\"GET\"},\"responseListPath\":\"data\",\"responseValuePath\":\"id\",\"responseLabelPath\":\"name\"}}}";

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
        Assert.Contains("\"sourceType\":\"external\"", storedSettings!.DisplaySettingsJson);
        Assert.Contains("\"fullUrl\":\"https://example.test/api/options\"", storedSettings.DisplaySettingsJson);
        Assert.Contains("\"mode\":\"basic\"", storedSettings.DisplaySettingsJson);

        var reloadResponse = await service.GetAdminCategoryFieldLinksAsync(categoryId, "tester");
        Assert.Empty(reloadResponse.Errors);

        var docSourceLink = reloadResponse.Data?
            .FirstOrDefault(item => string.Equals(item.FieldKey, fieldKey, StringComparison.OrdinalIgnoreCase));
        Assert.NotNull(docSourceLink);
        Assert.Contains("\"sourceType\":\"external\"", docSourceLink!.DisplaySettingsJson);
        Assert.Contains("\"mode\":\"basic\"", docSourceLink.DisplaySettingsJson);
    }

    [Fact]
    public async Task UpsertAdminCategoryFieldLinks_AllowsLegacyMissingField_WhenAlreadyLinkedInCategory()
    {
        await using var connectContext = CreateConnectContext();
        await using var attachContext = CreateAttachContext();
        await using var gpaContext = CreateGpaContext();

        const int categoryId = 103;
        const int docSourceMendSql = 7004;
        const int topicDirectionMendSql = 7005;
        const string appId = "APP-UNIT";
        const string docSourceFieldKey = "DOC_SOURCE";
        const string legacyFieldKey = "TOPICDIRECTION";
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
            CdmendSql = 504,
            CdmendType = "Dropdown",
            CdmendTxt = docSourceFieldKey,
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
        connectContext.AdminCatalogCategoryFieldBindings.AddRange(
            new AdminCatalogCategoryFieldBinding
            {
                MendSql = docSourceMendSql,
                CategoryId = categoryId,
                MendField = docSourceFieldKey,
                GroupId = groupId,
                MendStat = false
            },
            new AdminCatalogCategoryFieldBinding
            {
                MendSql = topicDirectionMendSql,
                CategoryId = categoryId,
                MendField = legacyFieldKey,
                GroupId = groupId,
                MendStat = false
            });
        connectContext.SubjectCategoryFieldSettings.AddRange(
            new SubjectCategoryFieldSetting
            {
                MendSql = docSourceMendSql,
                DisplayOrder = 1,
                IsVisible = true,
                DisplaySettingsJson = "{\"readonly\":false}",
                LastModifiedBy = "seed",
                LastModifiedAtUtc = DateTime.UtcNow
            },
            new SubjectCategoryFieldSetting
            {
                MendSql = topicDirectionMendSql,
                DisplayOrder = 2,
                IsVisible = true,
                DisplaySettingsJson = "{\"readonly\":false}",
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

        const string runtimeDisplaySettingsJson = "{\"readonly\":false,\"dynamicRuntime\":{\"optionLoader\":{\"trigger\":\"change\",\"integration\":{\"sourceType\":\"powerbi\",\"requestFormat\":\"json\",\"auth\":{\"mode\":\"bearerCurrent\"},\"statementId\":65},\"responseListPath\":\"data\",\"responseValuePath\":\"id\",\"responseLabelPath\":\"name\"}}}";

        var upsertResponse = await service.UpsertAdminCategoryFieldLinksAsync(
            categoryId,
            new SubjectCategoryFieldLinksUpsertRequestDto
            {
                Links = new List<SubjectCategoryFieldLinkUpsertItemDto>
                {
                    new()
                    {
                        MendSql = docSourceMendSql,
                        FieldKey = docSourceFieldKey,
                        GroupId = groupId,
                        IsActive = true,
                        DisplayOrder = 1,
                        IsVisible = true,
                        DisplaySettingsJson = runtimeDisplaySettingsJson
                    },
                    new()
                    {
                        MendSql = topicDirectionMendSql,
                        FieldKey = legacyFieldKey,
                        GroupId = groupId,
                        IsActive = true,
                        DisplayOrder = 2,
                        IsVisible = true,
                        DisplaySettingsJson = "{\"readonly\":false}"
                    }
                }
            },
            userId: "tester");

        Assert.Empty(upsertResponse.Errors);

        var reloadResponse = await service.GetAdminCategoryFieldLinksAsync(categoryId, "tester");
        Assert.Empty(reloadResponse.Errors);

        var docSourceLink = reloadResponse.Data?
            .FirstOrDefault(item => string.Equals(item.FieldKey, docSourceFieldKey, StringComparison.OrdinalIgnoreCase));
        Assert.NotNull(docSourceLink);
        Assert.Contains("\"dynamicRuntime\"", docSourceLink!.DisplaySettingsJson);
    }

    [Fact]
    public async Task UpsertAdminCategoryFieldLinks_AllowsLegacyMissingField_WhenPresentOnlyInLegacyLinks()
    {
        await using var connectContext = CreateConnectContext();
        await using var attachContext = CreateAttachContext();
        await using var gpaContext = CreateGpaContext();

        const int categoryId = 104;
        const int docSourceMendSql = 7006;
        const int topicDirectionMendSql = 7007;
        const string appId = "APP-UNIT";
        const string docSourceFieldKey = "DOC_SOURCE";
        const string legacyFieldKey = "TOPICDIRECTION";
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
            CdmendSql = 505,
            CdmendType = "Dropdown",
            CdmendTxt = docSourceFieldKey,
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
            MendSql = docSourceMendSql,
            CategoryId = categoryId,
            MendField = docSourceFieldKey,
            GroupId = groupId,
            MendStat = false
        });
        connectContext.CdCategoryMands.Add(new CdCategoryMand
        {
            MendSql = topicDirectionMendSql,
            MendCategory = categoryId,
            MendField = legacyFieldKey,
            MendGroup = groupId,
            MendStat = false
        });
        connectContext.SubjectCategoryFieldSettings.AddRange(
            new SubjectCategoryFieldSetting
            {
                MendSql = docSourceMendSql,
                DisplayOrder = 1,
                IsVisible = true,
                DisplaySettingsJson = "{\"readonly\":false}",
                LastModifiedBy = "seed",
                LastModifiedAtUtc = DateTime.UtcNow
            },
            new SubjectCategoryFieldSetting
            {
                MendSql = topicDirectionMendSql,
                DisplayOrder = 2,
                IsVisible = true,
                DisplaySettingsJson = "{\"readonly\":false}",
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

        const string runtimeDisplaySettingsJson = "{\"readonly\":false,\"dynamicRuntime\":{\"optionLoader\":{\"trigger\":\"change\",\"integration\":{\"sourceType\":\"powerbi\",\"requestFormat\":\"json\",\"auth\":{\"mode\":\"bearerCurrent\"},\"statementId\":65},\"responseListPath\":\"data\",\"responseValuePath\":\"id\",\"responseLabelPath\":\"name\"}}}";

        var upsertResponse = await service.UpsertAdminCategoryFieldLinksAsync(
            categoryId,
            new SubjectCategoryFieldLinksUpsertRequestDto
            {
                Links = new List<SubjectCategoryFieldLinkUpsertItemDto>
                {
                    new()
                    {
                        MendSql = docSourceMendSql,
                        FieldKey = docSourceFieldKey,
                        GroupId = groupId,
                        IsActive = true,
                        DisplayOrder = 1,
                        IsVisible = true,
                        DisplaySettingsJson = runtimeDisplaySettingsJson
                    },
                    new()
                    {
                        MendSql = topicDirectionMendSql,
                        FieldKey = legacyFieldKey,
                        GroupId = groupId,
                        IsActive = true,
                        DisplayOrder = 2,
                        IsVisible = true,
                        DisplaySettingsJson = "{\"readonly\":false}"
                    }
                }
            },
            userId: "tester");

        Assert.Empty(upsertResponse.Errors);

        var docSourceSettings = await connectContext.SubjectCategoryFieldSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.MendSql == docSourceMendSql);
        Assert.NotNull(docSourceSettings);
        Assert.Contains("\"dynamicRuntime\"", docSourceSettings!.DisplaySettingsJson);
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
