namespace BlogBackend.Domain.Identity.Events;

public record UserLoggedIn(Guid UserId, string Email);
