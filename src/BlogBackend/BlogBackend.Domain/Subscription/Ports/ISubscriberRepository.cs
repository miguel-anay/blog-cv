using BlogBackend.Domain.Subscription.Entities;

namespace BlogBackend.Domain.Subscription.Ports;

public interface ISubscriberRepository
{
    Task<Subscriber?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<Subscriber?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);
    Task<(IReadOnlyList<Subscriber> Items, int TotalCount)> GetAllAsync(int page, int pageSize, CancellationToken cancellationToken = default);
    Task AddAsync(Subscriber subscriber, CancellationToken cancellationToken = default);
    Task UpdateAsync(Subscriber subscriber, CancellationToken cancellationToken = default);
}
