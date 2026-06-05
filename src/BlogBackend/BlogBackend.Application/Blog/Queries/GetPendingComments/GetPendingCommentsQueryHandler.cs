using BlogBackend.Domain.Blog.Entities;
using BlogBackend.Domain.Blog.Ports;
using Mediator;

namespace BlogBackend.Application.Blog.Queries.GetPendingComments;

public class GetPendingCommentsQueryHandler : IRequestHandler<GetPendingCommentsQuery, IReadOnlyList<Comment>>
{
    private readonly ICommentRepository _commentRepository;

    public GetPendingCommentsQueryHandler(ICommentRepository commentRepository)
    {
        _commentRepository = commentRepository;
    }

    public async ValueTask<IReadOnlyList<Comment>> Handle(GetPendingCommentsQuery request, CancellationToken cancellationToken)
    {
        return await _commentRepository.GetPendingAsync(cancellationToken);
    }
}
