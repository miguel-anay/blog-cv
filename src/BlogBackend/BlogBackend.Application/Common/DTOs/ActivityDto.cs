namespace BlogBackend.Application.Common.DTOs;

public record ActivityDto(
    string Type,
    string Description,
    DateTime OccurredAt);
