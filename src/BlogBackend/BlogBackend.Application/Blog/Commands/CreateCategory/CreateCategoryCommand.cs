using Mediator;

namespace BlogBackend.Application.Blog.Commands.CreateCategory;

public record CreateCategoryCommand(string Name, string Slug) : IRequest<Guid>;
