using BlogBackend.Domain.Blog.Ports;
using BlogBackend.Domain.Common.Exceptions;
using Mediator;

namespace BlogBackend.Application.Blog.Commands.DeleteComment;

public class DeleteCommentCommandHandler : IRequestHandler<DeleteCommentCommand, Unit>
{
    private readonly ICommentRepository _commentRepository;

    public DeleteCommentCommandHandler(ICommentRepository commentRepository)
    {
        _commentRepository = commentRepository;
    }

    public async ValueTask<Unit> Handle(DeleteCommentCommand request, CancellationToken cancellationToken)
    {
        var comment = await _commentRepository.GetByIdAsync(request.CommentId, cancellationToken)
            ?? throw new NotFoundException("Comment", request.CommentId);

        await _commentRepository.DeleteAsync(comment.Id, cancellationToken);
        return Unit.Value;
    }
}
