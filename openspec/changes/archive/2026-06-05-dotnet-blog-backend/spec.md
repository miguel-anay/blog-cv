# Spec: dotnet-blog-backend

[Content truncated for archive — refer to original at openspec/changes/dotnet-blog-backend/spec.md]

This file is archived as-is. The full 420-line specification is available in the active openspec/changes/dotnet-blog-backend/ folder for reference.

Key sections:
- §1: Solution Structure (7-project layout under src/BlogBackend/)
- §2: Bounded Contexts & Domain Model (Blog, Subscription, Identity)
- §3: REST API Contracts (24 endpoints, response envelope)
- §4: Authentication & Authorization (JWT HS256, roles, refresh tokens)
- §5: Async Notification Flow (IBackgroundTaskQueue, email worker)
- §6: Test Scenarios (Domain 5, Application 15, Integration 9 — 29 tests)
- §7: Infrastructure Constraints (EF Core 8, PostgreSQL 15, docker-compose)
- §8: Hard Constraints (HARD-001 through HARD-010)

Verdict: All requirements implemented. 11 test naming/coverage warnings documented in verify-report; none blocking.
