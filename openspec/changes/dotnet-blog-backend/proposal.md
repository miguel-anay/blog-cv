# Proposal: .NET 8 Blog Backend (dotnet-blog-backend)

## Intent

The current Hono/Turso API serves the blog but ships only a single static Bearer token (no roles, no JWT), stores content as block-based JSON, and dispatches subscriber emails synchronously in-request. We need a service that supports role-based administration, async notifications, subscriber/plan management, comment moderation, and dashboard analytics. This change introduces a standalone **.NET 8 service** that delivers those capabilities additively — Hono stays untouched and in production until a future migration.

## Scope

### In Scope
- New .NET 8 solution: Domain, Application, Infrastructure, Api projects (Full Hexagonal + MediatR CQRS).
- Three bounded contexts: **Blog**, **Subscription**, **Identity**.
- JWT auth (access + hashed refresh tokens) with 3 roles: Admin/Editor/Viewer.
- REST API under `/api/v1`, OpenAPI (Swashbuckle), versioned, standard response envelope.
- Subscriber CRUD + CSV export; admin dashboard stats/activity endpoints.
- Content stored and served as **raw markdown strings** (clean break from Hono's JSON blocks).
- xUnit + Moq + TestContainers from day one; `docker-compose` (API + PostgreSQL).

### Out of Scope
- Astro frontend changes (consuming markdown from .NET) — future change.
- Migrating/decommissioning the Hono API or its Turso data.
- Payment processing for paid plans (plan entity modeled, billing deferred).
- OAuth / social login.

## Capabilities

### New Capabilities
- `blog-content`: posts, categories, tags, authors as markdown-based resources.
- `comment-moderation`: public submission + Admin/Editor approve/reject flow.
- `subscription-management`: subscribe/unsubscribe, plans, CSV export, async notifications.
- `identity-auth`: JWT login/refresh/revoke, role-based authorization.
- `admin-dashboard`: aggregate stats and recent-activity endpoints.

### Modified Capabilities
- None (greenfield service; Hono specs untouched).

## Approach

Full Hexagonal architecture (Approach A from exploration): Domain holds entities, value objects, ports, and events; Application holds MediatR command/query handlers with a FluentValidation pipeline behavior; Infrastructure adapts EF Core 8 + Npgsql (PostgreSQL), email ports, and JWT. Api exposes Controllers (chosen over Minimal API for admin-heavy routing and per-controller DI). Domain events (`PostPublishedEvent`) dispatch in-process via MediatR; notification email runs through `IBackgroundTaskQueue` to keep requests non-blocking. PostgreSQL chosen for full-text search, transactions, and fuzzy matching.

## Integration with Astro Frontend

The .NET API runs as a **parallel service** at a separate domain/port; the Astro frontend keeps consuming Hono today. Migration is additive: .NET stands up, gets validated, and only later does a separate change point Astro at it. CORS allows `blog.miguel-anay.nom.pe` and `localhost:4321`.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Content format conflict (JSON blocks vs markdown) | Resolved | Markdown puro; Astro update is future scope |
| Coexistence with Hono | Med | .NET at separate domain/port; Hono untouched, separate DB |
| Tags entity new vs Hono (categories only) | Low | Separate DB; no schema conflict |
| MediatR v12+ licensing | Med | Evaluate Mediator (MIT) during implementation |
| Sync notification timeouts | Med | `IBackgroundTaskQueue` minimum for dispatch |
| No existing test infra | Med | Establish xUnit + TestContainers from day one |
| New Postgres infra dependency | Med | Managed hosting (Supabase free tier or Railway) |

## Rollback Plan

The service is additive and isolated in a new solution/directory with its own DB. Rollback = stop the .NET container and remove the deployment; Hono and the live frontend are unaffected since nothing depends on the new API yet.

## Dependencies

- PostgreSQL instance (managed: Supabase/Railway; local: docker-compose).
- Email provider (SMTP dev, SendGrid prod) behind `IEmailNotificationPort`.

## Success Criteria

- [ ] `dotnet build` passes with 0 errors.
- [ ] All REST endpoints documented in OpenAPI spec.
- [ ] JWT auth with Admin/Editor/Viewer roles enforced.
- [ ] Subscriber CRUD + CSV export working.
- [ ] Admin dashboard stats endpoint working.
- [ ] xUnit test projects scaffolded (Domain, Application, Integration).
- [ ] `docker-compose up` brings API + Postgres online; `/health` Healthy.
