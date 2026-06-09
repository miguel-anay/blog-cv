# Proposal: Diplomado Session Navigation

## Intent

When a user views a diplomado section (e.g. "02 - Diseño de Data Warehouses con SQLSERVER y SSIS"), the current detail page shows the section's resources (sesiones) but provides no navigation to jump between them. The user must scroll manually.

The goal is to add session-level navigation within the active section:
- The sidebar lists each session (CourseResource) by name
- Clicking a session scrolls automatically to it
- On desktop the sidebar is always sticky and visible alongside the content
- On mobile the nav is a vertical list that sticks to the top and remains accessible while scrolling

## Scope

- **In scope**: CourseResource items treated as "sesiones"; sidebar nav showing them; anchor scroll; IntersectionObserver scroll-spy for active state; desktop sticky (already works, minor fix); mobile vertical sticky nav
- **Out of scope**: DB migration; new session entity; any change to regular (non-diplomado) course pages

## Motivation

The section "02 - Diseño de DW" has 6 resources. Without a nav, users have no way to know how many sessions exist or jump directly to one. This is a navigation gap that hurts usability especially on long sections.

## Approach

Use the existing `CourseResource[]` data already passed to the detail page. Add `id="resource-{id}"` anchors to each resource. Extend `CourseNav` to accept and render a session list when in diplomado mode. Introduce scroll-spy via IntersectionObserver for active highlighting.

No API changes. No DB changes. 4 files touched.
