using BlogBackend.Application.Blog.Commands.CreatePost;
using BlogBackend.Domain.Blog.Entities;
using BlogBackend.Domain.Blog.Ports;
using BlogBackend.Domain.Common.Exceptions;
using FluentAssertions;
using FluentValidation;
using NSubstitute;

namespace BlogBackend.Application.Tests.Blog;

public class CreatePostCommandHandlerTests
{
    private readonly IPostRepository _postRepository;
    private readonly CreatePostCommandHandler _handler;
    private readonly CreatePostCommandValidator _validator;

    public CreatePostCommandHandlerTests()
    {
        _postRepository = Substitute.For<IPostRepository>();
        _handler = new CreatePostCommandHandler(_postRepository);
        _validator = new CreatePostCommandValidator();
    }

    [Fact]
    public async Task Handle_WhenTitleIsEmpty_ThrowsValidationException()
    {
        // Arrange
        var command = new CreatePostCommand(
            Title: string.Empty,
            Slug: "valid-slug",
            BodyMarkdown: "Some content",
            AuthorId: Guid.NewGuid(),
            CategoryId: null,
            Tags: new List<string>());

        // Act
        var result = await _validator.ValidateAsync(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(CreatePostCommand.Title));
    }

    [Fact]
    public async Task Handle_WhenSlugIsInvalid_ThrowsValidationException()
    {
        // Arrange
        var command = new CreatePostCommand(
            Title: "Valid Title",
            Slug: "Invalid Slug With Spaces!",
            BodyMarkdown: "Some content",
            AuthorId: Guid.NewGuid(),
            CategoryId: null,
            Tags: new List<string>());

        // Act
        var result = await _validator.ValidateAsync(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(CreatePostCommand.Slug));
    }

    [Fact]
    public async Task Handle_WithValidCommand_CreatesPostAndReturnsId()
    {
        // Arrange
        var command = new CreatePostCommand(
            Title: "A Valid Post Title",
            Slug: "a-valid-post-title",
            BodyMarkdown: "Some markdown content",
            AuthorId: Guid.NewGuid(),
            CategoryId: null,
            Tags: new List<string> { "dotnet" });

        _postRepository.AddAsync(Arg.Any<Post>(), Arg.Any<CancellationToken>())
            .Returns(Task.CompletedTask);

        // Act
        var id = await _handler.Handle(command, CancellationToken.None);

        // Assert
        id.Should().NotBeEmpty();
        await _postRepository.Received(1).AddAsync(Arg.Any<Post>(), Arg.Any<CancellationToken>());
    }
}
