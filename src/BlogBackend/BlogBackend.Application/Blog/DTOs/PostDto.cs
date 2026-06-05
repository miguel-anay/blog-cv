using BlogBackend.Domain.Blog.Entities;

namespace BlogBackend.Application.Blog.DTOs;

public record PostDto(
    Guid Id,
    string Title,
    string Slug,
    string BodyMarkdown,
    PostStatus Status,
    Guid AuthorId,
    Guid? CategoryId,
    DateTime? PublishedAt,
    IReadOnlyList<string> Tags);
