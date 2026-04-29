using Microsoft.Extensions.Options;
using Models.DTO.Common;
using Persistence.Services.Summer;
using Xunit;

namespace Persistence.Tests;

public class SummerBookingBlacklistServiceTests
{
    [Fact]
    public void IsBlocked_ReturnsTrue_WithTrimmedAndArabicDigitsNormalization()
    {
        var options = new ResortBookingBlacklistOptions
        {
            BlockedFileNumbers = new List<string> { "١٢٣٤٥", " 67890 " }
        };
        var service = new SummerBookingBlacklistService(new StaticOptionsMonitor<ResortBookingBlacklistOptions>(options));

        Assert.True(service.IsBlocked(" 12345 "));
        Assert.True(service.IsBlocked("67890"));
    }

    [Fact]
    public void IsBlocked_ReturnsFalse_WhenListIsEmptyOrMissing()
    {
        var options = new ResortBookingBlacklistOptions
        {
            BlockedFileNumbers = new List<string>()
        };
        var service = new SummerBookingBlacklistService(new StaticOptionsMonitor<ResortBookingBlacklistOptions>(options));

        Assert.False(service.IsBlocked("12345"));
        Assert.False(service.IsBlocked(null));
        Assert.False(service.IsBlocked(string.Empty));
    }

    [Fact]
    public void IsBlocked_ReturnsFalse_WhenBlockedListIsNull()
    {
        var options = new ResortBookingBlacklistOptions
        {
            BlockedFileNumbers = null!
        };
        var service = new SummerBookingBlacklistService(new StaticOptionsMonitor<ResortBookingBlacklistOptions>(options));

        Assert.False(service.IsBlocked("12345"));
    }

    [Fact]
    public void NormalizeFileNumber_RemovesSpaces_AndKeepsStableToken()
    {
        var normalized = SummerBookingBlacklistService.NormalizeFileNumber("  12  34 5  ");
        Assert.Equal("12345", normalized);
    }

    private sealed class StaticOptionsMonitor<T> : IOptionsMonitor<T>
        where T : class, new()
    {
        public StaticOptionsMonitor(T currentValue)
        {
            CurrentValue = currentValue;
        }

        public T CurrentValue { get; private set; }

        public T Get(string? name)
        {
            return CurrentValue;
        }

        public IDisposable OnChange(Action<T, string?> listener)
        {
            return NullDisposable.Instance;
        }

        private sealed class NullDisposable : IDisposable
        {
            public static readonly NullDisposable Instance = new();

            public void Dispose()
            {
            }
        }
    }
}
