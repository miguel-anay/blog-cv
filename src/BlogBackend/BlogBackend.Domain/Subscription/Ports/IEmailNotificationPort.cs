namespace BlogBackend.Domain.Subscription.Ports;

public interface IEmailNotificationPort
{
    Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken = default);
}
