# Apply Progress: dotnet-blog-backend

## Slice 1 — Solution Scaffold (PR 1) — COMPLETE

**Status**: All 15 tasks complete. Quality gate passed.
**Build result**: `dotnet build BlogBackend.sln` → exit code 0, 0 errors, 0 warnings
**Branch**: `feat/7-dotnet-blog-backend`

### Completed Tasks

- [x] 1.1 Created `src/BlogBackend/` and `BlogBackend.sln`
- [x] 1.2 `BlogBackend.Domain` classlib — no refs
- [x] 1.3 `BlogBackend.Application` classlib — ref to Domain
- [x] 1.4 `BlogBackend.Infrastructure` classlib — refs to Domain + Application
- [x] 1.5 `BlogBackend.Api` webapi — refs to Application + Infrastructure; WeatherForecast removed; Program.cs uses controllers
- [x] 1.6 `BlogBackend.Domain.Tests` xunit — ref to Domain
- [x] 1.7 `BlogBackend.Application.Tests` xunit — refs to Application + Domain
- [x] 1.8 `BlogBackend.Integration.Tests` xunit — ref to Api
- [x] 1.9 All 7 projects added to `BlogBackend.sln`
- [x] 1.10 NuGet packages per layer (see note below)
- [x] 1.11 `docker-compose.yml` — db (postgres:15-alpine), api, mailhog
- [x] 1.12 `Dockerfile` multi-stage sdk:8.0 build + aspnet:8.0 runtime
- [x] 1.13 `.env.example` with all required keys, no values
- [x] 1.14 `.gitignore` updated: `.env`, `*.env`, .NET bin/obj patterns
- [x] 1.15 Quality gate: `dotnet build BlogBackend.sln` → 0 errors

### Commits Made

1. `e2b9647` — `chore(scaffold): initialize BlogBackend .NET 8 solution structure`
2. `0fde6d7` — `chore(deps): add NuGet packages per layer`

### NuGet Package Notes

- `Npgsql.EntityFrameworkCore.PostgreSQL` pinned to 8.0.4 (NuGet resolved 10.0.2 which targets net10 only)
- `Microsoft.AspNetCore.Authentication.JwtBearer` pinned to 8.0.0 (same issue with latest)
- `Microsoft.Extensions.Hosting` pinned to 8.0.0 (same)
- `Mediator.SourceGenerator` 3.0.2 — added with correct `IncludeAssets/PrivateAssets` per design gotcha
- `FluentAssertions` installed version 8.10.0 (latest stable)

### .NET SDK Note

.NET 8 SDK was not pre-installed. Installed via dotnet-install.sh to `~/.dotnet/` (8.0.421).

### TDD Evidence Table (Strict TDD)

Slice 1 is scaffold only — no application logic, no domain logic. No test logic required for this slice. RED→GREEN cycles begin in Slice 2 (Domain unit tests).

| Task | RED | GREEN | REFACTOR | Notes |
|------|-----|-------|----------|-------|
| 1.1–1.15 | N/A | N/A | N/A | Pure scaffold — no testable logic |

### Next: Slice 2 — Domain Layer (PR 2)
