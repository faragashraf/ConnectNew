using Persistence.Services;

namespace Api.HostedServices
{
    public class SummerPaymentAutoCancellationHostedService : BackgroundService
    {
        private static readonly TimeSpan CheckInterval = TimeSpan.FromMinutes(5);
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<SummerPaymentAutoCancellationHostedService> _logger;

        public SummerPaymentAutoCancellationHostedService(
            IServiceScopeFactory scopeFactory,
            ILogger<SummerPaymentAutoCancellationHostedService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            await Task.Delay(TimeSpan.FromSeconds(20), stoppingToken);

            while (!stoppingToken.IsCancellationRequested)
            {
                await RunCycleAsync(stoppingToken);

                try
                {
                    await Task.Delay(CheckInterval, stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        }

        private async Task RunCycleAsync(CancellationToken cancellationToken)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var workflowService = scope.ServiceProvider.GetRequiredService<SummerWorkflowService>();
                var cancelledCount = await workflowService.AutoCancelExpiredUnpaidRequestsAsync(cancellationToken);
                if (cancelledCount > 0)
                {
                    _logger.LogInformation("Summer auto-cancel cycle completed. Auto-cancelled requests: {Count}", cancelledCount);
                }
            }
            catch (OperationCanceledException)
            {
                // Application stopping.
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Summer auto-cancel cycle failed.");
            }
        }
    }
}
