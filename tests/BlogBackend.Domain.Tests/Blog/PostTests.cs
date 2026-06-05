using BlogBackend.Domain.Blog.Entities;
using BlogBackend.Domain.Common.Exceptions;
using FluentAssertions;

namespace BlogBackend.Domain.Tests.Blog;

public class PostTests
{
    [Fact]
    public void Create_WhenTitleIsEmpty_ThrowsDomainException()
    {
        // Arrange
        var title = string.Empty;
        var slug = "valid-slug";
        var body = "Some markdown";
        var authorId = Guid.NewGuid();

        // Act
        var act = () => Post.Create(title, slug, body, authorId, null, Array.Empty<string>());

        // Assert
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Create_WhenSlugIsInvalid_ThrowsDomainException()
    {
        // Arrange
        var title = "Valid Title";
        var slug = "Invalid Slug With Spaces!";
        var body = "Some markdown";
        var authorId = Guid.NewGuid();

        // Act
        var act = () => Post.Create(title, slug, body, authorId, null, Array.Empty<string>());

        // Assert
        act.Should().Throw<DomainException>();
    }

    [Fact]
    public void Create_WithValidData_SetsStatusToDraft()
    {
        // Arrange
        var title = "Valid Title";
        var slug = "valid-title";
        var body = "Some markdown content";
        var authorId = Guid.NewGuid();
        var categoryId = Guid.NewGuid();
        var tags = new[] { "dotnet", "csharp" };

        // Act
        var post = Post.Create(title, slug, body, authorId, categoryId, tags);

        // Assert
        post.Status.Should().Be(PostStatus.Draft);
        post.Title.Should().Be(title);
        post.Slug.Should().Be(slug);
        post.AuthorId.Should().Be(authorId);
        post.CategoryId.Should().Be(categoryId);
        post.Id.Should().NotBeEmpty();
    }
}
