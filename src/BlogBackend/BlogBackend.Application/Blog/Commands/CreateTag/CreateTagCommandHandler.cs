using BlogBackend.Domain.Blog.Entities;
using BlogBackend.Domain.Blog.Ports;
using Mediator;

namespace BlogBackend.Application.Blog.Commands.CreateTag;

public class CreateTagCommandHandler : IRequestHandler<CreateTagCommand, Guid>
{
    private readonly ITagRepository _tagRepository;

    public CreateTagCommandHandler(ITagRepository tagRepository)
    {
        _tagRepository = tagRepository;
    }

    public async ValueTask<Guid> Handle(CreateTagCommand request, CancellationToken cancellationToken)
    {
        var tag = new Tag(Guid.NewGuid(), request.Name);
        await _tagRepository.AddAsync(tag, cancellationToken);
        return tag.Id;
    }
}
