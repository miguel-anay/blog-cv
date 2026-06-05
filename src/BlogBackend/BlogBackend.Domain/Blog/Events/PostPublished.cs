namespace BlogBackend.Domain.Blog.Events;

public record PostPublished(Guid PostId, DateTime PublishedAt);
