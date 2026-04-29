namespace Persistence.Services.Summer
{
    public static class SummerWorkflowDomainConstants
    {
        public const int DefaultSeasonYear = 2026;
        public const string DynamicApplicationId = "SUM2026DYN";
        public const string DestinationCatalogMend = "SUM2026_DestinationCatalog";
        public const string PricingCatalogMend = "SUM2026_PricingCatalog";
        public const int DefaultEditTokenLifetimeMinutes = 30;
        public const int MinEditTokenLifetimeMinutes = 5;
        public const int MaxEditTokenLifetimeMinutes = 120;

        public const string TransferReviewRequiredCode = "TRANSFER_REVIEW_REQUIRED";
        public const string TransferReviewResolvedCode = "TRANSFER_REVIEW_RESOLVED";
        public const string PendingReviewRequiredCode = "PENDING_REVIEW_REQUIRED";
        public const string PendingReviewResolvedCode = "PENDING_REVIEW_RESOLVED";
        public const string DestinationAccessDeniedMessage = "غير مسموح لك بالتسجيل على هذا المصيف";
        public const string RequestCreatedAtUtcFieldKind = "Summer_RequestCreatedAtUtc";
        public const string PaymentDueAtUtcFieldKind = "Summer_PaymentDueAtUtc";
        public const string PaidAtUtcFieldKind = "Summer_PaidAtUtc";
        public const string PaymentStatusFieldKind = "Summer_PaymentStatus";
        public const string ActionTypeFieldKind = "Summer_ActionType";

        public static readonly string[] WaveCodeFieldKinds = { "SummerCamp", "SUM2026_WaveCode", "WaveCode" };
        public static readonly string[] WaveLabelFieldKinds = { "SummerCampLabel", "SUM2026_WaveLabel", "WaveLabel" };
        public static readonly string[] WaveStartsAtIsoFieldKinds = { "SummerWaveStartsAtIso", "SUM2026_WaveStartsAtIso", "WaveStartsAtIso" };
        public static readonly string[] FamilyCountFieldKinds = { "FamilyCount", "SUM2026_FamilyCount" };
        public static readonly string[] ExtraCountFieldKinds = { "Over_Count", "SUM2026_ExtraCount", "ExtraCount" };
        public static readonly string[] SeasonYearFieldKinds = { "SummerSeasonYear", "SUM2026_SeasonYear", "SeasonYear" };
        public static readonly string[] StayModeFieldKinds = { "SummerStayMode", "SUM2026_StayMode", "StayMode" };
        public static readonly string[] ProxyModeFieldKinds = { "SummerProxyMode", "SUM2026_ProxyMode", "ProxyMode" };
        public static readonly string[] MembershipTypeFieldKinds = { "SummerMembershipType", "SUM2026_MembershipType", "MembershipType" };
        public static readonly string[] UseFrozenUnitFieldKinds = { "Summer_UseFrozenUnit", "SUM2026_UseFrozenUnit", "UseFrozenUnit" };
        public static readonly string[] DestinationIdFieldKinds = { "SummerDestinationId", "SUM2026_DestinationId" };
        public static readonly string[] DestinationNameFieldKinds = { "SummerDestinationName", "SUM2026_DestinationName" };
        public static readonly string[] PaymentModeFieldKinds = { "Summer_PaymentMode", "SUM2026_PaymentMode", "PaymentMode" };
        public static readonly string[] InstallmentCountFieldKinds = { "Summer_PaymentInstallmentCount", "SUM2026_PaymentInstallmentCount" };
        public static readonly string[] InstallmentsTotalFieldKinds = { "Summer_PaymentInstallmentsTotal", "SUM2026_PaymentInstallmentsTotal" };

        public static readonly string[] EmployeeIdFieldKinds = { "Emp_Id", "SUM2026_OwnerFileNumber", "EmployeeFileNumber", "FileNumber", "EmployeeId" };
        public static readonly string[] EmployeeNameFieldKinds = { "Emp_Name", "SUM2026_OwnerName", "EmployeeName", "Name", "ArabicName", "DisplayName" };
        public static readonly string[] EmployeeNationalIdFieldKinds = { "NationalId", "SUM2026_OwnerNationalId", "NationalID", "NATIONAL_ID", "national_id", "NID", "IDNumber" };
        public static readonly string[] EmployeePhoneFieldKinds = { "PhoneNumber", "SUM2026_OwnerPhone", "MobileNumber", "PhoneNo", "Phone_No", "MobilePhone", "phone" };
        public static readonly string[] EmployeeExtraPhoneFieldKinds = { "ExtraPhoneNumber", "SUM2026_OwnerExtraPhone", "SecondaryPhone", "AlternatePhone" };

        public static class StayModes
        {
            public const string ResidenceOnly = "RESIDENCE_ONLY";
            public const string ResidenceWithTransport = "RESIDENCE_WITH_TRANSPORT";
        }

        public static class DestinationCategoryIds
        {
            public const int Matrouh = 147;
            public const int RasElBar = 148;
            public const int PortFouad = 149;
        }

        public static class PricingModes
        {
            public const string AccommodationOnlyAllowed = "AccommodationOnlyAllowed";
            public const string AccommodationAndTransportationOptional = "AccommodationAndTransportationOptional";
            public const string TransportationMandatoryIncluded = "TransportationMandatoryIncluded";
        }

        public static class MembershipTypes
        {
            public const string Worker = "WORKER_MEMBER";
            public const string NonWorker = "NON_WORKER_MEMBER";
        }

        public static class PaymentModes
        {
            public const string Cash = "CASH";
            public const string Installment = "INSTALLMENT";
            public const int MinInstallmentCount = 2;
            public const int MaxInstallmentCount = 7;
            public const int DefaultInstallmentCount = 7;
        }

        public static string[] GetInstallmentAmountFieldKinds(int installmentNo)
        {
            var number = Math.Clamp(installmentNo, 1, PaymentModes.MaxInstallmentCount);
            return new[]
            {
                $"Summer_PaymentInstallment{number}Amount",
                $"SUM2026_PaymentInstallment{number}Amount"
            };
        }

        public static string[] GetInstallmentPaidFieldKinds(int installmentNo)
        {
            var number = Math.Clamp(installmentNo, 1, PaymentModes.MaxInstallmentCount);
            return new[]
            {
                $"Summer_PaymentInstallment{number}Paid",
                $"SUM2026_PaymentInstallment{number}Paid"
            };
        }

        public static string[] GetInstallmentPaidAtFieldKinds(int installmentNo)
        {
            var number = Math.Clamp(installmentNo, 1, PaymentModes.MaxInstallmentCount);
            return new[]
            {
                $"Summer_PaymentInstallment{number}PaidAtUtc",
                $"SUM2026_PaymentInstallment{number}PaidAtUtc"
            };
        }

        public static class PricingFieldKinds
        {
            public const string ConfigId = "Summer_PricingConfigId";
            public const string PolicyId = "Summer_PricingPolicyId";
            public const string PricingMode = "Summer_PricingMode";
            public const string MembershipType = "Summer_PricingMembershipType";
            public const string TransportationMandatory = "Summer_PricingTransportationMandatory";
            public const string SelectedStayMode = "Summer_PricingSelectedStayMode";
            public const string PersonsCount = "Summer_PricingPersonsCount";
            public const string PeriodKey = "Summer_PricingPeriodKey";
            public const string WaveDate = "Summer_PricingWaveDate";
            public const string AccommodationPricePerPerson = "Summer_PricingAccommodationPricePerPerson";
            public const string TransportationPricePerPerson = "Summer_PricingTransportationPricePerPerson";
            public const string AccommodationTotal = "Summer_PricingAccommodationTotal";
            public const string TransportationTotal = "Summer_PricingTransportationTotal";
            public const string InsuranceAmount = "Summer_PricingInsuranceAmount";
            public const string ProxyInsuranceAmount = "Summer_PricingProxyInsuranceAmount";
            public const string AppliedInsuranceAmount = "Summer_PricingAppliedInsuranceAmount";
            public const string GrandTotal = "Summer_PricingGrandTotal";
            public const string DisplayText = "Summer_PricingDisplayText";
            public const string SmsText = "Summer_PricingSmsText";
            public const string WhatsAppText = "Summer_PricingWhatsAppText";
        }

        public static class RequestTokenPurposes
        {
            public const string Generic = "GENERIC_REQUEST_LINK";
            public const string SummerEdit = "SUMMER_REQUEST_EDIT";
        }

        public static class AuthorizationFunctions
        {
            public const string SummerAdmin = "SummerAdminFunc";
            public const string SummerPricing = "SummerGeneralManagerFunc";
            public const string ConnectSuperAdmin = "ConnectSupperAdminFunc";
        }

        public static class AuthorizationRoles
        {
            public const string SummerAdmin = "2020";
            public const string SummerGeneralManager = "2021";
            public const string ConnectSuperAdmin = "2003";
        }
    }
}
