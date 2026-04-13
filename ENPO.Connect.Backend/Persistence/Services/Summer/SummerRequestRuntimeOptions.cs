namespace Persistence.Services.Summer;

public sealed class SummerRequestRuntimeOptions
{
    public static SummerRequestRuntimeOptions Default { get; } = new();

    // Seed mode can suppress external side effects (SignalR/SMS/WhatsApp) while preserving create logic.
    public bool SuppressNotifications { get; init; }

    // Seed mode can skip expensive response hydration that depends on external systems.
    public bool SkipResponseHydration { get; init; }

    // Mirrors SummerAdminFunc permission from the authenticated caller.
    public bool HasSummerAdminPermission { get; init; }

    // Mirrors role-id 2021 (Summer general manager) from the authenticated caller token.
    public bool HasSummerGeneralManagerPermission { get; init; }
}
