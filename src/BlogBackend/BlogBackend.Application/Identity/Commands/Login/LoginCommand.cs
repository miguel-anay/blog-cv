using BlogBackend.Application.Common.DTOs;
using Mediator;

namespace BlogBackend.Application.Identity.Commands.Login;

public record LoginCommand(string Email, string Password) : IRequest<LoginResult>;
