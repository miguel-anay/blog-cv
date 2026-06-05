using Mediator;

namespace BlogBackend.Application.Blog.Commands.ArchivePost;

public record ArchivePostCommand(Guid PostId) : IRequest<Unit>;
