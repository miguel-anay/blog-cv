using BlogBackend.Application.Blog.DTOs;
using BlogBackend.Application.Common.DTOs;
using BlogBackend.Domain.Blog.Entities;
using Mediator;

namespace BlogBackend.Application.Blog.Queries.GetPosts;

public record GetPostsQuery(int Page, int PageSize, PostStatus? Status) : IRequest<PagedResult<PostDto>>;
