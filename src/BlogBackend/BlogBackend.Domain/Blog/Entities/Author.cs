using System.Text.RegularExpressions;
using BlogBackend.Domain.Common.Exceptions;

namespace BlogBackend.Domain.Blog.Entities;

public class Author
{
    private static readonly Regex EmailPattern = new(
        @"^[^@\s]+@[^@\s]+\.[^@\s]+$",
        RegexOptions.Compiled);

    public Guid Id { get; private set; }
    public string DisplayName { get; private set; }
    public string Email { get; private set; }

    public Author(Guid id, string displayName, string email)
    {
        if (!EmailPattern.IsMatch(email))
            throw new DomainException($"Email '{email}' is not a valid email address.");

        Id = id;
        DisplayName = displayName;
        Email = email;
    }
}
