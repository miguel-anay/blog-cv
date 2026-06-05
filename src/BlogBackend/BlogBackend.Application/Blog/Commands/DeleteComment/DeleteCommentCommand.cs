using Mediator;

namespace BlogBackend.Application.Blog.Commands.DeleteComment;

public record DeleteCommentCommand(Guid CommentId) : IRequest<Unit>;
