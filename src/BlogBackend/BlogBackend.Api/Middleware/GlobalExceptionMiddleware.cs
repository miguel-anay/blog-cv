using System.Text.Json;
using BlogBackend.Application.Common.DTOs;
using BlogBackend.Domain.Common.Exceptions;
using FluentValidation;

namespace BlogBackend.Api.Middleware;

public class GlobalExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionMiddleware> _logger;

    public GlobalExceptionMiddleware(RequestDelegate next, ILogger<GlobalExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }

    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var (statusCode, code, message) = exception switch
        {
            NotFoundException notFound => (StatusCodes.Status404NotFound, "NOT_FOUND", notFound.Message),
            ConflictException conflict => (StatusCodes.Status409Conflict, "CONFLICT", conflict.Message),
            UnauthorizedException unauthorized => (StatusCodes.Status401Unauthorized, "UNAUTHORIZED", unauthorized.Message),
            ValidationException validation => (StatusCodes.Status422UnprocessableEntity, "VALIDATION_ERROR",
                string.Join("; ", validation.Errors.Select(e => e.ErrorMessage))),
            _ => (StatusCodes.Status500InternalServerError, "INTERNAL_ERROR", "An unexpected error occurred.")
        };

        if (statusCode == StatusCodes.Status500InternalServerError)
            _logger.LogError(exception, "Unhandled exception.");
        else
            _logger.LogWarning(exception, "Handled exception: {Code}", code);

        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";

        var response = new ApiResponse<object>(false, null, new ErrorDetail(code, message));
        var json = JsonSerializer.Serialize(response, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        await context.Response.WriteAsync(json);
    }
}
