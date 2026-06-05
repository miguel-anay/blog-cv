namespace BlogBackend.Application.Common.DTOs;

public record ApiResponse<T>(bool Success, T? Data, ErrorDetail? Error);

public record ErrorDetail(string Code, string Message);
