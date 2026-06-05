using BlogBackend.Domain.Common.Exceptions;
using BlogBackend.Domain.Identity.Ports;
using Mediator;

namespace BlogBackend.Application.Identity.Commands.RevokeToken;

public class RevokeTokenCommandHandler : IRequestHandler<RevokeTokenCommand, Unit>
{
    private readonly IUserRepository _userRepository;

    public RevokeTokenCommandHandler(IUserRepository userRepository)
    {
        _userRepository = userRepository;
    }

    public async ValueTask<Unit> Handle(RevokeTokenCommand request, CancellationToken cancellationToken)
    {
        var user = await _userRepository.GetByIdAsync(request.UserId, cancellationToken)
            ?? throw new NotFoundException("User", request.UserId);

        user.RevokeRefreshToken();
        await _userRepository.UpdateAsync(user, cancellationToken);
        return Unit.Value;
    }
}
