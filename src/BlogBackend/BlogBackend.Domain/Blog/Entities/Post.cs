using System.Text.RegularExpressions;
using BlogBackend.Domain.Common.Exceptions;

namespace BlogBackend.Domain.Blog.Entities;

public class Post
{
    private static readonly Regex SlugPattern = new(
        @"^[a-z0-9]+(?:-[a-z0-9]+)*$",
        RegexOptions.Compiled);

    public Guid Id { get; private set; }
    public string Title { get; private set; }
    public string Slug { get; private set; }
    public string BodyMarkdown { get; private set; }
    public PostStatus Status { get; private set; }
    public Guid AuthorId { get; private set; }
    public Guid? CategoryId { get; private set; }
    public DateTime? PublishedAt { get; private set; }
    public IReadOnlyList<string> Tags { get; private set; }

    private Post(
        Guid id,
        string title,
        string slug,
        string bodyMarkdown,
        PostStatus status,
        Guid authorId,
        Guid? categoryId,
        DateTime? publishedAt,
        IReadOnlyList<string> tags)
    {
        Id = id;
        Title = title;
        Slug = slug;
        BodyMarkdown = bodyMarkdown;
        Status = status;
        AuthorId = authorId;
        CategoryId = categoryId;
        PublishedAt = publishedAt;
        Tags = tags;
    }

    public static Post Create(
        string title,
        string slug,
        string bodyMarkdown,
        Guid authorId,
        Guid? categoryId,
        IEnumerable<string> tags)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new DomainException("Post title must not be empty.");

        if (!SlugPattern.IsMatch(slug))
            throw new DomainException($"Slug '{slug}' is not URL-safe. Use only lowercase letters, digits, and hyphens.");

        return new Post(
            Guid.NewGuid(),
            title,
            slug,
            bodyMarkdown,
            PostStatus.Draft,
            authorId,
            categoryId,
            publishedAt: null,
            tags: tags.ToList().AsReadOnly());
    }

    public void Publish()
    {
        if (Status != PostStatus.Draft)
            throw new DomainException($"Only Draft posts can be published. Current status: {Status}.");

        Status = PostStatus.Published;
        PublishedAt = DateTime.UtcNow;
    }

    public void Archive()
    {
        if (Status == PostStatus.Archived)
            throw new DomainException("Post is already archived.");

        Status = PostStatus.Archived;
    }
}
