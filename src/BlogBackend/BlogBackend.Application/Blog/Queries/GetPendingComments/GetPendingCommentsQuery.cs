using BlogBackend.Domain.Blog.Entities;
using Mediator;

namespace BlogBackend.Application.Blog.Queries.GetPendingComments;

public record GetPendingCommentsQuery : IRequest<IReadOnlyList<Comment>>;
