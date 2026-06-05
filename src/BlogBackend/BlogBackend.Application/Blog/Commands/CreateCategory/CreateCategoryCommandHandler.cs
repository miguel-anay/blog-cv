using BlogBackend.Domain.Blog.Entities;
using BlogBackend.Domain.Blog.Ports;
using Mediator;

namespace BlogBackend.Application.Blog.Commands.CreateCategory;

public class CreateCategoryCommandHandler : IRequestHandler<CreateCategoryCommand, Guid>
{
    private readonly ICategoryRepository _categoryRepository;

    public CreateCategoryCommandHandler(ICategoryRepository categoryRepository)
    {
        _categoryRepository = categoryRepository;
    }

    public async ValueTask<Guid> Handle(CreateCategoryCommand request, CancellationToken cancellationToken)
    {
        var category = new Category(Guid.NewGuid(), request.Name, request.Slug);
        await _categoryRepository.AddAsync(category, cancellationToken);
        return category.Id;
    }
}
