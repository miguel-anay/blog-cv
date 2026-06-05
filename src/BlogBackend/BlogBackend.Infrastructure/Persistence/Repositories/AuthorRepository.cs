using BlogBackend.Domain.Blog.Entities;
using BlogBackend.Domain.Blog.Ports;
using Microsoft.EntityFrameworkCore;

namespace BlogBackend.Infrastructure.Persistence.Repositories;

public class AuthorRepository : IAuthorRepository
{
    private readonly BlogDbContext _context;

    public AuthorRepository(BlogDbContext context)
    {
        _context = context;
    }

    public async Task<Author?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => await _context.Authors.FindAsync(new object[] { id }, cancellationToken);

    public async Task<IReadOnlyList<Author>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var items = await _context.Authors
            .OrderBy(a => a.DisplayName)
            .ToListAsync(cancellationToken);
        return items.AsReadOnly();
    }

    public async Task AddAsync(Author author, CancellationToken cancellationToken = default)
    {
        await _context.Authors.AddAsync(author, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateAsync(Author author, CancellationToken cancellationToken = default)
    {
        _context.Authors.Update(author);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
