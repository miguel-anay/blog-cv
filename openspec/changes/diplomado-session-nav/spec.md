# Spec: Diplomado Session Navigation

## Requirements

### REQ-001 — Session Grouping in Data Model

`CourseResource` records belonging to the same session MUST share a `session_number` value. Resources with the same `sectionId + sessionNumber` are one session. Resources with `sessionNumber = null` remain standalone (backward compat).

**Scenario: Grouped resources**
- GIVEN a section with 6 sessions, each having 1 video + N materials
- WHEN resources are loaded from DB
- THEN resources with `session_number = 1` are one group, `session_number = 2` another, etc.

---

### REQ-002 — Session List in Sidebar

When a diplomado section is active (`?section={id}`), the sidebar MUST display the SESSIONS (grouped) as nav items, not flat individual resources. Session label = video title (or first resource title if no video).

**Scenario: Sessions visible in nav**
- GIVEN a diplomado section with 6 sessions (each with session_number 1–6)
- WHEN the user loads `?section={id}`
- THEN the sidebar lists 6 session items, one per session_number

---

### REQ-003 — Session Block Layout

Each session on the right-side content area MUST render as a `SessionBlock`:
a. A clear numbered header: `01 Session title`
b. Video embed at the top (if a video resource exists in the session)
c. An accordion (`<details>/<summary>`) below with all non-video materials
d. Visual separator between sessions

**Scenario: Video + materials**
- GIVEN session 1 has 1 video + 3 links
- WHEN the section content renders
- THEN the video embed appears first; below it a collapsed accordion labeled "Material (3)"; expanding it shows 3 resource links

**Scenario: No materials**
- GIVEN session 2 has only 1 video, no other resources
- THEN no accordion is shown — only the video embed

---

### REQ-004 — Anchor Scroll on Click

Clicking a session nav item MUST scroll to the corresponding `SessionBlock`.

**Scenario: Click scrolls to session**
- GIVEN the session nav lists 6 items
- WHEN the user clicks session 3
- THEN the viewport scrolls to the `SessionBlock` with `id="session-3"`, cleared by scroll-margin-top

---

### REQ-005 — Desktop Sticky Sidebar

On viewports ≥ 768px the sidebar remains `position: sticky; top: 80px` for the full scroll length.

---

### REQ-006 — Mobile Vertical Sticky Nav

On viewports ≤ 767px the session nav MUST:
a. Render as a vertical list (not horizontal)
b. Stick to the top of the viewport (`position: sticky; top: 0`)
c. Remain visible while scrolling
d. Be internally scrollable if list exceeds 50vh

---

### REQ-007 — Scroll-Spy Active State

As the user scrolls, the nav item for the session in the viewport MUST receive `is-active` class via IntersectionObserver targeting `.session-block` elements.

---

### REQ-008 — No Regression on Regular Courses

Course pages (`type === 'course'`) and diplomado sections without `session_number` data MUST render exactly as before using flat `ResourceItem` cards.

---

## Out of Scope

- New DB table for sessions (handled via `session_number` column on existing table)
- Changes to `/courses/[slug]/sections/` grid page
- Non-diplomado course pages
