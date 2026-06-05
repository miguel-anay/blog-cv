using Mediator;

namespace BlogBackend.Application.Blog.Commands.ApproveComment;

public record ApproveCommentCommand(Guid CommentId) : IRequest<Unit>;
