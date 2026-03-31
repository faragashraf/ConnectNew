namespace Models.DTO.Common;

public class ResortBookingBlacklistOptions
{
    public const string SectionName = "ResortBookingBlacklist";

    public List<string> BlockedFileNumbers { get; set; } = new();
}
