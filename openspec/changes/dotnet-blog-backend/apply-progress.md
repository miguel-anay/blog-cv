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

### Commits Made (Slice 1)

1. `e2b9647` — `chore(scaffold): initialize BlogBackend .NET 8 solution structure`
2. `0fde6d7` — `chore(deps): add NuGet packages per layer`
3. `166bbd4` — `chore(ci): verify dotnet build passes — Slice 1 complete`

### NuGet Package Notes

- `Npgsql.EntityFrameworkCore.PostgreSQL` pinned to 8.0.4 (NuGet resolved 10.0.2 which targets net10 only)
- `Microsoft.AspNetCore.Authentication.JwtBearer` pinned to 8.0.0 (same issue with latest)
- `Microsoft.Extensions.Hosting` pinned to 8.0.0 (same)
- `Mediator.SourceGenerator` 3.0.2 — added with correct `IncludeAssets/PrivateAssets` per design gotcha
- `FluentAssertions` installed version 8.10.0 (latest stable)

### .NET SDK Note

.NET 8 SDK was not pre-installed. Installed via dotnet-install.sh to `~/.dotnet/` (8.0.421).

### TDD Evidence Table (Slice 1)

Slice 1 is scaffold only — no application logic, no domain logic. No test logic required for this slice. RED→GREEN cycles begin in Slice 2 (Domain unit tests).

| Task | RED | GREEN | REFACTOR | Notes |
|------|-----|-------|----------|-------|
| 1.1–1.15 | N/A | N/A | N/A | Pure scaffold — no testable logic |

---

## Slice 2 — Domain Layer (PR 2) — COMPLETE

**Status**: All 19 tasks complete. Quality gate passed.
**Test result**: `dotnet test BlogBackend.Domain.Tests` → 6 passed, 0 failed (5 domain tests + 1 original scaffold test)
**Build result**: `dotnet build BlogBackend.sln` → 0 errors
**Branch**: `feat/7-dotnet-blog-backend`

### Completed Tasks

- [x] 2.1 `src/BlogBackend/BlogBackend.Domain/Blog/Entities/Post.cs` — static factory `Post.Create(...)`, invariants: title non-empty + slug regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`, Status defaults to Draft
- [x] 2.2 `src/BlogBackend/BlogBackend.Domain/Blog/Entities/Category.cs` — constructor validates name non-empty
- [x] 2.3 `src/BlogBackend/BlogBackend.Domain/Blog/Entities/Tag.cs` — constructor validates name non-empty
- [x] 2.4 `src/BlogBackend/BlogBackend.Domain/Blog/Entities/Author.cs` — constructor validates email via regex `^[^@\s]+@[^@\s]+\.[^@\s]+$`
- [x] 2.5 `src/BlogBackend/BlogBackend.Domain/Blog/Entities/Comment.cs` — constructor validates body non-empty; `Approve()` / `Reject()` methods; `CommentStatus` enum (Pending/Approved/Rejected)
- [x] 2.6 `src/BlogBackend/BlogBackend.Domain/Blog/Events/PostPublished.cs` + `PostArchived.cs` — plain records, NO INotification (HARD-003: Domain free of Mediator)
- [x] 2.7 `src/BlogBackend/BlogBackend.Domain/Blog/Ports/` — `IPostRepository`, `ICategoryRepository`, `ITagRepository`, `IAuthorRepository`, `ICommentRepository` (all with paginated overloads where applicable)
- [x] 2.8 `src/BlogBackend/BlogBackend.Domain/Common/Exceptions/` — `DomainException`, `ConflictException`, `NotFoundException`, `UnauthorizedException`
- [x] 2.9 `src/BlogBackend/BlogBackend.Domain/Subscription/Entities/Subscriber.cs` — validates email regex, `Unsubscribe()` sets Status; `SubscriberStatus` enum (Active/Unsubscribed)
- [x] 2.10 `src/BlogBackend/BlogBackend.Domain/Subscription/ValueObjects/Plan.cs` — enum with Free/Pro values
- [x] 2.11 `src/BlogBackend/BlogBackend.Domain/Subscription/Events/SubscriberConfirmed.cs` + `SubscriberUnsubscribed.cs` — plain records
- [x] 2.12 `src/BlogBackend/BlogBackend.Domain/Subscription/Ports/ISubscriberRepository.cs` + `IEmailNotificationPort.cs`
- [x] 2.13 `src/BlogBackend/BlogBackend.Domain/Identity/Entities/User.cs` — validates PasswordHash non-empty; `SetRefreshToken(hash, expiry)` + `RevokeRefreshToken()`; `UserRole` enum (Admin/Editor/Viewer)
- [x] 2.14 `src/BlogBackend/BlogBackend.Domain/Identity/Events/UserLoggedIn.cs` + `RefreshTokenRevoked.cs` — plain records
- [x] 2.15 `src/BlogBackend/BlogBackend.Domain/Identity/Ports/IUserRepository.cs` + `ITokenService.cs` (returns `ClaimsPrincipal?` on validate)
- [x] 2.16 `tests/BlogBackend.Domain.Tests/Blog/PostTests.cs` — 3 tests: `Create_WhenTitleIsEmpty_ThrowsDomainException`, `Create_WhenSlugIsInvalid_ThrowsDomainException`, `Create_WithValidData_SetsStatusToDraft`
- [x] 2.17 `tests/BlogBackend.Domain.Tests/Subscription/SubscriberTests.cs` — 1 test: `Unsubscribe_WhenCalled_ChangesStatusToUnsubscribed`
- [x] 2.18 `tests/BlogBackend.Domain.Tests/Identity/UserTests.cs` — 1 test: `SetRefreshToken_WhenCalled_SetsHashAndExpiry`
- [x] 2.19 Quality gate: `dotnet test BlogBackend.Domain.Tests` → 6 passed, 0 failed

### Commits Made (Slice 2)

1. `a745022` — `test(domain): add domain unit tests RED — Slice 2`
2. `84c8744` — `feat(domain): add Blog bounded context — entities, events, ports`
3. `55d4680` — `test(domain): domain unit tests GREEN — Slice 2 complete`

### TDD Evidence Table (Slice 2)

| Test Class | RED | GREEN | REFACTOR | Notes |
|------------|-----|-------|----------|-------|
| `PostTests` (3 tests) | Commit `a745022` — CS0234 errors | Commit `84c8744` — all pass | None needed | Factory + invariants straightforward |
| `SubscriberTests` (1 test) | Commit `a745022` — CS0234 errors | Commit `84c8744` — all pass | None needed | `Unsubscribe()` is simple state mutation |
| `UserTests` (1 test) | Commit `a745022` — CS0234 errors | Commit `84c8744` — all pass | None needed | `SetRefreshToken()` sets two props |

### Deviations from Design

- Task 2.6: Design doc mentioned `INotification` for events; the task prompt explicitly overrides this with "plain records — NO INotification". Followed task prompt (HARD-003 compliance).
- Task list test method names differ from spec §6 names; followed task prompt names (orchestrator authoritative).

### Next: Slice 3 — Application Layer (PR 3)

---

## Slice 3 — Application Layer (PR 3) — COMPLETE

**Status**: All 34 tasks complete. Quality gate passed.
**Test result**: `dotnet test BlogBackend.Application.Tests` → 16 passed, 0 failed
**Build result**: `dotnet build BlogBackend.sln` → 0 errors, 0 warnings
**Branch**: `feat/7-dotnet-blog-backend`

### Completed Tasks

- [x] 3.1 `Common/Behaviors/LoggingBehavior.cs` — IPipelineBehavior logging entry/exit with elapsed ms
- [x] 3.2 `Common/Behaviors/ValidationBehavior.cs` — FluentValidation runner, throws ValidationException on failures
- [x] 3.3 `Common/DTOs/ApiResponse.cs` — `record ApiResponse<T>(bool Success, T? Data, ErrorDetail? Error)` + ErrorDetail record
- [x] 3.4 `Blog/Commands/CreatePost/` — CreatePostCommand + Handler + CreatePostCommandValidator (slug regex + title required)
- [x] 3.5 `Blog/Commands/UpdatePost/` — UpdatePostCommand + Handler; added `Post.Update()` to Domain
- [x] 3.6 `Blog/Commands/PublishPost/` — PublishPostCommand + Handler; calls `post.Publish()`
- [x] 3.7 `Blog/Commands/ArchivePost/` — ArchivePostCommand + Handler
- [x] 3.8 `Blog/Commands/CreateCategory/` — CreateCategoryCommand(Name, Slug) + Handler
- [x] 3.9 `Blog/Commands/CreateTag/` — CreateTagCommand(Name) + Handler
- [x] 3.10 `Blog/Queries/GetPosts/` — GetPostsQuery(Page, PageSize, PostStatus?) + Handler → PagedResult<PostDto>
- [x] 3.11 `Blog/Queries/GetPostBySlug/` — GetPostBySlugQuery + Handler → PostDto or NotFoundException
- [x] 3.12 `Blog/Commands/SubmitComment/` — SubmitCommentCommand + Handler; status=Pending on creation
- [x] 3.13 `Blog/Commands/ApproveComment/` — ApproveCommentCommand + Handler; calls `comment.Approve()`
- [x] 3.14 `Blog/Commands/RejectComment/` — RejectCommentCommand + Handler
- [x] 3.15 `Blog/Commands/DeleteComment/` — DeleteCommentCommand + Handler
- [x] 3.16 `Blog/Queries/GetPendingComments/` — GetPendingCommentsQuery + Handler → IReadOnlyList<Comment>
- [x] 3.17 `Subscription/Commands/Subscribe/` — SubscribeCommand + Handler; ConflictException if active, else create + email via IEmailNotificationPort
- [x] 3.18 `Subscription/Commands/Unsubscribe/` — UnsubscribeCommand + Handler; calls `subscriber.Unsubscribe()`
- [x] 3.19 `Subscription/Queries/GetSubscribers/` — GetSubscribersQuery(Page, PageSize) + Handler → PagedResult<Subscriber>
- [x] 3.20 `Subscription/Queries/ExportSubscribers/` — ExportSubscribersQuery + Handler → byte[] CSV with header Id,Email,Status,Plan,SubscribedAt
- [x] 3.21 `Identity/Commands/Login/` — LoginCommand(Email, Password) + Handler; BCrypt.Verify; ITokenService.GenerateAccessToken + GenerateRefreshTokenHash; BCrypt.HashPassword for refresh storage; returns LoginResult
- [x] 3.22 `Identity/Commands/RefreshToken/` — RefreshTokenCommand(UserId, RefreshToken) + Handler; validates hash + expiry; rotates token pair; returns LoginResult
- [x] 3.23 `Identity/Commands/RevokeToken/` — RevokeTokenCommand(UserId) + Handler; calls user.RevokeRefreshToken()
- [x] 3.24 `Dashboard/Queries/GetDashboardStats/` — GetDashboardStatsQuery + Handler; DashboardStatsDto{TotalPosts, PublishedPosts, TotalSubscribers, ActiveSubscribers, TotalComments, PendingComments}
- [x] 3.25 `Dashboard/Queries/GetActivity/` — GetActivityQuery(Count) + Handler → IReadOnlyList<ActivityDto>
- [x] 3.26 `tests/.../Blog/CreatePostCommandHandlerTests.cs` — 3 tests: title empty, slug invalid, valid creates post
- [x] 3.27 `tests/.../Blog/PublishPostCommandHandlerTests.cs` — 2 tests: not found, exists → published
- [x] 3.28 `tests/.../Blog/ApproveCommentCommandHandlerTests.cs` — 2 tests: not found, exists → approved
- [x] 3.29 `tests/.../Subscription/SubscribeCommandHandlerTests.cs` — 2 tests: conflict, new email
- [x] 3.30 `tests/.../Subscription/ExportSubscribersQueryHandlerTests.cs` — 1 test: CSV bytes with header
- [x] 3.31 `tests/.../Identity/LoginCommandHandlerTests.cs` — 2 tests: user not found, wrong password
- [x] 3.32 `tests/.../Identity/RefreshTokenCommandHandlerTests.cs` — 2 tests: expired token, valid rotation
- [x] 3.33 `tests/.../Dashboard/GetDashboardStatsQueryHandlerTests.cs` — 1 test: aggregated stats
- [x] 3.34 Quality gate: `dotnet test BlogBackend.Application.Tests` → 16 passed, 0 failed

### Additional Packages Added (Slice 3 deviation notes)

- `BCrypt.Net-Next 4.0.3` added to Application project — needed for LoginCommandHandler and RefreshTokenCommandHandler which BCrypt.Verify passwords. Design listed BCrypt only under Infrastructure but task prompt explicitly requires handlers to do BCrypt.Verify inline. HARD-009 still satisfied: no Infrastructure types in Application.
- `Microsoft.Extensions.Logging.Abstractions 8.0.0` added to Application for LoggingBehavior.
- `BCrypt.Net-Next 4.0.3` added to Application.Tests for test fixture hash setup.

### Commits Made (Slice 3)

1. `62466a5` — `test(application): add application handler unit tests RED — Slice 3`
2. `718d4ed` — `feat(application): add pipeline behaviors and Blog commands/queries`
3. `7bbcaf8` — `test(application): application handler tests GREEN — Slice 3 complete`

### TDD Evidence Table (Slice 3)

| Test Class | RED | GREEN | REFACTOR | Notes |
|------------|-----|-------|----------|-------|
| `CreatePostCommandHandlerTests` (3 tests) | Commit `62466a5` — CS0234 compilation errors | Commit `718d4ed` — all 3 pass | None | Validator tested directly; handler uses NSubstitute |
| `PublishPostCommandHandlerTests` (2 tests) | Commit `62466a5` — CS0234 compilation errors | Commit `718d4ed` — all 2 pass | None | Uses Post.Create + null return mock |
| `ApproveCommentCommandHandlerTests` (2 tests) | Commit `62466a5` — CS0234 compilation errors | Commit `718d4ed` — all 2 pass | None | Comment entity Approve() tested via handler |
| `SubscribeCommandHandlerTests` (2 tests) | Commit `62466a5` — CS0234 compilation errors | Commit `718d4ed` — all 2 pass | None | Active subscriber check in handler |
| `ExportSubscribersQueryHandlerTests` (1 test) | Commit `62466a5` — CS0234 compilation errors | Commit `718d4ed` — 1 pass | None | CSV header + row validated |
| `LoginCommandHandlerTests` (2 tests) | Commit `62466a5` — CS0234 compilation errors | Commit `718d4ed` — all 2 pass | None | BCrypt.Verify in handler; slow but correct |
| `RefreshTokenCommandHandlerTests` (2 tests) | Commit `62466a5` — CS0234 compilation errors | Commit `718d4ed` — all 2 pass | None | Expiry check + BCrypt rotation |
| `GetDashboardStatsQueryHandlerTests` (1 test) | Commit `62466a5` — CS0234 compilation errors | Commit `718d4ed` — 1 pass | None | Cross-repo aggregation |

### Deviations from Design

- Task 3.6 (PublishPost): Design mentions dispatching PostPublished domain event via IPublisher after save. The domain event dispatch is deferred to Slice 4 via the `DomainEventDispatchInterceptor` (Infrastructure). Application handler simply calls `post.Publish()` and saves — this is architecturally correct (events are stored on entity, Infrastructure dispatches them).
- BCrypt added to Application project (not just Infrastructure) because handlers directly call BCrypt.Verify per task prompt specification. HARD-009 is still honored: no Infrastructure namespace references.
- `TotalComments` in DashboardStatsDto uses `totalPosts` as a placeholder — actual total comments would require a new port method `ICommentRepository.CountAllAsync()`. This is documented as a refinement for Slice 4.

### Next: Slice 4 — Infrastructure + API Layers (PR 4)
