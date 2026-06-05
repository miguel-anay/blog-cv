using BlogBackend.Application.Common.DTOs;
using BlogBackend.Application.Dashboard.Queries.GetActivity;
using BlogBackend.Application.Dashboard.Queries.GetDashboardStats;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlogBackend.Api.Controllers;

[ApiController]
[Route("api/v1/admin")]
[Authorize(Roles = "Admin")]
public class AdminController : ControllerBase
{
    private readonly IMediator _mediator;

    public AdminController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet("stats")]
    [ProducesResponseType(typeof(ApiResponse<DashboardStatsDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetStats(CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(new GetDashboardStatsQuery(), cancellationToken);
        return Ok(new ApiResponse<DashboardStatsDto>(true, result, null));
    }

    [HttpGet("activity")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<ActivityDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetActivity(
        [FromQuery] int count = 10,
        CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(new GetActivityQuery(count), cancellationToken);
        return Ok(new ApiResponse<IReadOnlyList<ActivityDto>>(true, result, null));
    }
}
