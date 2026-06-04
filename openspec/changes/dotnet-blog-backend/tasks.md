# Tasks: dotnet-blog-backend

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines per slice | S1: ~200 / S2: ~700 / S3: ~1,200 / S4: ~800 / S5: ~600 / S6: ~500 / S7: 0 |
| Total estimated changed lines | ~4,000 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending (decision needed before apply) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Solution scaffold + docker infra | PR 1 | Base: feat/7-dotnet-blog-backend; dotnet build green |
| 2 | Domain layer + domain unit tests | PR 2 | Base: PR 1 branch; dotnet test Domain.Tests green |
| 3 | Application layer + app unit tests | PR 3 | Base: PR 2 branch; dotnet test Application.Tests green |
| 4 | Infrastructure + API layers | PR 4 | Base: PR 3 branch; dotnet build green |
| 5 | Integration tests + QA gate | PR 5 | Base: PR 4 branch; all tests green, OpenAPI exported |

---

## Slice 1 — Solution Scaffold (PR 1)

Spec refs: §1 (Solution Structure), §7 (docker-compose, PostgreSQL), HARD-001, HARD-003, HARD-008, HARD-009

- [x] 1.1 Create root directory `src/BlogBackend/` and run `dotnet new sln -n BlogBackend` to produce `BlogBackend.sln`
- [x] 1.2 `dotnet new classlib -n BlogBackend.Domain -o src/BlogBackend/BlogBackend.Domain` — no NuGet refs, no project refs
- [x] 1.3 `dotnet new classlib -n BlogBackend.Application -o src/BlogBackend/BlogBackend.Application` — add `<ProjectReference>` to Domain only
- [x] 1.4 `dotnet new classlib -n BlogBackend.Infrastructure -o src/BlogBackend/BlogBackend.Infrastructure` — add refs to Domain + Application
- [x] 1.5 `dotnet new webapi -n BlogBackend.Api -o src/BlogBackend/BlogBackend.Api` — add refs to Application + Infrastructure; delete default `WeatherForecast` scaffolding
- [x] 1.6 `dotnet new xunit -n BlogBackend.Domain.Tests -o tests/BlogBackend.Domain.Tests` — add ref to Domain
- [x] 1.7 `dotnet new xunit -n BlogBackend.Application.Tests -o tests/BlogBackend.Application.Tests` — add refs to Application + Domain
- [x] 1.8 `dotnet new xunit -n BlogBackend.Integration.Tests -o tests/BlogBackend.Integration.Tests` — add ref to Api
- [x] 1.9 Add all 7 projects to `BlogBackend.sln` via `dotnet sln add`
- [x] 1.10 Add NuGet packages per layer: Domain (none); Application (`Mediator.Abstractions`, `FluentValidation`); Infrastructure (`Npgsql.EntityFrameworkCore.PostgreSQL`, `BCrypt.Net-Next`, `System.IdentityModel.Tokens.Jwt`, `Microsoft.AspNetCore.Authentication.JwtBearer`); Api (`Swashbuckle.AspNetCore`, `Mediator.SourceGenerator`); Domain.Tests (`xUnit`, `FluentAssertions`); Application.Tests (`xUnit`, `NSubstitute`, `FluentAssertions`); Integration.Tests (`xUnit`, `Testcontainers.PostgreSql`, `Microsoft.AspNetCore.Mvc.Testing`)
- [x] 1.11 Create `docker-compose.yml` at solution root: services `db` (postgres:15-alpine, named volume `pgdata`, healthcheck `pg_isready`), `api` (build from `Dockerfile`, depends_on db healthy, port 5000), `mailhog` (dev SMTP sink)
- [x] 1.12 Create `Dockerfile` for `BlogBackend.Api` (multi-stage: sdk build + runtime aspnet)
- [x] 1.13 Create `.env.example` with all required env var keys: `ConnectionStrings__DefaultConnection`, `JWT__SigningKey`, `JWT__Issuer`, `JWT__Audience`, `SMTP__Host` — no values (HARD-008)
- [x] 1.14 Add `.env` and `*.env` to `.gitignore`; added .NET-specific patterns
- [x] 1.15 Quality gate: run `dotnet build BlogBackend.sln` — exit code 0, 0 errors, 0 warnings (HARD-001)

## Slice 2 — Domain Layer (PR 2)

Spec refs: §2 (Bounded Contexts), §6 (Domain Unit Tests), HARD-003

### Blog Bounded Context
- [ ] 2.1 Create `src/BlogBackend/BlogBackend.Domain/Blog/Entities/Post.cs` — props: `Id`, `Title`, `Slug`, `BodyMarkdown`, `Status` (enum Draft/Published/Archived), `AuthorId`, `CategoryId`, `PublishedAt`, `Tags`; invariants: title non-empty, slug URL-safe regex
- [ ] 2.2 Create `src/BlogBackend/BlogBackend.Domain/Blog/Entities/Category.cs` — props: `Id`, `Name`, `Slug`; invariant: name non-empty
- [ ] 2.3 Create `src/BlogBackend/BlogBackend.Domain/Blog/Entities/Tag.cs` — props: `Id`, `Name`; invariant: name non-empty
- [ ] 2.4 Create `src/BlogBackend/BlogBackend.Domain/Blog/Entities/Author.cs` — props: `Id`, `DisplayName`, `Email`; invariant: email valid format (regex VO)
- [ ] 2.5 Create `src/BlogBackend/BlogBackend.Domain/Blog/Entities/Comment.cs` — props: `Id`, `PostId`, `AuthorEmail` (nullable), `Body`, `Status` (enum Pending/Approved/Rejected); invariant: body non-empty (closes design open question)
- [ ] 2.6 Create `src/BlogBackend/BlogBackend.Domain/Blog/Events/PostPublished.cs` and `PostArchived.cs` — implement `INotification` (Mediator.Abstractions)
- [ ] 2.7 Create `src/BlogBackend/BlogBackend.Domain/Blog/Ports/IPostRepository.cs`, `ICategoryRepository.cs`, `ITagRepository.cs`, `IAuthorRepository.cs`, `ICommentRepository.cs`
- [ ] 2.8 Create `src/BlogBackend/BlogBackend.Domain/Common/Exceptions/DomainException.cs`, `ConflictException.cs`, `NotFoundException.cs`, `UnauthorizedException.cs`

### Subscription Bounded Context
- [ ] 2.9 Create `src/BlogBackend/BlogBackend.Domain/Subscription/Entities/Subscriber.cs` — props: `Id`, `Email`, `Status` (Active/Unsubscribed), `Plan`, `SubscribedAt`; invariants: email unique/valid, status transitions
- [ ] 2.10 Create `src/BlogBackend/BlogBackend.Domain/Subscription/ValueObjects/Plan.cs` — VO with `Free`/`Pro`
- [ ] 2.11 Create `src/BlogBackend/BlogBackend.Domain/Subscription/Events/SubscriberConfirmed.cs`, `SubscriberUnsubscribed.cs`
- [ ] 2.12 Create `src/BlogBackend/BlogBackend.Domain/Subscription/Ports/ISubscriberRepository.cs`, `IEmailNotificationPort.cs`

### Identity Bounded Context
- [ ] 2.13 Create `src/BlogBackend/BlogBackend.Domain/Identity/Entities/User.cs` — props: `Id`, `Email`, `PasswordHash`, `Role` (Admin/Editor/Viewer enum), `RefreshTokenHash`, `RefreshTokenExpiry`; `SetRefreshToken(hash, expiry)` method; invariant: hash stored, never plaintext
- [ ] 2.14 Create `src/BlogBackend/BlogBackend.Domain/Identity/Events/UserLoggedIn.cs`, `RefreshTokenRevoked.cs`
- [ ] 2.15 Create `src/BlogBackend/BlogBackend.Domain/Identity/Ports/IUserRepository.cs`, `ITokenService.cs`

### Domain Unit Tests (TDD — RED then GREEN in same PR)
- [ ] 2.16 Create `tests/BlogBackend.Domain.Tests/Blog/PostTests.cs` — 3 test methods: `Create_WhenTitleIsEmpty_ThrowsDomainException`, `Publish_WhenDraft_SetsStatusAndRaisesEvent`, `Create_WhenSlugContainsSpaces_ThrowsDomainException`
- [ ] 2.17 Create `tests/BlogBackend.Domain.Tests/Subscription/SubscriberTests.cs` — 1 test method: `Create_WhenEmailIsInvalid_ThrowsDomainException`
- [ ] 2.18 Create `tests/BlogBackend.Domain.Tests/Identity/UserTests.cs` — 1 test method: `SetRefreshToken_StoresHash_NotPlaintext`
- [ ] 2.19 Quality gate: run `dotnet test BlogBackend.Domain.Tests` — all 5 tests must pass

## Slice 3 — Application Layer (PR 3)

Spec refs: §2 scenarios, §6 (Application Handler Unit Tests), HARD-009

### Pipeline + Infrastructure
- [ ] 3.1 Create `src/BlogBackend/BlogBackend.Application/Common/Behaviors/LoggingBehavior.cs` — `IPipelineBehavior<TRequest,TResponse>` logging before/after
- [ ] 3.2 Create `src/BlogBackend/BlogBackend.Application/Common/Behaviors/ValidationBehavior.cs` — runs all `IValidator<TRequest>`, throws `ValidationException` on failure
- [ ] 3.3 Create `src/BlogBackend/BlogBackend.Application/Common/DTOs/ApiResponse.cs` — `record ApiResponse<T>(bool Success, T? Data, ErrorDetail? Error)`

### Blog Commands/Queries
- [ ] 3.4 Create `BlogBackend.Application/Blog/Commands/CreatePostCommand.cs` + `CreatePostCommandHandler.cs` — validates title/slug, calls `IPostRepository.ExistsBySlug`, persists, returns `Guid`
- [ ] 3.5 Create `BlogBackend.Application/Blog/Commands/UpdatePostCommand.cs` + handler
- [ ] 3.6 Create `BlogBackend.Application/Blog/Commands/PublishPostCommand.cs` + `PublishPostCommandHandler.cs` — fetches post, calls `post.Publish()`, dispatches `PostPublished`
- [ ] 3.7 Create `BlogBackend.Application/Blog/Commands/ArchivePostCommand.cs` + handler
- [ ] 3.8 Create `BlogBackend.Application/Blog/Commands/CreateCategoryCommand.cs` + handler
- [ ] 3.9 Create `BlogBackend.Application/Blog/Commands/CreateTagCommand.cs` + handler
- [ ] 3.10 Create `BlogBackend.Application/Blog/Queries/GetPostsQuery.cs` + handler (paginated, published only for unauthenticated)
- [ ] 3.11 Create `BlogBackend.Application/Blog/Queries/GetPostBySlugQuery.cs` + handler

### Comment Commands/Queries
- [ ] 3.12 Create `BlogBackend.Application/Blog/Commands/SubmitCommentCommand.cs` + handler — status Pending on creation
- [ ] 3.13 Create `BlogBackend.Application/Blog/Commands/ApproveCommentCommand.cs` + `ApproveCommentCommandHandler.cs`
- [ ] 3.14 Create `BlogBackend.Application/Blog/Commands/RejectCommentCommand.cs` + handler
- [ ] 3.15 Create `BlogBackend.Application/Blog/Commands/DeleteCommentCommand.cs` + handler
- [ ] 3.16 Create `BlogBackend.Application/Blog/Queries/GetPendingCommentsQuery.cs` + handler

### Subscription Commands/Queries
- [ ] 3.17 Create `BlogBackend.Application/Subscription/Commands/SubscribeCommand.cs` + `SubscribeCommandHandler.cs` — enqueues welcome email via `IBackgroundTaskQueue` post-save
- [ ] 3.18 Create `BlogBackend.Application/Subscription/Commands/UnsubscribeCommand.cs` + handler
- [ ] 3.19 Create `BlogBackend.Application/Subscription/Queries/GetSubscribersQuery.cs` + handler (paginated)
- [ ] 3.20 Create `BlogBackend.Application/Subscription/Queries/ExportSubscribersQuery.cs` + `ExportSubscribersQueryHandler.cs` — returns `byte[]` CSV

### Identity Commands
- [ ] 3.21 Create `BlogBackend.Application/Identity/Commands/LoginCommand.cs` + `LoginCommandHandler.cs` — calls `IUserRepository`, verifies bcrypt, calls `ITokenService.GenerateTokenPair`, stores refresh hash
- [ ] 3.22 Create `BlogBackend.Application/Identity/Commands/RefreshTokenCommand.cs` + `RefreshTokenCommandHandler.cs` — validates hash + expiry, rotates pair, invalidates old
- [ ] 3.23 Create `BlogBackend.Application/Identity/Commands/RevokeTokenCommand.cs` + handler

### Dashboard Queries
- [ ] 3.24 Create `BlogBackend.Application/Dashboard/Queries/GetDashboardStatsQuery.cs` + `GetDashboardStatsQueryHandler.cs` — aggregates counts from IPostRepository, ISubscriberRepository, ICommentRepository
- [ ] 3.25 Create `BlogBackend.Application/Dashboard/Queries/GetActivityQuery.cs` + handler

### Application Unit Tests (TDD — RED then GREEN in same PR)
- [ ] 3.26 Create `tests/BlogBackend.Application.Tests/Blog/CreatePostCommandHandlerTests.cs` — 3 methods: `Handle_WhenTitleIsEmpty_ThrowsValidationException`, `Handle_WhenSlugAlreadyExists_ThrowsConflictException`, `Handle_WithValidData_ReturnsPostId`
- [ ] 3.27 Create `tests/BlogBackend.Application.Tests/Blog/PublishPostCommandHandlerTests.cs` — 2 methods: `Handle_WhenPostNotFound_ThrowsNotFoundException`, `Handle_WhenDraft_PublishesAndDispatchesEvent`
- [ ] 3.28 Create `tests/BlogBackend.Application.Tests/Blog/ApproveCommentCommandHandlerTests.cs` — 2 methods: `Handle_WhenPending_SetsApproved`, `Handle_WhenAlreadyApproved_ThrowsDomainException`
- [ ] 3.29 Create `tests/BlogBackend.Application.Tests/Subscription/SubscribeCommandHandlerTests.cs` — 2 methods: `Handle_WithNewEmail_CreatesActiveSubscriber`, `Handle_WithDuplicateEmail_ThrowsConflictException`
- [ ] 3.30 Create `tests/BlogBackend.Application.Tests/Subscription/ExportSubscribersQueryHandlerTests.cs` — 1 method: `Handle_ReturnsValidCsvBytes`
- [ ] 3.31 Create `tests/BlogBackend.Application.Tests/Identity/LoginCommandHandlerTests.cs` — 2 methods: `Handle_WithValidCredentials_ReturnsTokenPair`, `Handle_WithInvalidPassword_ThrowsUnauthorizedException`
- [ ] 3.32 Create `tests/BlogBackend.Application.Tests/Identity/RefreshTokenCommandHandlerTests.cs` — 2 methods: `Handle_WithValidToken_RotatesTokenAndInvalidatesOld`, `Handle_WithExpiredToken_ThrowsUnauthorizedException`
- [ ] 3.33 Create `tests/BlogBackend.Application.Tests/Dashboard/GetDashboardStatsQueryHandlerTests.cs` — 1 method: `Handle_ReturnsAggregateCountsFromRepositories`
- [ ] 3.34 Quality gate: run `dotnet test BlogBackend.Application.Tests` — all 16 tests must pass

## Slice 4 — Infrastructure + API Layers (PR 4)

Spec refs: §3 (REST contracts), §4 (Auth), §5 (Async notifications), §7 (EF Core), HARD-004–HARD-008

### Infrastructure — EF Core
- [ ] 4.1 Create `src/BlogBackend/BlogBackend.Infrastructure/Persistence/BlogDbContext.cs` — single `DbContext`, `DbSet` for Post, Category, Tag, Author, Comment, Subscriber, User; `OnModelCreating` configures schemas: blog/subscription/identity
- [ ] 4.2 Create `BlogBackend.Infrastructure/Persistence/Configurations/Blog/` — `PostConfiguration.cs`, `CategoryConfiguration.cs`, `TagConfiguration.cs`, `AuthorConfiguration.cs`, `CommentConfiguration.cs` (IEntityTypeConfiguration per entity)
- [ ] 4.3 Create `BlogBackend.Infrastructure/Persistence/Configurations/Subscription/SubscriberConfiguration.cs`
- [ ] 4.4 Create `BlogBackend.Infrastructure/Persistence/Configurations/Identity/UserConfiguration.cs` — maps `RefreshTokenHash` column, no plaintext column
- [ ] 4.5 Create `BlogBackend.Infrastructure/Persistence/Interceptors/DomainEventDispatchInterceptor.cs` — `SaveChangesInterceptor` that collects domain events, saves, then calls `IPublisher` for each event
- [ ] 4.6 Run `dotnet ef migrations add InitialCreate` targeting `BlogDbContext` — produces `BlogBackend.Infrastructure/Migrations/` covering all 3 schemas

### Infrastructure — Repositories
- [ ] 4.7 Create `BlogBackend.Infrastructure/Persistence/Repositories/PostRepository.cs` implementing `IPostRepository`
- [ ] 4.8 Create `BlogBackend.Infrastructure/Persistence/Repositories/CategoryRepository.cs`, `TagRepository.cs`, `AuthorRepository.cs`, `CommentRepository.cs`
- [ ] 4.9 Create `BlogBackend.Infrastructure/Persistence/Repositories/SubscriberRepository.cs` implementing `ISubscriberRepository`
- [ ] 4.10 Create `BlogBackend.Infrastructure/Persistence/Repositories/UserRepository.cs` implementing `IUserRepository`

### Infrastructure — Auth + Email
- [ ] 4.11 Create `BlogBackend.Infrastructure/Auth/TokenService.cs` implementing `ITokenService` — HS256 JWT (sub/email/role/jti, 15 min); refresh = `RandomNumberGenerator` 32-byte base64url; BCrypt hash via `BCrypt.Net-Next` (HARD-005)
- [ ] 4.12 Create `BlogBackend.Infrastructure/Messaging/BackgroundTaskQueue.cs` — `Channel<Func<CancellationToken, ValueTask>>` with bounded capacity; implement `IBackgroundTaskQueue`
- [ ] 4.13 Create `BlogBackend.Infrastructure/Messaging/EmailWorkerService.cs` — `BackgroundService` consumer; dequeue + invoke; on failure: log Error, retry 3x exponential backoff, then drop; never throw to host
- [ ] 4.14 Create `BlogBackend.Infrastructure/Email/SmtpEmailNotificationAdapter.cs` implementing `IEmailNotificationPort` — SMTP for dev (MailHog), SendGrid path behind `EMAIL__PROVIDER` env var
- [ ] 4.15 Create `BlogBackend.Infrastructure/DependencyInjection.cs` — extension method `AddInfrastructure(IConfiguration)` registers DbContext (AddDbContextPool + Npgsql multiplexing), all repositories, TokenService, BackgroundTaskQueue, EmailWorkerService

### API Layer
- [ ] 4.16 Create `src/BlogBackend/BlogBackend.Api/Controllers/BlogController.cs` — all 10 blog endpoints; `[Authorize(Roles = ...)]` per role matrix; `[ProducesResponseType]` on all actions (HARD-004)
- [ ] 4.17 Create `BlogBackend.Api/Controllers/CommentController.cs` — all 5 comment endpoints with role decorators and `[ProducesResponseType]`
- [ ] 4.18 Create `BlogBackend.Api/Controllers/SubscriptionController.cs` — 4 endpoints including CSV export (`Content-Type: text/csv`)
- [ ] 4.19 Create `BlogBackend.Api/Controllers/AuthController.cs` — 3 auth endpoints; `[AllowAnonymous]` on login + refresh
- [ ] 4.20 Create `BlogBackend.Api/Controllers/AdminController.cs` — 2 dashboard endpoints (`[Authorize(Roles = "Admin")]`)
- [ ] 4.21 Create `BlogBackend.Api/Middleware/GlobalExceptionMiddleware.cs` — maps DomainException→422, ConflictException→409, NotFoundException→404, UnauthorizedException→401, fallback→500; all responses use `ApiResponse<T>` envelope (HARD-006)
- [ ] 4.22 Create `BlogBackend.Api/Filters/ApiResponseFilter.cs` — result filter wrapping all `ObjectResult` in `ApiResponse<T>` envelope (HARD-006)
- [ ] 4.23 Configure `Program.cs`: `AddInfrastructure`, `AddMediator`, `AddFluentValidation`, Swashbuckle with JWT bearer scheme, CORS policy (blog.miguel-anay.nom.pe + localhost:4321 in non-Dev — HARD-007), `AddHealthChecks().AddNpgSql(...)`, register `GlobalExceptionMiddleware`, map `/health` (HARD-004)
- [ ] 4.24 Configure Swashbuckle `SecurityDefinition` + `SecurityRequirement` for Bearer token in OpenAPI output (HARD-004)
- [ ] 4.25 Quality gate: run `dotnet build BlogBackend.sln` — exit code must be 0 (HARD-001)

## Slice 5 — Integration Tests (PR 5)

Spec refs: §6 (Integration Tests), HARD-002, HARD-010

- [ ] 5.1 Create `tests/BlogBackend.Integration.Tests/Fixtures/PostgresContainerFixture.cs` — `IAsyncLifetime` starting `PostgreSqlContainer` (Testcontainers), running EF Core migrations via `dbContext.Database.MigrateAsync()`, overriding connection string; shared via `[CollectionDefinition]`
- [ ] 5.2 Create `tests/BlogBackend.Integration.Tests/Fixtures/BlogBackendFactory.cs` — `WebApplicationFactory<Program>` overriding `ConnectionStrings__DefaultConnection` from container fixture
- [ ] 5.3 Create `tests/BlogBackend.Integration.Tests/Blog/PostsEndpointTests.cs` — 3 methods: `GetPosts_ReturnsPublishedPosts_WithEnvelope`, `CreatePost_AsViewer_Returns403`, `CreatePost_AsEditor_Returns201`
- [ ] 5.4 Create `tests/BlogBackend.Integration.Tests/Identity/AuthEndpointTests.cs` — 3 methods: `Login_WithValidCredentials_ReturnsTokenPair`, `Login_WithInvalidCredentials_Returns401`, `Refresh_WithValidToken_RotatesTokens`
- [ ] 5.5 Create `tests/BlogBackend.Integration.Tests/Subscription/SubscriptionsEndpointTests.cs` — 2 methods: `Subscribe_WithValidEmail_Returns201`, `Export_AsAdmin_ReturnsCsvContentType`
- [ ] 5.6 Create `tests/BlogBackend.Integration.Tests/HealthEndpointTests.cs` — 1 method: `Health_WhenDatabaseConnected_ReturnsHealthy`
- [ ] 5.7 Quality gate: run `dotnet test BlogBackend.Integration.Tests` — all 9 integration tests must pass (HARD-002, HARD-010)

## Slice 7 — Final QA Gate (no code, PR 5 continuation)

Spec refs: §1, §7, HARD-001, HARD-002, HARD-004

- [ ] 7.1 Run `dotnet build BlogBackend.sln` — confirm exit code 0, stderr has 0 error entries (HARD-001)
- [ ] 7.2 Run `dotnet test BlogBackend.sln` — confirm all test projects green (HARD-002)
- [ ] 7.3 Run `dotnet swagger` or `curl http://localhost:5000/swagger/v1/swagger.json` — export OpenAPI spec and commit to `openspec/dotnet-blog-backend-openapi.json`
- [ ] 7.4 Run `docker-compose up --build` — confirm `GET /health` returns HTTP 200 `{ "status": "Healthy" }` within 30 s
- [ ] 7.5 Verify no secrets in tracked files: `git grep -r "password\|secret\|apikey" -- src/ tests/` must return 0 matches (HARD-008)
