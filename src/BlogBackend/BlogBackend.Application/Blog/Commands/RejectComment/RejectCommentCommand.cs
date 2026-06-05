using Mediator;

namespace BlogBackend.Application.Blog.Commands.RejectComment;

public record RejectCommentCommand(Guid CommentId) : IRequest<Unit>;
