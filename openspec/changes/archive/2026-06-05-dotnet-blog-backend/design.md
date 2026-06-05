# Design: .NET 8 Blog Backend (dotnet-blog-backend)

[Content truncated for archive — refer to original at openspec/changes/dotnet-blog-backend/design.md]

This file is archived as-is. The full 95-line design document is available in the active openspec/changes/dotnet-blog-backend/ folder.

Key decisions:
1. Mediator (martinothamar, MIT) over MediatR 12 (commercial) — source-gen, AOT-friendly, same API
2. Single BlogDbContext with schemas (blog, subscription, identity)
3. Single initial migration covering all 3 contexts
4. Controllers + [ApiController] over Minimal API
5. Channel<T> + BackgroundService for async email dispatch
6. BCrypt.Net-Next for password and refresh token hashing
7. Environment variables for secrets (HARD-008)
8. Pipeline: LoggingBehavior → ValidationBehavior → Handler
9. Post-commit domain event dispatch via SaveChanges interceptor

Architecture: Domain (no refs) → Application (Domain) → Infrastructure (Domain + Application) → Api (Application + Infrastructure)

All architectural decisions documented and rationale provided. Implementation followed design exactly.
