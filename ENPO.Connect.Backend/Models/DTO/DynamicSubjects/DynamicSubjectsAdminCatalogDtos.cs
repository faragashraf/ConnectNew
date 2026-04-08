using System.Collections.Generic;

namespace Models.DTO.DynamicSubjects;

public sealed class AdminCatalogApplicationDto
{
    public string ApplicationId { get; set; } = string.Empty;

    public string ApplicationName { get; set; } = string.Empty;

    public bool IsActive { get; set; }
}

public sealed class AdminCatalogApplicationCreateRequestDto
{
    public string ApplicationId { get; set; } = string.Empty;

    public string ApplicationName { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;
}

public sealed class AdminCatalogApplicationUpdateRequestDto
{
    public string ApplicationName { get; set; } = string.Empty;

    public bool IsActive { get; set; }
}

public sealed class AdminCatalogCategoryDto
{
    public int CategoryId { get; set; }

    public int ParentCategoryId { get; set; }

    public string CategoryName { get; set; } = string.Empty;

    public string? ApplicationId { get; set; }

    public bool IsActive { get; set; }
}

public sealed class AdminCatalogCategoryTreeNodeDto
{
    public int CategoryId { get; set; }

    public int ParentCategoryId { get; set; }

    public string CategoryName { get; set; } = string.Empty;

    public string? ApplicationId { get; set; }

    public bool IsActive { get; set; }

    public IReadOnlyList<AdminCatalogCategoryTreeNodeDto> Children { get; set; }
        = new List<AdminCatalogCategoryTreeNodeDto>();
}

public sealed class AdminCatalogCategoryCreateRequestDto
{
    public string ApplicationId { get; set; } = string.Empty;

    public string CategoryName { get; set; } = string.Empty;

    public int ParentCategoryId { get; set; }

    public bool IsActive { get; set; } = true;
}

public sealed class AdminCatalogCategoryUpdateRequestDto
{
    public string CategoryName { get; set; } = string.Empty;

    public int ParentCategoryId { get; set; }

    public bool IsActive { get; set; }
}
