using BlogBackend.Domain.Common.Exceptions;

namespace BlogBackend.Domain.Blog.Entities;

public class Tag
{
    public Guid Id { get; private set; }
    public string Name { get; private set; }

    public Tag(Guid id, string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new DomainException("Tag name must not be empty.");

        Id = id;
        Name = name;
    }
}
