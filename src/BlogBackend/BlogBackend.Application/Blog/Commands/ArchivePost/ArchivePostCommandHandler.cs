using BlogBackend.Domain.Blog.Ports;
using BlogBackend.Domain.Common.Exceptions;
using Mediator;

namespace BlogBackend.Application.Blog.Commands.ArchivePost;

public class ArchivePostCommandHandler : IRequestHandler<ArchivePostCommand, Unit>
{
    private readonly IPostRepository _postRepository;

    public ArchivePostCommandHandler(IPostRepository postRepository)
    {
        _postRepository = postRepository;
    }

    public async ValueTask<Unit> Handle(ArchivePostCommand request, CancellationToken cancellationToken)
    {
        var post = await _postRepository.GetByIdAsync(request.PostId, cancellationToken)
            ?? throw new NotFoundException("Post", request.PostId);

        post.Archive();
        await _postRepository.UpdateAsync(post, cancellationToken);
        return Unit.Value;
    }
}
