using Mediator;

namespace BlogBackend.Application.Blog.Commands.CreateTag;

public record CreateTagCommand(string Name) : IRequest<Guid>;
