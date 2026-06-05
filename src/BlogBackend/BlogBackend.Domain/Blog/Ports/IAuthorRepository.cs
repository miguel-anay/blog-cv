using BlogBackend.Domain.Blog.Entities;

namespace BlogBackend.Domain.Blog.Ports;

public interface IAuthorRepository
{
    Task<Author?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Author>> GetAllAsync(CancellationToken cancellationToken = default);
    Task AddAsync(Author author, CancellationToken cancellationToken = default);
    Task UpdateAsync(Author author, CancellationToken cancellationToken = default);
}
