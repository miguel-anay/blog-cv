namespace BlogBackend.Domain.Blog.Events;

public record PostArchived(Guid PostId, DateTime ArchivedAt);
