using BlogBackend.Application.Blog.Commands.PublishPost;
using BlogBackend.Domain.Blog.Entities;
using BlogBackend.Domain.Blog.Ports;
using BlogBackend.Domain.Common.Exceptions;
using FluentAssertions;
using NSubstitute;

namespace BlogBackend.Application.Tests.Blog;

public class PublishPostCommandHandlerTests
{
    private readonly IPostRepository _postRepository;
    private readonly PublishPostCommandHandler _handler;

    public PublishPostCommandHandlerTests()
    {
        _postRepository = Substitute.For<IPostRepository>();
        _handler = new PublishPostCommandHandler(_postRepository);
    }

    [Fact]
    public async Task Handle_WhenPostNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var postId = Guid.NewGuid();
        _postRepository.GetByIdAsync(postId, Arg.Any<CancellationToken>())
            .Returns((Post?)null);

        var command = new PublishPostCommand(postId);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_WhenPostExists_SetsStatusToPublished()
    {
        // Arrange
        var post = Post.Create(
            "A Draft Post",
            "a-draft-post",
            "content",
            Guid.NewGuid(),
            null,
            Array.Empty<string>());

        _postRepository.GetByIdAsync(post.Id, Arg.Any<CancellationToken>())
            .Returns(post);

        var command = new PublishPostCommand(post.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        post.Status.Should().Be(PostStatus.Published);
        post.PublishedAt.Should().NotBeNull();
        await _postRepository.Received(1).UpdateAsync(post, Arg.Any<CancellationToken>());
    }
}
