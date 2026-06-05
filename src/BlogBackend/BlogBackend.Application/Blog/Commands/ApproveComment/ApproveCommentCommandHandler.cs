using BlogBackend.Domain.Blog.Ports;
using BlogBackend.Domain.Common.Exceptions;
using Mediator;

namespace BlogBackend.Application.Blog.Commands.ApproveComment;

public class ApproveCommentCommandHandler : IRequestHandler<ApproveCommentCommand, Unit>
{
    private readonly ICommentRepository _commentRepository;

    public ApproveCommentCommandHandler(ICommentRepository commentRepository)
    {
        _commentRepository = commentRepository;
    }

    public async ValueTask<Unit> Handle(ApproveCommentCommand request, CancellationToken cancellationToken)
    {
        var comment = await _commentRepository.GetByIdAsync(request.CommentId, cancellationToken)
            ?? throw new NotFoundException("Comment", request.CommentId);

        comment.Approve();
        await _commentRepository.UpdateAsync(comment, cancellationToken);
        return Unit.Value;
    }
}
