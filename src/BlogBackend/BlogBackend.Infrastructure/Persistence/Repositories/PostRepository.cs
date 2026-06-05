using BlogBackend.Domain.Blog.Entities;
using BlogBackend.Domain.Blog.Ports;
using Microsoft.EntityFrameworkCore;

namespace BlogBackend.Infrastructure.Persistence.Repositories;

public class PostRepository : IPostRepository
{
    private readonly BlogDbContext _context;

    public PostRepository(BlogDbContext context)
    {
        _context = context;
    }

    public async Task<Post?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => await _context.Posts.FindAsync(new object[] { id }, cancellationToken);

    public async Task<Post?> GetBySlugAsync(string slug, CancellationToken cancellationToken = default)
        => await _context.Posts.FirstOrDefaultAsync(p => p.Slug == slug, cancellationToken);

    public async Task<(IReadOnlyList<Post> Items, int TotalCount)> GetAllAsync(
        int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var totalCount = await _context.Posts.CountAsync(cancellationToken);
        var items = await _context.Posts
            .OrderByDescending(p => p.PublishedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items.AsReadOnly(), totalCount);
    }

    public async Task AddAsync(Post post, CancellationToken cancellationToken = default)
    {
        await _context.Posts.AddAsync(post, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateAsync(Post post, CancellationToken cancellationToken = default)
    {
        _context.Posts.Update(post);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var post = await GetByIdAsync(id, cancellationToken);
        if (post is not null)
        {
            _context.Posts.Remove(post);
            await _context.SaveChangesAsync(cancellationToken);
        }
    }
}
