# Spec: dotnet-blog-backend

## Purpose

Delta specification for the .NET 8 Blog Backend — a greenfield hexagonal service covering five new capabilities: blog-content, comment-moderation, subscription-management, identity-auth, and admin-dashboard. All requirements describe WHAT must be true; implementation HOW is deferred to the design phase.

---

## 1. Solution Structure

### Requirement: .NET 8 Solution Layout

The solution MUST be organized as a flat set of projects under `src/BlogBackend/`:

| Project | Layer | Responsibility |
|---|---|---|
| `BlogBackend.Domain` | Domain | Entities, VOs, ports, domain events |
| `BlogBackend.Application` | Application | MediatR handlers, FluentValidation, DTOs |
| `BlogBackend.Infrastructure` | Infrastructure | EF Core, PostgreSQL, email, JWT impl |
| `BlogBackend.Api` | Presentation | Controllers, OpenAPI, middleware |
| `BlogBackend.Domain.Tests` | Test | Unit tests for domain invariants |
| `BlogBackend.Application.Tests` | Test | Unit tests for command/query handlers |
| `BlogBackend.Integration.Tests` | Test | Integration/TestContainers tests |

The root solution file MUST be `BlogBackend.sln`.

Namespace root: `BlogBackend.{Layer}.{BoundedContext}` (e.g. `BlogBackend.Domain.Blog`).

#### Scenario: Build passes with zero errors

- GIVEN a fresh clone of the repository
- WHEN `dotnet build BlogBackend.sln` is executed
- THEN the exit code MUST be 0 and stderr MUST contain no error entries

#### Scenario: Domain project has no forbidden references

- GIVEN the `BlogBackend.Domain.csproj`
- WHEN its `<ProjectReference>` items are inspected
- THEN it MUST NOT reference `BlogBackend.Infrastructure` or `BlogBackend.Api`

---

## 2. Bounded Contexts & Domain Model

### Requirement: Blog Bounded Context

The Blog context MUST expose the following entities and invariants:

| Entity | Key Properties | Invariants |
|---|---|---|
| `Post` | Id, Title, Slug, BodyMarkdown, Status(Draft/Published/Archived), AuthorId, CategoryId, PublishedAt, Tags | Title MUST NOT be empty; Slug MUST be unique and URL-safe; BodyMarkdown stores raw markdown string |
| `Category` | Id, Name, Slug | Name MUST NOT be empty |
| `Tag` | Id, Name | Name MUST NOT be empty |
| `Author` | Id, DisplayName, Email | Email MUST be valid format |

Domain events: `PostPublished`, `PostArchived`.

Ports (interfaces defined in Domain): `IPostRepository`, `ICategoryRepository`, `ITagRepository`, `IAuthorRepository`.

#### Scenario: Post created with valid data

- GIVEN a valid Title, Slug, BodyMarkdown, AuthorId, and CategoryId
- WHEN `CreatePostCommand` is handled
- THEN a `Post` in Draft status MUST be persisted and its Id returned

#### Scenario: Post published triggers domain event

- GIVEN a Post in Draft status
- WHEN `PublishPostCommand` is handled
- THEN Post status MUST become Published, PublishedAt MUST be set, and a `PostPublished` event MUST be dispatched

#### Scenario: Duplicate slug rejected

- GIVEN a Post with Slug "my-post" already exists
- WHEN a second `CreatePostCommand` with the same Slug is handled
- THEN a `ConflictException` MUST be thrown and no record persisted

### Requirement: Subscription Bounded Context

| Entity | Key Properties | Invariants |
|---|---|---|
| `Subscriber` | Id, Email, Status(Active/Unsubscribed), Plan(Free/Pro), SubscribedAt | Email MUST be unique and valid |
| `Plan` | Id, Name, Description | (value object; billing deferred) |

Domain event: `SubscriberConfirmed`, `SubscriberUnsubscribed`.

Ports: `ISubscriberRepository`, `IEmailNotificationPort`.

#### Scenario: Subscribe with valid email

- GIVEN an email address not previously registered
- WHEN `SubscribeCommand` is handled
- THEN a Subscriber in Active/Free status MUST be created and a `SubscriberConfirmed` event dispatched

#### Scenario: Duplicate email rejected

- GIVEN an email that already has an Active subscriber record
- WHEN `SubscribeCommand` is handled with the same email
- THEN a `ConflictException` MUST be thrown

#### Scenario: Unsubscribe sets status

- GIVEN an Active subscriber
- WHEN `UnsubscribeCommand` is handled with a valid subscriber Id
- THEN Subscriber status MUST become Unsubscribed and a `SubscriberUnsubscribed` event dispatched

### Requirement: Identity Bounded Context

| Entity | Key Properties | Invariants |
|---|---|---|
| `User` | Id, Email, PasswordHash, Role(Admin/Editor/Viewer), RefreshTokenHash, RefreshTokenExpiry | Email MUST be unique; PasswordHash MUST use bcrypt; RefreshTokenHash MUST NOT store plaintext |

Domain events: `UserLoggedIn`, `RefreshTokenRevoked`.

Ports: `IUserRepository`, `ITokenService`.

#### Scenario: User entity stores hashed refresh token

- GIVEN a refresh token string
- WHEN stored on the `User` entity
- THEN only the bcrypt hash MUST be persisted; plaintext MUST NOT appear in the database

---

## 3. REST API Contracts

All responses MUST use the standard envelope:

```json
{ "success": true, "data": {}, "error": null }
```

Error responses: `{ "success": false, "data": null, "error": { "code": "...", "message": "..." } }`.

All endpoints MUST be documented with OpenAPI/Swashbuckle annotations.

### Requirement: Blog Content Endpoints

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| GET | /api/v1/posts | Optional | Any | List published posts (paginated) |
| GET | /api/v1/posts/{slug} | Optional | Any | Get single post by slug |
| POST | /api/v1/posts | Required | Admin, Editor | Create post (Draft) |
| PUT | /api/v1/posts/{id} | Required | Admin, Editor | Update post |
| POST | /api/v1/posts/{id}/publish | Required | Admin, Editor | Publish post |
| DELETE | /api/v1/posts/{id} | Required | Admin | Archive post |
| GET | /api/v1/categories | None | Any | List categories |
| POST | /api/v1/categories | Required | Admin | Create category |
| GET | /api/v1/tags | None | Any | List tags |
| POST | /api/v1/tags | Required | Admin | Create tag |

#### Scenario: Unauthenticated user reads published posts

- GIVEN no Authorization header
- WHEN GET /api/v1/posts is called
- THEN HTTP 200 with envelope `success: true` and array of published posts MUST be returned

#### Scenario: Viewer cannot create a post

- GIVEN a valid JWT with Role = Viewer
- WHEN POST /api/v1/posts is called
- THEN HTTP 403 MUST be returned

### Requirement: Comment Moderation Endpoints

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| POST | /api/v1/posts/{postId}/comments | None | Public | Submit comment (pending) |
| GET | /api/v1/comments?status=pending | Required | Admin, Editor | List pending comments |
| POST | /api/v1/comments/{id}/approve | Required | Admin, Editor | Approve comment |
| POST | /api/v1/comments/{id}/reject | Required | Admin, Editor | Reject comment |
| DELETE | /api/v1/comments/{id} | Required | Admin | Delete comment |

#### Scenario: Public comment submission

- GIVEN a valid postId and non-empty content
- WHEN POST /api/v1/posts/{postId}/comments is called without auth
- THEN HTTP 201 with `success: true` MUST be returned and comment stored with Status = Pending

#### Scenario: Editor approves a comment

- GIVEN a JWT with Role = Editor and a Pending comment
- WHEN POST /api/v1/comments/{id}/approve is called
- THEN HTTP 200 MUST be returned and comment Status MUST become Approved

### Requirement: Subscription Management Endpoints

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| POST | /api/v1/subscriptions | None | Public | Subscribe |
| DELETE | /api/v1/subscriptions/{id} | Required | Admin, Self | Unsubscribe |
| GET | /api/v1/subscriptions | Required | Admin | List subscribers (paginated) |
| GET | /api/v1/subscriptions/export | Required | Admin | CSV export |

#### Scenario: CSV export returns correct content type

- GIVEN a JWT with Role = Admin
- WHEN GET /api/v1/subscriptions/export is called
- THEN HTTP 200 with `Content-Type: text/csv` and subscriber rows MUST be returned

### Requirement: Identity / Auth Endpoints

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | /api/v1/auth/login | None | Issue access + refresh token |
| POST | /api/v1/auth/refresh | None (refresh token in body) | Rotate refresh token |
| POST | /api/v1/auth/revoke | Required | Revoke refresh token |

#### Scenario: Login with valid credentials

- GIVEN a registered User with correct password
- WHEN POST /api/v1/auth/login is called
- THEN HTTP 200 MUST return `access_token` (JWT, 15-min expiry) and `refresh_token` (opaque, 7-day expiry)

#### Scenario: Login with invalid credentials

- GIVEN an incorrect password
- WHEN POST /api/v1/auth/login is called
- THEN HTTP 401 MUST be returned; no tokens issued

#### Scenario: Refresh token rotation

- GIVEN a valid refresh token
- WHEN POST /api/v1/auth/refresh is called
- THEN a new access token and new refresh token MUST be issued; the old refresh token MUST be invalidated immediately

### Requirement: Admin Dashboard Endpoints

| Method | Route | Auth | Role | Description |
|---|---|---|---|---|
| GET | /api/v1/dashboard/stats | Required | Admin | Aggregate counts |
| GET | /api/v1/dashboard/activity | Required | Admin | Recent activity log |
| GET | /health | None | Any | Health check |

#### Scenario: Dashboard stats returns counts

- GIVEN a JWT with Role = Admin
- WHEN GET /api/v1/dashboard/stats is called
- THEN HTTP 200 MUST return `{ totalPosts, publishedPosts, totalSubscribers, activeSubscribers, pendingComments }`

#### Scenario: Health endpoint returns Healthy

- GIVEN the API and PostgreSQL are running
- WHEN GET /health is called
- THEN HTTP 200 with body `{ "status": "Healthy" }` MUST be returned

---

## 4. Authentication & Authorization

### Requirement: JWT Access Token

The access token MUST:
- Use HS256 or RS256 algorithm
- Carry claims: `sub` (userId), `email`, `role`, `jti`
- Expire in 15 minutes
- Be validated on every protected endpoint via `[Authorize]`

### Requirement: Refresh Token Policy

- Refresh tokens MUST be stored as bcrypt hashes in `Users.RefreshTokenHash`
- Plaintext refresh token MUST NEVER be persisted (HARD-005)
- Rotation: on each refresh call, old token is invalidated and a new pair issued
- Expiry: 7 days; expired tokens MUST be rejected with HTTP 401

### Requirement: Role Authorization Matrix

| Endpoint Group | Admin | Editor | Viewer |
|---|---|---|---|
| Read published posts/categories/tags | Yes | Yes | Yes |
| Create/Update posts, categories, tags | Yes | Yes | No |
| Publish/Archive posts | Yes | Yes | No |
| Approve/Reject comments | Yes | Yes | No |
| Delete comments/posts | Yes | No | No |
| Subscriber list + CSV export | Yes | No | No |
| Dashboard stats + activity | Yes | No | No |

#### Scenario: Admin accesses all endpoints

- GIVEN a valid JWT with Role = Admin
- WHEN any protected endpoint is called
- THEN HTTP 200 (or appropriate 2xx) MUST be returned

#### Scenario: Viewer blocked on write operations

- GIVEN a valid JWT with Role = Viewer
- WHEN any write or admin-only endpoint is called
- THEN HTTP 403 MUST be returned

---

## 5. Async Notification Flow

### Requirement: Non-Blocking Email Dispatch

The system MUST dispatch email notifications asynchronously via `IBackgroundTaskQueue`:

| Trigger Event | Notification |
|---|---|
| `SubscriberConfirmed` | Welcome email to subscriber |
| `PostPublished` | New post notification to active subscribers |
| `CommentApproved` | Confirmation email to comment author (if email provided) |

The HTTP request MUST return before the email is sent. Email failures MUST be logged but MUST NOT propagate an error response to the caller.

#### Scenario: Subscribe request returns immediately

- GIVEN a valid subscribe request
- WHEN POST /api/v1/subscriptions is called
- THEN HTTP 201 MUST be returned before the welcome email is sent

#### Scenario: Email failure does not fail the request

- GIVEN the SMTP/email provider is unavailable
- WHEN a `SubscriberConfirmed` event triggers email dispatch
- THEN the email failure MUST be logged at Error level and the subscriber record MUST remain Active

---

## 6. Test Scenarios (TDD — Mandatory)

All test projects MUST be under `tests/` at solution root.

### Requirement: Domain Unit Tests

| Test Class | Test Method | Layer | File Path |
|---|---|---|---|
| `PostTests` | `Create_WhenTitleIsEmpty_ThrowsDomainException` | Unit | `tests/BlogBackend.Domain.Tests/Blog/PostTests.cs` |
| `PostTests` | `Publish_WhenDraft_SetsStatusAndRaisesEvent` | Unit | `tests/BlogBackend.Domain.Tests/Blog/PostTests.cs` |
| `PostTests` | `Create_WhenSlugContainsSpaces_ThrowsDomainException` | Unit | `tests/BlogBackend.Domain.Tests/Blog/PostTests.cs` |
| `SubscriberTests` | `Create_WhenEmailIsInvalid_ThrowsDomainException` | Unit | `tests/BlogBackend.Domain.Tests/Subscription/SubscriberTests.cs` |
| `UserTests` | `SetRefreshToken_StoresHash_NotPlaintext` | Unit | `tests/BlogBackend.Domain.Tests/Identity/UserTests.cs` |

### Requirement: Application Handler Unit Tests

| Test Class | Test Method | Layer | File Path |
|---|---|---|---|
| `CreatePostCommandHandlerTests` | `Handle_WhenTitleIsEmpty_ThrowsValidationException` | Unit | `tests/BlogBackend.Application.Tests/Blog/CreatePostCommandHandlerTests.cs` |
| `CreatePostCommandHandlerTests` | `Handle_WhenSlugAlreadyExists_ThrowsConflictException` | Unit | `tests/BlogBackend.Application.Tests/Blog/CreatePostCommandHandlerTests.cs` |
| `CreatePostCommandHandlerTests` | `Handle_WithValidData_ReturnsPostId` | Unit | `tests/BlogBackend.Application.Tests/Blog/CreatePostCommandHandlerTests.cs` |
| `PublishPostCommandHandlerTests` | `Handle_WhenPostNotFound_ThrowsNotFoundException` | Unit | `tests/BlogBackend.Application.Tests/Blog/PublishPostCommandHandlerTests.cs` |
| `PublishPostCommandHandlerTests` | `Handle_WhenDraft_PublishesAndDispatchesEvent` | Unit | `tests/BlogBackend.Application.Tests/Blog/PublishPostCommandHandlerTests.cs` |
| `ApproveCommentCommandHandlerTests` | `Handle_WhenPending_SetsApproved` | Unit | `tests/BlogBackend.Application.Tests/Blog/ApproveCommentCommandHandlerTests.cs` |
| `ApproveCommentCommandHandlerTests` | `Handle_WhenAlreadyApproved_ThrowsDomainException` | Unit | `tests/BlogBackend.Application.Tests/Blog/ApproveCommentCommandHandlerTests.cs` |
| `SubscribeCommandHandlerTests` | `Handle_WithNewEmail_CreatesActiveSubscriber` | Unit | `tests/BlogBackend.Application.Tests/Subscription/SubscribeCommandHandlerTests.cs` |
| `SubscribeCommandHandlerTests` | `Handle_WithDuplicateEmail_ThrowsConflictException` | Unit | `tests/BlogBackend.Application.Tests/Subscription/SubscribeCommandHandlerTests.cs` |
| `ExportSubscribersQueryHandlerTests` | `Handle_ReturnsValidCsvBytes` | Unit | `tests/BlogBackend.Application.Tests/Subscription/ExportSubscribersQueryHandlerTests.cs` |
| `LoginCommandHandlerTests` | `Handle_WithValidCredentials_ReturnsTokenPair` | Unit | `tests/BlogBackend.Application.Tests/Identity/LoginCommandHandlerTests.cs` |
| `LoginCommandHandlerTests` | `Handle_WithInvalidPassword_ThrowsUnauthorizedException` | Unit | `tests/BlogBackend.Application.Tests/Identity/LoginCommandHandlerTests.cs` |
| `RefreshTokenCommandHandlerTests` | `Handle_WithValidToken_RotatesTokenAndInvalidatesOld` | Unit | `tests/BlogBackend.Application.Tests/Identity/RefreshTokenCommandHandlerTests.cs` |
| `RefreshTokenCommandHandlerTests` | `Handle_WithExpiredToken_ThrowsUnauthorizedException` | Unit | `tests/BlogBackend.Application.Tests/Identity/RefreshTokenCommandHandlerTests.cs` |
| `GetDashboardStatsQueryHandlerTests` | `Handle_ReturnsAggregateCountsFromRepositories` | Unit | `tests/BlogBackend.Application.Tests/Dashboard/GetDashboardStatsQueryHandlerTests.cs` |

### Requirement: Integration Tests

| Test Class | Test Method | Layer | File Path |
|---|---|---|---|
| `PostsEndpointTests` | `GetPosts_ReturnsPublishedPosts_WithEnvelope` | Integration | `tests/BlogBackend.Integration.Tests/Blog/PostsEndpointTests.cs` |
| `PostsEndpointTests` | `CreatePost_AsViewer_Returns403` | Integration | `tests/BlogBackend.Integration.Tests/Blog/PostsEndpointTests.cs` |
| `PostsEndpointTests` | `CreatePost_AsEditor_Returns201` | Integration | `tests/BlogBackend.Integration.Tests/Blog/PostsEndpointTests.cs` |
| `AuthEndpointTests` | `Login_WithValidCredentials_ReturnsTokenPair` | Integration | `tests/BlogBackend.Integration.Tests/Identity/AuthEndpointTests.cs` |
| `AuthEndpointTests` | `Login_WithInvalidCredentials_Returns401` | Integration | `tests/BlogBackend.Integration.Tests/Identity/AuthEndpointTests.cs` |
| `AuthEndpointTests` | `Refresh_WithValidToken_RotatesTokens` | Integration | `tests/BlogBackend.Integration.Tests/Identity/AuthEndpointTests.cs` |
| `SubscriptionsEndpointTests` | `Subscribe_WithValidEmail_Returns201` | Integration | `tests/BlogBackend.Integration.Tests/Subscription/SubscriptionsEndpointTests.cs` |
| `SubscriptionsEndpointTests` | `Export_AsAdmin_ReturnsCsvContentType` | Integration | `tests/BlogBackend.Integration.Tests/Subscription/SubscriptionsEndpointTests.cs` |
| `HealthEndpointTests` | `Health_WhenDatabaseConnected_ReturnsHealthy` | Integration | `tests/BlogBackend.Integration.Tests/HealthEndpointTests.cs` |

Test toolchain: xUnit, NSubstitute (unit mocking), TestContainers (PostgreSQL container for integration tests).

---

## 7. Infrastructure Constraints

### Requirement: EF Core Migrations

- EF Core 8 MUST be used as the ORM
- Migrations MUST live in `BlogBackend.Infrastructure/Migrations/`
- The initial migration MUST cover all three bounded contexts in a single PostgreSQL database
- `dotnet ef migrations add` MUST be runnable without errors before any PR

### Requirement: PostgreSQL

- PostgreSQL 15 or higher MUST be used
- Docker image `postgres:15-alpine` MUST be used for local development
- Connection string MUST be injected via environment variables; no credentials in source code

### Requirement: docker-compose

The `docker-compose.yml` MUST define two services:

| Service | Image | Purpose |
|---|---|---|
| `api` | `blogbackend:latest` (Dockerfile in solution) | .NET 8 API |
| `db` | `postgres:15-alpine` | PostgreSQL |

`docker-compose up` MUST bring both services online. `GET /health` MUST return Healthy after startup.

#### Scenario: docker-compose brings services online

- GIVEN the `docker-compose.yml` at solution root
- WHEN `docker-compose up --build` completes
- THEN `curl http://localhost:5000/health` MUST return HTTP 200 with `{ "status": "Healthy" }`

---

## 8. Hard Constraints

| ID | Constraint |
|---|---|
| HARD-001 | `dotnet build` MUST pass with 0 errors before any PR |
| HARD-002 | `dotnet test` MUST pass (all green) before any PR |
| HARD-003 | `BlogBackend.Domain` MUST NOT reference `BlogBackend.Infrastructure` or `BlogBackend.Api` |
| HARD-004 | All HTTP endpoints MUST be covered by OpenAPI/Swashbuckle annotations (`[ProducesResponseType]` on all controllers) |
| HARD-005 | Refresh tokens MUST be stored as bcrypt hash; plaintext MUST NEVER be persisted |
| HARD-006 | All API responses MUST use the standard envelope `{ success, data, error }` — no bare responses |
| HARD-007 | CORS MUST allow only `https://blog.miguel-anay.nom.pe` and `http://localhost:4321` in non-development environments |
| HARD-008 | No credentials, secrets, or connection strings MUST appear in source-controlled files; use environment variables or user-secrets |
| HARD-009 | `BlogBackend.Application` MUST NOT reference `BlogBackend.Infrastructure` — only ports (interfaces) from Domain |
| HARD-010 | Integration tests MUST use TestContainers (not a shared/live database) to ensure isolation |
