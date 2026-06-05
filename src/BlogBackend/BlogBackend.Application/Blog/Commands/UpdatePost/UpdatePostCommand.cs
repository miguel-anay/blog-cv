using Mediator;

namespace BlogBackend.Application.Blog.Commands.UpdatePost;

public record UpdatePostCommand(
    Guid Id,
    string Title,
    string BodyMarkdown,
    Guid? CategoryId,
    List<string> Tags) : IRequest<Unit>;
