using BlogBackend.Domain.Blog.Entities;
using BlogBackend.Domain.Blog.Ports;
using Mediator;

namespace BlogBackend.Application.Blog.Commands.CreatePost;

public class CreatePostCommandHandler : IRequestHandler<CreatePostCommand, Guid>
{
    private readonly IPostRepository _postRepository;

    public CreatePostCommandHandler(IPostRepository postRepository)
    {
        _postRepository = postRepository;
    }

    public async ValueTask<Guid> Handle(CreatePostCommand request, CancellationToken cancellationToken)
    {
        var post = Post.Create(
            request.Title,
            request.Slug,
            request.BodyMarkdown,
            request.AuthorId,
            request.CategoryId,
            request.Tags);

        await _postRepository.AddAsync(post, cancellationToken);
        return post.Id;
    }
}
