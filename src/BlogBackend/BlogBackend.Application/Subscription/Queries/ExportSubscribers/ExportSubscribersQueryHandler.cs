using BlogBackend.Domain.Subscription.Ports;
using Mediator;
using System.Text;

namespace BlogBackend.Application.Subscription.Queries.ExportSubscribers;

public class ExportSubscribersQueryHandler : IRequestHandler<ExportSubscribersQuery, byte[]>
{
    private readonly ISubscriberRepository _subscriberRepository;

    public ExportSubscribersQueryHandler(ISubscriberRepository subscriberRepository)
    {
        _subscriberRepository = subscriberRepository;
    }

    public async ValueTask<byte[]> Handle(ExportSubscribersQuery request, CancellationToken cancellationToken)
    {
        var (items, _) = await _subscriberRepository.GetAllAsync(1, int.MaxValue, cancellationToken);

        var sb = new StringBuilder();
        sb.AppendLine("Id,Email,Status,Plan,SubscribedAt");

        foreach (var s in items)
        {
            sb.AppendLine($"{s.Id},{s.Email},{s.Status},{s.Plan},{s.SubscribedAt:O}");
        }

        return Encoding.UTF8.GetBytes(sb.ToString());
    }
}
