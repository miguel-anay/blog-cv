using BlogBackend.Domain.Blog.Entities;
using BlogBackend.Domain.Blog.Ports;
using Microsoft.EntityFrameworkCore;

namespace BlogBackend.Infrastructure.Persistence.Repositories;

public class CommentRepository : ICommentRepository
{
    private readonly BlogDbContext _context;

    public CommentRepository(BlogDbContext context)
    {
        _context = context;
    }

    public async Task<Comment?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => await _context.Comments.FindAsync(new object[] { id }, cancellationToken);

    public async Task<(IReadOnlyList<Comment> Items, int TotalCount)> GetByPostIdAsync(
        Guid postId, int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var totalCount = await _context.Comments.CountAsync(c => c.PostId == postId, cancellationToken);
        var items = await _context.Comments
            .Where(c => c.PostId == postId)
            .OrderByDescending(c => c.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items.AsReadOnly(), totalCount);
    }

    public async Task<IReadOnlyList<Comment>> GetPendingAsync(CancellationToken cancellationToken = default)
    {
        var items = await _context.Comments
            .Where(c => c.Status == CommentStatus.Pending)
            .OrderByDescending(c => c.Id)
            .ToListAsync(cancellationToken);
        return items.AsReadOnly();
    }

    public async Task<int> CountAllAsync(CancellationToken cancellationToken = default)
        => await _context.Comments.CountAsync(cancellationToken);

    public async Task AddAsync(Comment comment, CancellationToken cancellationToken = default)
    {
        await _context.Comments.AddAsync(comment, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateAsync(Comment comment, CancellationToken cancellationToken = default)
    {
        _context.Comments.Update(comment);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var comment = await GetByIdAsync(id, cancellationToken);
        if (comment is not null)
        {
            _context.Comments.Remove(comment);
            await _context.SaveChangesAsync(cancellationToken);
        }
    }
}
