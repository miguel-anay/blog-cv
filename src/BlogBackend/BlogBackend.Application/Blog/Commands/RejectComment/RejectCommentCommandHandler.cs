using BlogBackend.Domain.Blog.Ports;
using BlogBackend.Domain.Common.Exceptions;
using Mediator;

namespace BlogBackend.Application.Blog.Commands.RejectComment;

public class RejectCommentCommandHandler : IRequestHandler<RejectCommentCommand, Unit>
{
    private readonly ICommentRepository _commentRepository;

    public RejectCommentCommandHandler(ICommentRepository commentRepository)
    {
        _commentRepository = commentRepository;
    }

    public async ValueTask<Unit> Handle(RejectCommentCommand request, CancellationToken cancellationToken)
    {
        var comment = await _commentRepository.GetByIdAsync(request.CommentId, cancellationToken)
            ?? throw new NotFoundException("Comment", request.CommentId);

        comment.Reject();
        await _commentRepository.UpdateAsync(comment, cancellationToken);
        return Unit.Value;
    }
}
