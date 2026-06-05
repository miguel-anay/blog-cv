using BlogBackend.Application.Blog.Commands.ArchivePost;
using BlogBackend.Application.Blog.Commands.CreatePost;
using BlogBackend.Application.Blog.Commands.PublishPost;
using BlogBackend.Application.Blog.Commands.UpdatePost;
using BlogBackend.Application.Blog.DTOs;
using BlogBackend.Application.Blog.Queries.GetPostBySlug;
using BlogBackend.Application.Blog.Queries.GetPosts;
using BlogBackend.Application.Common.DTOs;
using BlogBackend.Domain.Blog.Entities;
using Mediator;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BlogBackend.Api.Controllers;

[ApiController]
[Route("api/v1/posts")]
public class BlogController : ControllerBase
{
    private readonly IMediator _mediator;

    public BlogController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpGet]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<PostDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPosts(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] PostStatus? status = null,
        CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(new GetPostsQuery(page, pageSize, status), cancellationToken);
        return Ok(new ApiResponse<PagedResult<PostDto>>(true, result, null));
    }

    [HttpGet("{slug}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ApiResponse<PostDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPostBySlug(
        string slug,
        CancellationToken cancellationToken = default)
    {
        var result = await _mediator.Send(new GetPostBySlugQuery(slug), cancellationToken);
        return Ok(new ApiResponse<PostDto>(true, result, null));
    }

    [HttpPost]
    [Authorize(Roles = "Admin,Editor")]
    [ProducesResponseType(typeof(ApiResponse<Guid>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> CreatePost(
        [FromBody] CreatePostCommand command,
        CancellationToken cancellationToken = default)
    {
        var id = await _mediator.Send(command, cancellationToken);
        return CreatedAtAction(nameof(GetPostBySlug), new { slug = command.Slug },
            new ApiResponse<Guid>(true, id, null));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Admin,Editor")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> UpdatePost(
        Guid id,
        [FromBody] UpdatePostCommand command,
        CancellationToken cancellationToken = default)
    {
        var cmd = command with { Id = id };
        await _mediator.Send(cmd, cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:guid}/publish")]
    [Authorize(Roles = "Admin,Editor")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> PublishPost(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        await _mediator.Send(new PublishPostCommand(id), cancellationToken);
        return NoContent();
    }

    [HttpPost("{id:guid}/archive")]
    [Authorize(Roles = "Admin,Editor")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ArchivePost(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        await _mediator.Send(new ArchivePostCommand(id), cancellationToken);
        return NoContent();
    }
}
