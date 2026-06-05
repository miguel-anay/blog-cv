using BlogBackend.Domain.Subscription.Entities;
using BlogBackend.Domain.Subscription.Ports;
using Microsoft.EntityFrameworkCore;

namespace BlogBackend.Infrastructure.Persistence.Repositories;

public class SubscriberRepository : ISubscriberRepository
{
    private readonly BlogDbContext _context;

    public SubscriberRepository(BlogDbContext context)
    {
        _context = context;
    }

    public async Task<Subscriber?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => await _context.Subscribers.FindAsync(new object[] { id }, cancellationToken);

    public async Task<Subscriber?> GetByEmailAsync(string email, CancellationToken cancellationToken = default)
        => await _context.Subscribers.FirstOrDefaultAsync(s => s.Email == email, cancellationToken);

    public async Task<(IReadOnlyList<Subscriber> Items, int TotalCount)> GetAllAsync(
        int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var totalCount = await _context.Subscribers.CountAsync(cancellationToken);
        var items = await _context.Subscribers
            .OrderByDescending(s => s.SubscribedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items.AsReadOnly(), totalCount);
    }

    public async Task AddAsync(Subscriber subscriber, CancellationToken cancellationToken = default)
    {
        await _context.Subscribers.AddAsync(subscriber, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateAsync(Subscriber subscriber, CancellationToken cancellationToken = default)
    {
        _context.Subscribers.Update(subscriber);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
