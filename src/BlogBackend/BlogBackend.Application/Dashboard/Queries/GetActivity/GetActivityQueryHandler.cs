using BlogBackend.Application.Common.DTOs;
using BlogBackend.Domain.Blog.Ports;
using BlogBackend.Domain.Subscription.Ports;
using Mediator;

namespace BlogBackend.Application.Dashboard.Queries.GetActivity;

public class GetActivityQueryHandler : IRequestHandler<GetActivityQuery, IReadOnlyList<ActivityDto>>
{
    private readonly IPostRepository _postRepository;
    private readonly ISubscriberRepository _subscriberRepository;

    public GetActivityQueryHandler(
        IPostRepository postRepository,
        ISubscriberRepository subscriberRepository)
    {
        _postRepository = postRepository;
        _subscriberRepository = subscriberRepository;
    }

    public async ValueTask<IReadOnlyList<ActivityDto>> Handle(GetActivityQuery request, CancellationToken cancellationToken)
    {
        var (posts, _) = await _postRepository.GetAllAsync(1, request.Count, cancellationToken);
        var (subscribers, _) = await _subscriberRepository.GetAllAsync(1, request.Count, cancellationToken);

        var activities = new List<ActivityDto>();

        foreach (var post in posts)
        {
            activities.Add(new ActivityDto(
                "Post",
                $"Post '{post.Title}' ({post.Status})",
                post.PublishedAt ?? DateTime.MinValue));
        }

        foreach (var sub in subscribers)
        {
            activities.Add(new ActivityDto(
                "Subscription",
                $"New subscriber: {sub.Email}",
                sub.SubscribedAt));
        }

        return activities
            .OrderByDescending(a => a.OccurredAt)
            .Take(request.Count)
            .ToList()
            .AsReadOnly();
    }
}
