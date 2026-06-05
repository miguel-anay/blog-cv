using BlogBackend.Domain.Blog.Entities;
using BlogBackend.Domain.Blog.Ports;
using BlogBackend.Domain.Common.Exceptions;
using Mediator;

namespace BlogBackend.Application.Blog.Commands.UpdatePost;

public class UpdatePostCommandHandler : IRequestHandler<UpdatePostCommand, Unit>
{
    private readonly IPostRepository _postRepository;

    public UpdatePostCommandHandler(IPostRepository postRepository)
    {
        _postRepository = postRepository;
    }

    public async ValueTask<Unit> Handle(UpdatePostCommand request, CancellationToken cancellationToken)
    {
        var post = await _postRepository.GetByIdAsync(request.Id, cancellationToken)
            ?? throw new NotFoundException(nameof(Post), request.Id);

        post.Update(request.Title, request.BodyMarkdown, request.CategoryId, request.Tags);
        await _postRepository.UpdateAsync(post, cancellationToken);
        return Unit.Value;
    }
}
