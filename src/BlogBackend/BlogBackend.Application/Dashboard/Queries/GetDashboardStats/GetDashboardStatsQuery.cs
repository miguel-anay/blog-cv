using Mediator;

namespace BlogBackend.Application.Dashboard.Queries.GetDashboardStats;

public record GetDashboardStatsQuery : IRequest<DashboardStatsDto>;

public record DashboardStatsDto(
    int TotalPosts,
    int PublishedPosts,
    int TotalSubscribers,
    int ActiveSubscribers,
    int TotalComments,
    int PendingComments);
