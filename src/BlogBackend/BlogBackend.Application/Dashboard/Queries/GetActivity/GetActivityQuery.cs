using BlogBackend.Application.Common.DTOs;
using Mediator;

namespace BlogBackend.Application.Dashboard.Queries.GetActivity;

public record GetActivityQuery(int Count = 10) : IRequest<IReadOnlyList<ActivityDto>>;
