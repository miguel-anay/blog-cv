using BlogBackend.Domain.Blog.Entities;

namespace BlogBackend.Domain.Blog.Ports;

public interface ICommentRepository
{
    Task<Comment?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<(IReadOnlyList<Comment> Items, int TotalCount)> GetByPostIdAsync(Guid postId, int page, int pageSize, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<Comment>> GetPendingAsync(CancellationToken cancellationToken = default);
    Task<int> CountAllAsync(CancellationToken cancellationToken = default);
    Task AddAsync(Comment comment, CancellationToken cancellationToken = default);
    Task UpdateAsync(Comment comment, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);
}
