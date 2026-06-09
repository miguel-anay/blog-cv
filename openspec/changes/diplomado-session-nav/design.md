# Design: Diplomado Session Navigation

## Technical Approach

Add `session_number INTEGER` to `course_resources` via a migration. Resources with the same `sectionId + sessionNumber` form a session. Derive `CourseSession[]` in the page layer using a pure helper. New `SessionBlock.astro` renders video + accordion. Existing `ResourceItem.astro` still used for non-session resources (backwards compat).

## Data Flow

```
[slug].astro
  ├─ activeSectionId (from ?section param)
  ├─ activeSection = course.sections.find(s => s.id === activeSectionId)
  ├─ sessions = groupSessions(activeSection.resources)   ← new
  ├─ CourseNav  ← receives: sections, activeSectionId, isDiplomado, sessions (CourseSession[])
  └─ SectionList ← receives: sections, activeSectionId
                     └─ SessionBlock ← per CourseSession (video + accordion)
                     └─ ResourceItem ← fallback when no session_number
```

## New Type: CourseSession

```ts
// src/lib/api-types.ts
export interface CourseSession {
  number: number;
  title: string;
  video?: CourseResource;
  materials: CourseResource[];
  anchorId: string;  // "session-{number}"
}
```

## File Changes

### 1. `src/lib/migrations/005_session_number.sql` (new)
```sql
ALTER TABLE course_resources ADD COLUMN session_number INTEGER;
```
Run: `turso db shell <DB_NAME> < src/lib/migrations/005_session_number.sql`

### 2. `src/lib/schema.ts`
Add to `courseResources`:
```ts
sessionNumber: integer('session_number'),
```

### 3. `src/lib/api-types.ts`
- `CourseResource`: add `sessionNumber?: number | null`
- Add `CourseSession` interface

### 4. `src/features/courses/lib/sessions.ts` (new)
```ts
export function groupSessions(resources: CourseResource[]): CourseSession[] {
  const map = new Map<number, CourseResource[]>();
  for (const r of resources) {
    if (r.sessionNumber == null) continue;
    if (!map.has(r.sessionNumber)) map.set(r.sessionNumber, []);
    map.get(r.sessionNumber)!.push(r);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([num, items]) => {
      const sorted = [...items].sort((a, b) => a.order - b.order);
      const video = sorted.find((r) => r.type === 'video');
      const primary = video ?? sorted[0];
      return {
        number: num,
        title: primary.title,
        video,
        materials: sorted.filter((r) => r !== video),
        anchorId: `session-${num}`,
      };
    });
}
```

### 5. `src/features/courses/components/SessionBlock.astro` (new)

Layout per session:
```
┌──────────────────────────────────────────┐
│ 01  Session title                        │  header
├──────────────────────────────────────────┤
│  [video embed — 16:9 full width]         │
├──────────────────────────────────────────┤
│  ▼ Material (N)                         │  <details>/<summary>
│     gh   repo link                       │
│     ↗    slides                          │
└──────────────────────────────────────────┘
```

- Root: `<div class="session-block" id="session-{n}">` with `scroll-margin-top: 100px`
- Header: number badge + session title as `<h2>`
- Video: reuse `getVideoEmbed()` logic inline (no external import needed)
- Accordion: `<details class="session-materials"><summary>Material ({count})</summary>` — only rendered when `materials.length > 0`
- Each material item: badge (gh / ↗ / ▶) + link

### 6. `src/features/courses/components/SectionList.astro`
- Import `groupSessions` and `SessionBlock`
- Per section: `const sessions = groupSessions(section.resources)`
- If `sessions.length > 0`: render `{sessions.map(s => <SessionBlock session={s} />)}`
- Else: render `{section.resources.map(r => <ResourceItem ... />)}` (existing fallback)

### 7. `src/features/courses/components/CourseNav.astro`
- Change prop type: `sessions?: CourseSession[]` (was `CourseResource[]`)
- Nav items: `href="#session-{s.number}"`, `data-section="session-{s.number}"`, label = `s.title`
- IntersectionObserver: observe `.session-block` elements (not `.resource`)

### 8. `src/pages/courses/[slug].astro`
- Import `groupSessions`
- Derive: `const sessions = groupSessions(activeSection?.resources ?? [])`
- Pass `sessions` (now `CourseSession[]`) to `<CourseNav>`

## Scroll-Margin

`scroll-margin-top: 100px` on `.session-block` (desktop) and `60px` on mobile to clear sticky nav.

## No Regression Path

- `groupSessions` returns `[]` when no resource has `sessionNumber` → `SectionList` falls back to `ResourceItem`
- Regular courses receive `sessions=[]` in `CourseNav` → no session rendering
- `anchorId` on `ResourceItem` still works for the rare case resources without session_number need anchoring
