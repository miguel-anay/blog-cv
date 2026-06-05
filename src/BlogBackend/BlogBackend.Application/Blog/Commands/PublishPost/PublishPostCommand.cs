using Mediator;

namespace BlogBackend.Application.Blog.Commands.PublishPost;

public record PublishPostCommand(Guid PostId) : IRequest<Unit>;
