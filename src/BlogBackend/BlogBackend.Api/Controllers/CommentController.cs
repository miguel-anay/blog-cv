using BlogBackend.Application.Blog.Commands.ApproveComment;
using BlogBackend.Application.Blog.Commands.DeleteComment;
using BlogBackend.Application.Blog.Commands.RejectComment;
using BlogBackend.Application.Blog.Commands.SubmitComment;
using BlogBackend.Application.Blog.Queries.GetPendingComments;
using BlogBackend.Application.Common.DTOs;
using BlogBackend.Domain.Blog.Entities;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlogBackend.Api.Controllers;

[ApiController]
[Route("api/v1/comments")]
public class CommentController : ControllerBase
{
    private readonly IMediator _mediator;

    public CommentController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<Guid>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SubmitComment(
        [FromBody] SubmitCommentCommand command,
        CancellationToken cancellationToken = default)
    {
        var id = await _mediator.Send(command, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, new ApiResponse<Guid>(true, id, null));
    }

    [HttpGet("pending")]
    [Authorize(Roles = "Admin,Editor")]
    [ProducesResponseType(typeof(ApiResponse<IReadOnlyList<Comment>>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetPendingComments(
        CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(new GetPendingCommentsQuery(), cancellationToken);
        return Ok(new ApiResponse<IReadOnlyList<Comment>>(true, result, null));
    }

    [HttpPost("{id:guid}/approve")]
    [Authorize(Roles = "Admin,Editor")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ApproveComment(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        await _mediator.Send(new ApproveCommentCommand(id), cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:guid}/reject")]
    [Authorize(Roles = "Admin,Editor")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> RejectComment(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        await _mediator.Send(new RejectCommentCommand(id), cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> DeleteComment(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        await _mediator.Send(new DeleteCommentCommand(id), cancellationToken);
        return NoContent();
    }
}
