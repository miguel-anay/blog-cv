using Mediator;

namespace BlogBackend.Application.Blog.Commands.SubmitComment;

public record SubmitCommentCommand(Guid PostId, string? AuthorEmail, string Body) : IRequest<Guid>;
