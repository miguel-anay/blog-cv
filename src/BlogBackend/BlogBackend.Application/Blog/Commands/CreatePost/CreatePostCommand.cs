using Mediator;

namespace BlogBackend.Application.Blog.Commands.CreatePost;

public record CreatePostCommand(
    string Title,
    string Slug,
    string BodyMarkdown,
    Guid AuthorId,
    Guid? CategoryId,
    List<string> Tags) : IRequest<Guid>;
