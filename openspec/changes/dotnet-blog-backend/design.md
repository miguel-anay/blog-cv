# Design: .NET 8 Blog Backend (dotnet-blog-backend)

## Technical Approach

Greenfield .NET 8 service, Full Hexagonal + CQRS. Four source projects (`Domain`, `Application`, `Infrastructure`, `Api`) under `src/BlogBackend/`, three test projects under `tests/`. Domain holds entities/VOs/ports/events; Application holds command-query handlers + validators; Infrastructure implements ports (EF Core, JWT, email); Api hosts controllers + middleware. Reference graph enforces HARD-003/HARD-009: dependencies only point inward, and only Api references Infrastructure (composition root).

## Architecture Decisions

| # | Decision | Choice | Rejected | Rationale |
|---|----------|--------|----------|-----------|
| 1 | Mediator lib | `Mediator` (martinothamar, MIT, source-gen) | MediatR 12 (commercial >$5M rev), custom dispatcher | MIT removes licensing risk; source-generated = faster, AOT-friendly. Same `IRequestHandler`/`INotificationHandler` API as MediatR — handlers port cleanly. |
| 2 | DbContext layout | Single `BlogDbContext`, schemas (`blog`,`subscription`,`identity`) | DbContext-per-context | Spec mandates one PostgreSQL DB + single initial migration; cross-context dashboard query needs one transaction scope. Schemas give logical isolation. |
| 3 | Migrations | Single assembly in `Infrastructure/Migrations` | Per-context | Spec requires one initial migration covering all 3 contexts. |
| 4 | Connection pooling | `AddDbContextPool<BlogDbContext>` + Npgsql multiplexing | plain `AddDbContext` | Pooled contexts reduce alloc under concurrency. |
| 5 | API style | Controllers + `[ApiController]` | Minimal API | Proposal locks Controllers; `[ProducesResponseType]` annotations satisfy HARD-004 cleanly. |
| 6 | Versioning | URL prefix `/api/v1` via `[Route("api/v1/[controller]")]` | header/media-type | Spec routes are URL-versioned; simplest for Swagger + clients. |
| 7 | Domain events | `Mediator` `INotificationHandler`, dispatched **post-commit** | pre-commit dispatch, full outbox | Collect events on entities; `SaveChangesAsync` interceptor publishes AFTER commit so handlers see persisted state. Outbox deferred (no exactly-once requirement yet). |
| 8 | Async email | `Channel<T>`-backed `IBackgroundTaskQueue` + single `BackgroundService` consumer | ConcurrentQueue+SemaphoreSlim, Hangfire | `System.Threading.Channels` is the idiomatic bounded async queue; no external infra. |
| 9 | Password/token hash | `BCrypt.Net-Next` for password AND refresh-token hash | ASP.NET Identity, PBKDF2 | Single hashing dep; satisfies HARD-005. |
| 10 | Secrets | env vars (prod) + `dotnet user-secrets` (dev) | appsettings literals | HARD-008. |

## Token Service Design

- **Access JWT**: HS256, signing key from `JWT__SigningKey` env var. Claims `sub`, `email`, `role`, `jti`. 15-min expiry.
- **Refresh**: 32-byte `RandomNumberGenerator` → base64url (opaque). Only `BCrypt` hash stored in `Users.RefreshTokenHash` + `RefreshTokenExpiry` (7d). Verify via `BCrypt.Verify`.
- **Rotation**: single-use + absolute expiry. On `/auth/refresh`, validate hash, overwrite with new hash (old invalidated immediately), issue new pair. Expired → 401.

## Pipeline Behaviors (order)

`LoggingBehavior` → `ValidationBehavior` (FluentValidation, throws `ValidationException`) → handler. Registered as `IPipelineBehavior<,>`. Domain/app exceptions (`ConflictException`, `NotFoundException`, `UnauthorizedException`, `DomainException`) bubble to global middleware.

## Data Flow

    Controller ─► IMediator.Send(Command) ─► [Logging ─► Validation] ─► Handler
        │                                                                 │
        │                                              Repository (port) ─┘
        │                                                     │
        ▼                                          SaveChanges interceptor
    Envelope◄── result                                        │ (post-commit)
                                                  INotificationHandler(PostPublished)
                                                              │
                                                  IBackgroundTaskQueue.Enqueue
                                                              ▼
                                                  EmailWorker (BackgroundService) ─► IEmailNotificationPort

Email worker: dequeue → send → on failure log `Error` + retry up to 3x (exponential backoff); exhausted = drop + log, never propagate (spec §5).

## Project / Package Layout

| Project | References | Key NuGet |
|---------|-----------|-----------|
| `BlogBackend.Domain` | — | (none) |
| `BlogBackend.Application` | Domain | `Mediator.Abstractions`, `FluentValidation` |
| `BlogBackend.Infrastructure` | Domain, Application | `Npgsql.EntityFrameworkCore.PostgreSQL`, `BCrypt.Net-Next`, `System.IdentityModel.Tokens.Jwt` |
| `BlogBackend.Api` | Application, Infrastructure | `Swashbuckle.AspNetCore`, `Microsoft.AspNetCore.Authentication.JwtBearer`, `Mediator.SourceGenerator` |
| `*.Domain.Tests` | Domain | xUnit, FluentAssertions |
| `*.Application.Tests` | Application | xUnit, NSubstitute |
| `*.Integration.Tests` | Api | xUnit, `Testcontainers.PostgreSql`, `Microsoft.AspNetCore.Mvc.Testing` |

Handler folders per context: `Application/{Blog,Subscription,Identity,Dashboard}/Commands|Queries`.

## Api Layer

- **Envelope** (HARD-006): `ApiResponse<T>` + `IActionResult` extension / result filter wrapping every action; controllers return `data` only.
- **Global exception middleware**: maps exception → HTTP + envelope error code (`Conflict→409`, `NotFound→404`, `Validation→422`, `Unauthorized→401`, fallback→500).
- **CORS** (HARD-007): named policy; non-Dev origins locked to `https://blog.miguel-anay.nom.pe`, `http://localhost:4321`.
- **Health**: `AddHealthChecks().AddNpgSql(...)` at `/health`.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Domain | Entity invariants/events | Pure xUnit, no mocks |
| Application | Handler logic | NSubstitute mocks for ports |
| Integration | Endpoints, auth, envelope, CSV | `WebApplicationFactory` + `Testcontainers.PostgreSql` (HARD-010); migrate on container start via `IAsyncLifetime` shared fixture |

WebApplicationFactory overrides the DbContext connection string to the Testcontainer; no SQLite fallback.

## docker-compose

| Service | Image | Notes |
|---------|-------|-------|
| `api` | built Dockerfile | `depends_on: db (healthy)`, port 5000, env from `.env` |
| `db` | `postgres:15-alpine` | named volume `pgdata`, healthcheck `pg_isready` |
| `mailhog` *(optional dev)* | `mailhog/mailhog` | SMTP sink for email testing |

## Migration / Rollout

No data migration — additive greenfield service running parallel to existing Hono API.

## Open Questions

- [ ] Comment entity (Blog context) not in spec §2 entity table though endpoints exist — assume `Comment{Id,PostId,AuthorEmail?,Body,Status}` in Blog context; confirm in tasks.
- [ ] Confirm `Mediator` (martinothamar) over MediatR with stakeholder if a paid MediatR license is already owned.
