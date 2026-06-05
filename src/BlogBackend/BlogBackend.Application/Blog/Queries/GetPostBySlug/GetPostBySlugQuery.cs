using BlogBackend.Application.Blog.DTOs;
using Mediator;

namespace BlogBackend.Application.Blog.Queries.GetPostBySlug;

public record GetPostBySlugQuery(string Slug) : IRequest<PostDto>;
