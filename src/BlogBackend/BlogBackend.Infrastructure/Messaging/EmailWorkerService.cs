using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace BlogBackend.Infrastructure.Messaging;

public class EmailWorkerService : BackgroundService
{
    private readonly IBackgroundTaskQueue _taskQueue;
    private readonly ILogger<EmailWorkerService> _logger;
    private const int MaxRetries = 3;

    public EmailWorkerService(IBackgroundTaskQueue taskQueue, ILogger<EmailWorkerService> logger)
    {
        _taskQueue = taskQueue;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Email Worker Service started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            Func<CancellationToken, ValueTask> workItem;
            try
            {
                workItem = await _taskQueue.DequeueAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }

            await ExecuteWithRetryAsync(workItem, stoppingToken);
        }

        _logger.LogInformation("Email Worker Service stopped.");
    }

    private async Task ExecuteWithRetryAsync(
        Func<CancellationToken, ValueTask> workItem,
        CancellationToken cancellationToken)
    {
        for (var attempt = 1; attempt <= MaxRetries; attempt++)
        {
            try
            {
                await workItem(cancellationToken);
                return;
            }
            catch (Exception ex) when (attempt < MaxRetries)
            {
                var delay = TimeSpan.FromSeconds(Math.Pow(2, attempt));
                _logger.LogWarning(ex,
                    "Email task failed on attempt {Attempt}/{MaxRetries}. Retrying in {Delay}s.",
                    attempt, MaxRetries, delay.TotalSeconds);
                await Task.Delay(delay, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Email task failed after {MaxRetries} attempts. Discarding.",
                    MaxRetries);
            }
        }
    }
}
