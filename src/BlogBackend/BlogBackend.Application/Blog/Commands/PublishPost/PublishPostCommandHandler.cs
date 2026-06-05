using BlogBackend.Domain.Blog.Ports;
using BlogBackend.Domain.Common.Exceptions;
using Mediator;

namespace BlogBackend.Application.Blog.Commands.PublishPost;

public class PublishPostCommandHandler : IRequestHandler<PublishPostCommand, Unit>
{
    private readonly IPostRepository _postRepository;

    public PublishPostCommandHandler(IPostRepository postRepository)
    {
        _postRepository = postRepository;
    }

    public async ValueTask<Unit> Handle(PublishPostCommand request, CancellationToken cancellationToken)
    {
        var post = await _postRepository.GetByIdAsync(request.PostId, cancellationToken)
            ?? throw new NotFoundException("Post", request.PostId);

        post.Publish();
        await _postRepository.UpdateAsync(post, cancellationToken);
        return Unit.Value;
    }
}
