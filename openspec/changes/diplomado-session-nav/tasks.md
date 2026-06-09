# Tasks: Diplomado Session Navigation (v2)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 180–240 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | single PR |

---

## Phase 1 — DB + Schema + Types

- [ ] 1.1 Create `src/lib/migrations/005_session_number.sql` with `ALTER TABLE course_resources ADD COLUMN session_number INTEGER;`
- [ ] 1.2 In `src/lib/schema.ts`, add `sessionNumber: integer('session_number')` to `courseResources`
- [ ] 1.3 In `src/lib/api-types.ts`, add `sessionNumber?: number | null` to `CourseResource`
- [ ] 1.4 In `src/lib/api-types.ts`, add `CourseSession` interface (number, title, video?, materials, anchorId)

## Phase 2 — groupSessions helper

- [ ] 2.1 Create `src/features/courses/lib/sessions.ts` with `groupSessions(resources: CourseResource[]): CourseSession[]`
- [ ] 2.2 Helper must: filter null sessionNumber, sort by sessionNumber, separate video from materials, set anchorId = `session-{number}`

## Phase 3 — SessionBlock component

- [ ] 3.1 Create `src/features/courses/components/SessionBlock.astro` with Props `{ session: CourseSession }`
- [ ] 3.2 Root `<div class="session-block" id={session.anchorId}>` with `scroll-margin-top: 100px`
- [ ] 3.3 Header row: number badge (padStart 2) + session title as `<h2>`
- [ ] 3.4 Video embed (16:9 iframe) when `session.video` exists and URL is YouTube/Vimeo
- [ ] 3.5 `<details class="session-materials">` accordion with `<summary>Material ({count})</summary>` — only when `session.materials.length > 0`
- [ ] 3.6 Each material: badge (gh/↗/▶) + `<a href target="_blank">` title

## Phase 4 — SectionList update

- [ ] 4.1 In `SectionList.astro`, import `groupSessions` and `SessionBlock`
- [ ] 4.2 Per section, compute `const hasSessions = groupSessions(section.resources).length > 0`
- [ ] 4.3 Render `SessionBlock` per session when `hasSessions`, fallback to `ResourceItem` otherwise
- [ ] 4.4 Remove `anchorId` prop pass to `ResourceItem` in the fallback path (keep it working as before)

## Phase 5 — CourseNav update

- [ ] 5.1 In `CourseNav.astro`, change `sessions` prop type from `CourseResource[]` to `CourseSession[]`
- [ ] 5.2 Nav item hrefs: `#session-{s.number}`, `data-section="session-{s.number}"`, label = `s.title`
- [ ] 5.3 IntersectionObserver: observe `.session-block` elements (not `.resource`)

## Phase 6 — [slug].astro update

- [ ] 6.1 Import `groupSessions` from `'../../features/courses/lib/sessions'`
- [ ] 6.2 Derive `const sessions = groupSessions(activeSection?.resources ?? [])` after activeSection derivation
- [ ] 6.3 Pass `sessions` (CourseSession[]) to `<CourseNav>`

## Phase 7 — Verification

- [ ] 7.1 `npm run build` → 0 errors
- [ ] 7.2 Run migration against DB: `turso db shell <DB_NAME> < src/lib/migrations/005_session_number.sql`
- [ ] 7.3 Manual: diplomado with session_number set → nav shows session titles, right side shows SessionBlock with video + accordion
- [ ] 7.4 Manual: accordion expands and shows material links
- [ ] 7.5 Manual: clicking nav item scrolls to correct session block
- [ ] 7.6 Manual: scroll-spy activates correct nav item
- [ ] 7.7 Manual: regular course page unaffected
- [ ] 7.8 Manual: diplomado section without session_number data → fallback ResourceItem cards
