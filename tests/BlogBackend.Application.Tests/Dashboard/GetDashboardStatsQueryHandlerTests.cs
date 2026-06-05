using BlogBackend.Application.Dashboard.Queries.GetDashboardStats;
using BlogBackend.Domain.Blog.Entities;
using BlogBackend.Domain.Blog.Ports;
using BlogBackend.Domain.Subscription.Entities;
using BlogBackend.Domain.Subscription.Ports;
using BlogBackend.Domain.Subscription.ValueObjects;
using FluentAssertions;
using NSubstitute;

namespace BlogBackend.Application.Tests.Dashboard;

public class GetDashboardStatsQueryHandlerTests
{
    private readonly IPostRepository _postRepository;
    private readonly ISubscriberRepository _subscriberRepository;
    private readonly ICommentRepository _commentRepository;
    private readonly GetDashboardStatsQueryHandler _handler;

    public GetDashboardStatsQueryHandlerTests()
    {
        _postRepository = Substitute.For<IPostRepository>();
        _subscriberRepository = Substitute.For<ISubscriberRepository>();
        _commentRepository = Substitute.For<ICommentRepository>();
        _handler = new GetDashboardStatsQueryHandler(_postRepository, _subscriberRepository, _commentRepository);
    }

    [Fact]
    public async Task Handle_ReturnsAggregatedStats()
    {
        // Arrange
        var post1 = Post.Create("Post 1", "post-1", "body", Guid.NewGuid(), null, Array.Empty<string>());
        var post2 = Post.Create("Post 2", "post-2", "body", Guid.NewGuid(), null, Array.Empty<string>());
        post2.Publish();

        var posts = new List<Post> { post1, post2 };
        _postRepository.GetAllAsync(1, int.MaxValue, Arg.Any<CancellationToken>())
            .Returns(((IReadOnlyList<Post>)posts.AsReadOnly(), posts.Count));

        var subscriber = new Subscriber(Guid.NewGuid(), "sub@example.com", SubscriberStatus.Active, Plan.Free, DateTime.UtcNow);
        var subscribers = new List<Subscriber> { subscriber };
        _subscriberRepository.GetAllAsync(1, int.MaxValue, Arg.Any<CancellationToken>())
            .Returns(((IReadOnlyList<Subscriber>)subscribers.AsReadOnly(), subscribers.Count));

        var comment = new Comment(Guid.NewGuid(), post1.Id, "user@example.com", "Nice!");
        var pendingComments = new List<Comment> { comment };
        _commentRepository.GetPendingAsync(Arg.Any<CancellationToken>())
            .Returns((IReadOnlyList<Comment>)pendingComments.AsReadOnly());

        var allComments = new List<Comment> { comment };
        _commentRepository.GetByPostIdAsync(Arg.Any<Guid>(), Arg.Any<int>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(((IReadOnlyList<Comment>)allComments.AsReadOnly(), allComments.Count));

        var query = new GetDashboardStatsQuery();

        // Act
        var stats = await _handler.Handle(query, CancellationToken.None);

        // Assert
        stats.TotalPosts.Should().Be(2);
        stats.PublishedPosts.Should().Be(1);
        stats.TotalSubscribers.Should().Be(1);
        stats.ActiveSubscribers.Should().Be(1);
        stats.PendingComments.Should().Be(1);
    }
}
