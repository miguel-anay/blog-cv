using BlogBackend.Domain.Blog.Entities;
using BlogBackend.Domain.Blog.Ports;
using Mediator;

namespace BlogBackend.Application.Blog.Commands.SubmitComment;

public class SubmitCommentCommandHandler : IRequestHandler<SubmitCommentCommand, Guid>
{
    private readonly ICommentRepository _commentRepository;

    public SubmitCommentCommandHandler(ICommentRepository commentRepository)
    {
        _commentRepository = commentRepository;
    }

    public async ValueTask<Guid> Handle(SubmitCommentCommand request, CancellationToken cancellationToken)
    {
        var comment = new Comment(Guid.NewGuid(), request.PostId, request.AuthorEmail, request.Body);
        await _commentRepository.AddAsync(comment, cancellationToken);
        return comment.Id;
    }
}
