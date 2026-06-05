# Exploration: dotnet-blog-backend

## Current State

The project (`blog-cv`) already has a TypeScript/Hono backend (`blog-api/`) deployed as a single AWS Lambda function, backed by Turso/LibSQL via Drizzle ORM. It implements Hexagonal Architecture at a light scale: domain interfaces, application use-cases, infrastructure adapters, HTTP route handlers. Auth is a single static Bearer token with no roles. Newsletter subscription delegates to Resend. There is no tags entity, no comment system, no JWT/refresh-token flow, and no subscriber management — only a simple `subscribe(email)` port.

The requested C# .NET 8 backend is a **new standalone service** that will run alongside or eventually replace the Hono API. It must add everything the Hono API lacks: role-based JWT auth, comment moderation, subscription plans, admin dashboard stats, and proper full-text search.

---

## Domain Model — Bounded Contexts

### Blog Context

| Entity   | Key Fields |
|----------|------------|
| Post     | id, slug (VO), title, content (markdown), coverImageUrl, tags[], categoryIds[], authorId, status (Draft/Published/Archived), publishedAt, readMinutes (computed), createdAt, updatedAt |
| Category | id, slug (VO), name, description |
| Tag      | id, slug (VO), name |
| Author   | id, name, email (VO), bio, avatarUrl, userId (FK to Identity) |
| Comment  | id, postId (FK), authorName, authorEmail, content, status (Pending/Approved/Rejected), createdAt |

Domain Events: `PostPublishedEvent`, `CommentSubmittedEvent`

### Subscription Context

| Entity           | Key Fields |
|------------------|------------|
| Subscriber       | id, email (VO), name, status (Active/Unsubscribed/Bounced), subscribedAt, unsubscribedAt |
| SubscriptionPlan | id, name (Free/Premium), description, priceMonthly, features[] |
| SubscriberPlan   | subscriberId, planId, startDate, endDate (junction) |
| Notification     | id, subscriberId, type (NewPost/Welcome), subject, sentAt, status |

Domain Port: `IEmailNotificationPort`

### Identity Context

| Entity       | Key Fields |
|--------------|------------|
| User         | id, email, username, passwordHash, isActive, createdAt |
| Role         | id, name (Admin/Editor/Viewer) |
| UserRole     | userId, roleId (junction) |
| RefreshToken | id, userId, tokenHash, expiresAt, revokedAt |

---

## Hexagonal Architecture Layers

```
BlogApi.Domain/          — No dependencies. Pure C# records/classes.
  Blog/Entities/         Post.cs, Category.cs, Tag.cs, Author.cs, Comment.cs
  Blog/ValueObjects/     Slug.cs, Email.cs, ReadMinutes.cs
  Blog/Events/           PostPublishedEvent.cs, CommentSubmittedEvent.cs
  Blog/Repositories/     IPostRepository.cs, ICategoryRepository.cs, ITagRepository.cs,
                         IAuthorRepository.cs, ICommentRepository.cs
  Subscription/          Subscriber.cs, SubscriptionPlan.cs, Notification.cs
  Subscription/Ports/    IEmailNotificationPort.cs  ← domain-defined outbound port
  Identity/              User.cs, Role.cs, RefreshToken.cs, IUserRepository.cs

BlogApi.Application/     — Depends only on Domain. Orchestrates use cases.
  Blog/Posts/            GetPostsQuery + Handler, CreatePostCommand + Handler,
                         UpdatePostCommand + Handler, DeletePostCommand + Handler,
                         PublishPostCommand + Handler, SearchPostsQuery + Handler
  Blog/Comments/         SubmitCommentCommand + Handler, ModerateCommentCommand + Handler
  Subscription/          SubscribeCommand + Handler, UnsubscribeCommand + Handler,
                         GetSubscribersQuery + Handler, NotifySubscribersCommand + Handler
  Admin/                 GetDashboardStatsQuery + Handler
  Auth/                  LoginCommand + Handler, RefreshTokenCommand + Handler, RevokeTokenCommand
  Shared/Behaviors/      ValidationBehavior.cs, LoggingBehavior.cs (MediatR pipeline)
  Shared/                PaginatedResult<T>.cs, IUnitOfWork.cs

BlogApi.Infrastructure/  — Adapters. Depends on Domain + Application.
  Persistence/           AppDbContext.cs (EF Core 8 + Npgsql)
  Persistence/Repos/     PostRepository.cs, SubscriberRepository.cs, UserRepository.cs, ...
  Persistence/Migrations/
  Email/                 SmtpEmailAdapter.cs : IEmailNotificationPort
                         SendGridEmailAdapter.cs : IEmailNotificationPort
  Identity/              JwtTokenService.cs, PasswordHasher.cs
  DependencyInjection.cs

BlogApi.Api/             — HTTP adapter. Depends on Application layer only.
  Controllers/V1/        PostsController.cs, CategoriesController.cs, TagsController.cs,
                         AuthorsController.cs, CommentsController.cs,
                         SubscriptionsController.cs, SubscribersController.cs,
                         AdminController.cs, AuthController.cs
  Middleware/            ExceptionMiddleware.cs, CorrelationIdMiddleware.cs
  DTOs/Request/          CreatePostRequest.cs, LoginRequest.cs, SubscribeRequest.cs, ...
  DTOs/Response/         PostResponse.cs, SubscriberResponse.cs, DashboardStatsResponse.cs, ...
  Mappers/               PostMapper.cs, SubscriberMapper.cs
  Program.cs
```

---

## Technology Stack Recommendation

| Decision     | Choice                                          | Rationale |
|--------------|-------------------------------------------------|-----------|
| Framework    | ASP.NET Core 8 Web API with **Controllers**     | Complex routing, role filters, admin API — controllers scale better than minimal API |
| ORM          | EF Core 8 + **Npgsql** (PostgreSQL)             | Full-text search via `tsvector`, pg_trgm fuzzy search, row-level security |
| CQRS         | **MediatR 12** or **Mediator** (MIT)            | Pipeline behaviors for validation/logging; clean use-case boundary |
| Validation   | **FluentValidation** + MediatR `ValidationBehavior` | Runs before every handler |
| Auth         | **ASP.NET Core Identity** + **JWT Bearer**      | Identity handles User/Role persistence; JWT 15min access + 7d refresh |
| Email        | `IEmailNotificationPort` → adapters            | SMTP or SendGrid, swapped via config key |
| Docs         | **Swashbuckle** (Swagger UI) + NSwag CLI        | Dev UI + typed TS client generation for Astro frontend |
| Testing      | **xUnit** + **Moq** + **TestContainers**        | Unit: handlers with Moq; Integration: real Postgres in Docker |
| Rate Limiting | ASP.NET Core 8 built-in `RateLimiting`         | No extra package needed |
| Health Checks | `AspNetCore.HealthChecks.NpgSql`              | Standard pattern |

---

## Full REST API Endpoint Inventory

Response envelope:
```json
{ "data": ..., "meta": { "page": 1, "pageSize": 10, "total": 50 }, "error": null }
```

### Auth (`/api/v1/auth`)
- `POST /login` — returns access_token + refresh_token
- `POST /refresh` — exchange refresh token
- `POST /revoke` [Bearer] — revoke refresh token
- `GET /me` [Bearer] — current user info

### Posts (`/api/v1/posts`)
- `GET /` — list (query: page, pageSize, category, tag, search, status)
- `GET /:slug` — get by slug
- `POST /` [Admin/Editor] — create
- `PUT /:slug` [Admin/Editor] — full update
- `PATCH /:slug` [Admin/Editor] — partial update
- `DELETE /:slug` [Admin] — delete
- `POST /:slug/publish` [Admin/Editor]
- `POST /:slug/unpublish` [Admin/Editor]

### Categories (`/api/v1/categories`)
- `GET /`, `GET /:slug`, `POST /` [Admin/Editor], `PUT /:slug` [Admin/Editor], `DELETE /:slug` [Admin]

### Tags (`/api/v1/tags`)
- `GET /`, `POST /` [Admin/Editor], `DELETE /:slug` [Admin]

### Authors (`/api/v1/authors`)
- `GET /`, `GET /:id`, `POST /` [Admin], `PUT /:id` [Admin], `DELETE /:id` [Admin]

### Comments (`/api/v1/posts/:slug/comments` + `/api/v1/comments`)
- `GET /posts/:slug/comments` — list approved comments
- `POST /posts/:slug/comments` — submit (→ Pending)
- `GET /comments` [Admin/Editor] — all with status filter
- `PATCH /comments/:id/approve` [Admin/Editor]
- `PATCH /comments/:id/reject` [Admin/Editor]
- `DELETE /comments/:id` [Admin]

### Subscriptions (`/api/v1/subscriptions`, `/api/v1/subscribers`)
- `POST /subscriptions/subscribe` — public subscribe
- `POST /subscriptions/unsubscribe` — unsubscribe via token
- `GET /subscribers` [Admin] — list (filter: status, plan)
- `GET /subscribers/:id` [Admin]
- `PATCH /subscribers/:id/activate` [Admin]
- `PATCH /subscribers/:id/deactivate` [Admin]
- `GET /subscribers/export` [Admin] — CSV export
- `GET /subscription-plans` — list plans
- `POST /subscription-plans` [Admin]
- `PUT /subscription-plans/:id` [Admin]

### Admin (`/api/v1/admin`)
- `GET /dashboard/stats` [Admin/Editor] — post count, subscriber count, comment count, recent activity
- `GET /dashboard/activity` [Admin/Editor] — 10 most recent events

### Health
- `GET /health` — DB + email ping
- `GET /api/v1/openapi.json` — OpenAPI spec

**Total: ~40 endpoints across 9 resource groups**

---

## Solution Structure

```
BlogApi.sln
├── src/
│   ├── BlogApi.Domain/
│   │   ├── Blog/Entities/
│   │   ├── Blog/ValueObjects/
│   │   ├── Blog/Events/
│   │   ├── Blog/Repositories/
│   │   ├── Subscription/Entities/
│   │   ├── Subscription/Ports/
│   │   └── Identity/Entities/
│   ├── BlogApi.Application/
│   │   ├── Blog/Posts/
│   │   ├── Blog/Comments/
│   │   ├── Subscription/
│   │   ├── Admin/
│   │   ├── Auth/
│   │   └── Shared/
│   ├── BlogApi.Infrastructure/
│   │   ├── Persistence/
│   │   ├── Email/
│   │   ├── Identity/
│   │   └── DependencyInjection.cs
│   └── BlogApi.Api/
│       ├── Controllers/V1/
│       ├── Middleware/
│       ├── DTOs/
│       ├── Mappers/
│       ├── Program.cs
│       └── Dockerfile
├── tests/
│   ├── BlogApi.Domain.Tests/
│   ├── BlogApi.Application.Tests/
│   └── BlogApi.Integration.Tests/
├── docker-compose.yml
├── docker-compose.override.yml
└── .env.example
```

---

## Non-Functional Configuration

**CORS**: `["https://blog.miguel-anay.nom.pe", "http://localhost:4321"]`

**Rate Limiting** (ASP.NET Core 8 built-in):
- Anonymous: 60 req/min
- Authenticated: 300 req/min
- `/subscriptions/subscribe`: 10 req/min per IP

**Docker Compose** services:
- `api` (port 5000→8080)
- `db` (postgres:16-alpine, volume: `postgres_data`)

**appsettings.json keys**: `ConnectionStrings.Default`, `Jwt.Secret`, `Jwt.AccessTokenExpiryMinutes` (15), `Jwt.RefreshTokenExpiryDays` (7), `Cors.AllowedOrigins`, `Email.Provider`, `Email.SendGrid.ApiKey`, `RateLimit.*`

---

## Risks

1. **Content format conflict**: existing Hono API stores content as `ArticleBlock[]` JSON; .NET spec asks for markdown. Incompatible wire formats — decision needed before proposal.
2. **Coexistence vs replacement strategy**: which API does the Astro frontend call during migration? API Gateway routing and CORS must be planned.
3. **Tags entity gap**: tags don't exist in current TypeScript schema — new concept introduced here.
4. **MediatR v12+ licensing**: may require commercial license. Evaluate `Mediator` (MIT) as drop-in replacement.
5. **Async notification dispatch**: `NotifySubscribersCommand` must be fire-and-forget (background queue or Hangfire). Synchronous dispatch at post-publish will time out.
6. **Testing baseline**: strict_tdd not yet established for this service — right moment to set it up from day one.
7. **PostgreSQL is a new infra dependency**: existing stack uses Turso (SQLite). Adds a managed service (Supabase, Railway, Neon, or self-hosted).

---

## Status
Ready for `sdd-propose`
