using System.Net;
using System.Net.Mail;
using BlogBackend.Domain.Subscription.Ports;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace BlogBackend.Infrastructure.Email;

public class SmtpEmailNotificationAdapter : IEmailNotificationPort
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<SmtpEmailNotificationAdapter> _logger;

    public SmtpEmailNotificationAdapter(
        IConfiguration configuration,
        ILogger<SmtpEmailNotificationAdapter> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken = default)
    {
        var host = _configuration["SMTP__Host"] ?? "localhost";
        var port = int.TryParse(_configuration["SMTP__Port"], out var p) ? p : 1025;
        var from = _configuration["SMTP__From"] ?? "noreply@blog.miguel-anay.nom.pe";

        using var smtpClient = new SmtpClient(host, port)
        {
            EnableSsl = false,
            Credentials = CredentialCache.DefaultNetworkCredentials
        };

        using var message = new MailMessage(from, to, subject, body)
        {
            IsBodyHtml = false
        };

        try
        {
            await smtpClient.SendMailAsync(message, cancellationToken);
            _logger.LogInformation("Email sent to {To} with subject '{Subject}'.", to, subject);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {To}.", to);
            throw;
        }
    }
}
