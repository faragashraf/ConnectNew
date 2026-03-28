namespace Persistence.Services.Summer
{
    public static class SummerWorkflowDomainConstants
    {
        public const int DefaultSeasonYear = 2026;
        public const string DynamicApplicationId = "SUM2026DYN";
        public const string DestinationCatalogMend = "SUM2026_DestinationCatalog";

        public const string TransferReviewRequiredCode = "TRANSFER_REVIEW_REQUIRED";
        public const string TransferReviewResolvedCode = "TRANSFER_REVIEW_RESOLVED";

        public static readonly string[] WaveCodeFieldKinds = { "SummerCamp", "SUM2026_WaveCode", "WaveCode" };
        public static readonly string[] WaveLabelFieldKinds = { "SummerCampLabel", "SUM2026_WaveLabel", "WaveLabel" };
        public static readonly string[] FamilyCountFieldKinds = { "FamilyCount", "SUM2026_FamilyCount" };
        public static readonly string[] ExtraCountFieldKinds = { "Over_Count", "SUM2026_ExtraCount", "ExtraCount" };
        public static readonly string[] DestinationIdFieldKinds = { "SummerDestinationId", "SUM2026_DestinationId" };
        public static readonly string[] DestinationNameFieldKinds = { "SummerDestinationName", "SUM2026_DestinationName" };

        public static readonly string[] EmployeeIdFieldKinds = { "Emp_Id", "SUM2026_OwnerFileNumber", "EmployeeFileNumber", "FileNumber", "EmployeeId" };
        public static readonly string[] EmployeeNameFieldKinds = { "Emp_Name", "SUM2026_OwnerName", "EmployeeName", "Name", "ArabicName", "DisplayName" };
        public static readonly string[] EmployeeNationalIdFieldKinds = { "NationalId", "SUM2026_OwnerNationalId", "NationalID", "NATIONAL_ID", "national_id", "NID", "IDNumber" };
        public static readonly string[] EmployeePhoneFieldKinds = { "PhoneNumber", "SUM2026_OwnerPhone", "MobileNumber", "PhoneNo", "Phone_No", "MobilePhone", "phone" };
        public static readonly string[] EmployeeExtraPhoneFieldKinds = { "ExtraPhoneNumber", "SUM2026_OwnerExtraPhone", "SecondaryPhone", "AlternatePhone" };
    }
}
