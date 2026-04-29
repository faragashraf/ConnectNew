using System.Collections.Concurrent;

namespace Persistence.Services.Summer
{
    internal sealed class SummerAdminActionExecutionGate
    {
        private readonly ConcurrentDictionary<int, SemaphoreSlim> _locks = new();

        public async Task<IAsyncDisposable?> TryEnterAsync(int messageId, int timeoutMs, CancellationToken cancellationToken = default)
        {
            if (messageId <= 0)
            {
                return null;
            }

            var gate = _locks.GetOrAdd(messageId, _ => new SemaphoreSlim(1, 1));
            var entered = await gate.WaitAsync(timeoutMs, cancellationToken);
            if (!entered)
            {
                return null;
            }

            return new GateLease(gate);
        }

        private sealed class GateLease : IAsyncDisposable
        {
            private SemaphoreSlim? _gate;

            public GateLease(SemaphoreSlim gate)
            {
                _gate = gate;
            }

            public ValueTask DisposeAsync()
            {
                var gate = Interlocked.Exchange(ref _gate, null);
                gate?.Release();
                return ValueTask.CompletedTask;
            }
        }
    }
}
