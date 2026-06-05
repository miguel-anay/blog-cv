using BlogBackend.Application.Blog.DTOs;
using BlogBackend.Domain.Blog.Ports;
using BlogBackend.Domain.Common.Exceptions;
using Mediator;

namespace BlogBackend.Application.Blog.Queries.GetPostBySlug;

public class GetPostBySlugQueryHandler : IRequestHandler<GetPostBySlugQuery, PostDto>
{
    private readonly IPostRepository _postRepository;

    public GetPostBySlugQueryHandler(IPostRepository postRepository)
    {
        _postRepository = postRepository;
    }

    public async ValueTask<PostDto> Handle(GetPostBySlugQuery request, CancellationToken cancellationToken)
    {
        var post = await _postRepository.GetBySlugAsync(request.Slug, cancellationToken)
            ?? throw new NotFoundException("Post", request.Slug);

        return new PostDto(
            post.Id,
            post.Title,
            post.Slug,
            post.BodyMarkdown,
            post.Status,
            post.AuthorId,
            post.CategoryId,
            post.PublishedAt,
            post.Tags);
    }
}
