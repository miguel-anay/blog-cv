using BlogBackend.Domain.Common.Exceptions;

namespace BlogBackend.Domain.Blog.Entities;

public class Category
{
    public Guid Id { get; private set; }
    public string Name { get; private set; }
    public string Slug { get; private set; }

    public Category(Guid id, string name, string slug)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new DomainException("Category name must not be empty.");

        Id = id;
        Name = name;
        Slug = slug;
    }
}
