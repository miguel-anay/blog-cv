using BlogBackend.Domain.Common.Exceptions;

namespace BlogBackend.Domain.Blog.Entities;

public class Comment
{
    public Guid Id { get; private set; }
    public Guid PostId { get; private set; }
    public string? AuthorEmail { get; private set; }
    public string Body { get; private set; }
    public CommentStatus Status { get; private set; }

    public Comment(Guid id, Guid postId, string? authorEmail, string body)
    {
        if (string.IsNullOrWhiteSpace(body))
            throw new DomainException("Comment body must not be empty.");

        Id = id;
        PostId = postId;
        AuthorEmail = authorEmail;
        Body = body;
        Status = CommentStatus.Pending;
    }

    public void Approve()
    {
        if (Status == CommentStatus.Rejected)
            throw new DomainException("A rejected comment cannot be approved.");

        Status = CommentStatus.Approved;
    }

    public void Reject()
    {
        if (Status == CommentStatus.Approved)
            throw new DomainException("An approved comment cannot be rejected.");

        Status = CommentStatus.Rejected;
    }
}
