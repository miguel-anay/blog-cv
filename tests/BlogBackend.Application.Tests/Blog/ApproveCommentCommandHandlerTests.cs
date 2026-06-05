using BlogBackend.Application.Blog.Commands.ApproveComment;
using BlogBackend.Domain.Blog.Entities;
using BlogBackend.Domain.Blog.Ports;
using BlogBackend.Domain.Common.Exceptions;
using FluentAssertions;
using NSubstitute;

namespace BlogBackend.Application.Tests.Blog;

public class ApproveCommentCommandHandlerTests
{
    private readonly ICommentRepository _commentRepository;
    private readonly ApproveCommentCommandHandler _handler;

    public ApproveCommentCommandHandlerTests()
    {
        _commentRepository = Substitute.For<ICommentRepository>();
        _handler = new ApproveCommentCommandHandler(_commentRepository);
    }

    [Fact]
    public async Task Handle_WhenCommentNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var commentId = Guid.NewGuid();
        _commentRepository.GetByIdAsync(commentId, Arg.Any<CancellationToken>())
            .Returns((Comment?)null);

        var command = new ApproveCommentCommand(commentId);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotFoundException>();
    }

    [Fact]
    public async Task Handle_WhenCommentExists_ApprovesComment()
    {
        // Arrange
        var comment = new Comment(Guid.NewGuid(), Guid.NewGuid(), "test@example.com", "Great post!");

        _commentRepository.GetByIdAsync(comment.Id, Arg.Any<CancellationToken>())
            .Returns(comment);

        var command = new ApproveCommentCommand(comment.Id);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        comment.Status.Should().Be(CommentStatus.Approved);
        await _commentRepository.Received(1).UpdateAsync(comment, Arg.Any<CancellationToken>());
    }
}
