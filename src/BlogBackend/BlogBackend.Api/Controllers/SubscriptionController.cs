using BlogBackend.Application.Common.DTOs;
using BlogBackend.Application.Subscription.Commands.Subscribe;
using BlogBackend.Application.Subscription.Commands.Unsubscribe;
using BlogBackend.Application.Subscription.Queries.ExportSubscribers;
using BlogBackend.Application.Subscription.Queries.GetSubscribers;
using BlogBackend.Domain.Subscription.Entities;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlogBackend.Api.Controllers;

[ApiController]
[Route("api/v1/subscriptions")]
public class SubscriptionController : ControllerBase
{
    private readonly IMediator _mediator;

    public SubscriptionController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost("subscribe")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Subscribe(
        [FromBody] SubscribeCommand command,
        CancellationToken cancellationToken = default)
    {
        await _mediator.Send(command, cancellationToken);
        return NoContent();
    }

    [HttpPost("unsubscribe")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Unsubscribe(
        [FromBody] UnsubscribeCommand command,
        CancellationToken cancellationToken = default)
    {
        await _mediator.Send(command, cancellationToken);
        return NoContent();
    }

    [HttpGet]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<Subscriber>>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetSubscribers(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(new GetSubscribersQuery(page, pageSize), cancellationToken);
        return Ok(new ApiResponse<PagedResult<Subscriber>>(true, result, null));
    }

    [HttpGet("export/csv")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ExportCsv(CancellationToken cancellationToken = default)
    {
        var csv = await _mediator.Send(new ExportSubscribersQuery(), cancellationToken);
        return File(csv, "text/csv", "subscribers.csv");
    }
}
