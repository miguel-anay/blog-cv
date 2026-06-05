namespace BlogBackend.Domain.Common.Exceptions;

public class UnauthorizedException : DomainException
{
    public UnauthorizedException(string message) : base(message)
    {
    }
}
