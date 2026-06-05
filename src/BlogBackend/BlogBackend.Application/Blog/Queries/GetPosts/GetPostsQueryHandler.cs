using BlogBackend.Application.Blog.DTOs;
using BlogBackend.Application.Common.DTOs;
using BlogBackend.Domain.Blog.Ports;
using Mediator;

namespace BlogBackend.Application.Blog.Queries.GetPosts;

public class GetPostsQueryHandler : IRequestHandler<GetPostsQuery, PagedResult<PostDto>>
{
    private readonly IPostRepository _postRepository;

    public GetPostsQueryHandler(IPostRepository postRepository)
    {
        _postRepository = postRepository;
    }

    public async ValueTask<PagedResult<PostDto>> Handle(GetPostsQuery request, CancellationToken cancellationToken)
    {
        var (items, totalCount) = await _postRepository.GetAllAsync(request.Page, request.PageSize, cancellationToken);

        var filtered = request.Status.HasValue
            ? items.Where(p => p.Status == request.Status.Value).ToList()
            : items.ToList();

        var dtos = filtered.Select(p => new PostDto(
            p.Id,
            p.Title,
            p.Slug,
            p.BodyMarkdown,
            p.Status,
            p.AuthorId,
            p.CategoryId,
            p.PublishedAt,
            p.Tags)).ToList();

        return new PagedResult<PostDto>(dtos, totalCount, request.Page, request.PageSize);
    }
}
