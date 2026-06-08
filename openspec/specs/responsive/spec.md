# Responsive Layout Specification

## Purpose

Define all behavior that MUST be true after the `web-responsive` change. This is a new capability — no existing spec exists to delta against.

## Requirements

### Requirement: REQ-001 Mobile Navigation Visibility

The site MUST provide a hamburger button visible at viewports ≤ 767px. The desktop `.site-nav` MUST be hidden at ≤ 767px. The hamburger button MUST be hidden at ≥ 768px.

#### Scenario: Hamburger visible on mobile

- GIVEN a viewport width of 360px
- WHEN the page loads
- THEN the hamburger button is visible and the desktop `.site-nav` is hidden

#### Scenario: Desktop nav visible on desktop

- GIVEN a viewport width of 1024px
- WHEN the page loads
- THEN the desktop `.site-nav` is visible and the hamburger button is hidden

---

### Requirement: REQ-002 Drawer ARIA Semantics

The mobile drawer MUST implement full ARIA accessibility: `aria-expanded` on the toggle button, a focus trap (Tab and Shift+Tab cycle only within the drawer while open), ESC closes the drawer, and focus returns to the toggle button on close.

#### Scenario: ARIA expanded state

- GIVEN the drawer is closed
- WHEN the hamburger button is tapped
- THEN `aria-expanded="true"` is set on the toggle button AND the drawer is visible

#### Scenario: ESC closes drawer and restores focus

- GIVEN the drawer is open
- WHEN the user presses ESC
- THEN the drawer closes AND focus returns to the hamburger toggle button

#### Scenario: Focus trap cycles inside drawer

- GIVEN the drawer is open and focus is on the last focusable element
- WHEN the user presses Tab
- THEN focus moves to the first focusable element inside the drawer

---

### Requirement: REQ-003 Body Scroll Lock

The body MUST NOT scroll while the mobile drawer is open.

#### Scenario: Scroll locked when drawer opens

- GIVEN the drawer is closed
- WHEN the hamburger button is tapped
- THEN `overflow: hidden` (or equivalent) is applied to `body` preventing scroll

#### Scenario: Scroll restored when drawer closes

- GIVEN the drawer is open
- WHEN the drawer is closed (by ESC, backdrop click, or nav link tap)
- THEN body scroll is restored

---

### Requirement: REQ-004 No Horizontal Overflow

At viewports 360, 414, 768, 1024, and 1440px, every page (/, /blog, /blog/[slug], /about, /cv, /courses) MUST NOT produce a horizontal scrollbar or overflow.

#### Scenario: No overflow at 360px

- GIVEN a viewport width of 360px
- WHEN any in-scope page is loaded
- THEN `document.documentElement.scrollWidth` equals `window.innerWidth`

#### Scenario: No overflow at 768px

- GIVEN a viewport width of 768px
- WHEN any in-scope page is loaded
- THEN no horizontal scrollbar is present

---

### Requirement: REQ-005 Vertical Padding on Mobile

Section and hero elements MUST use padding ≤ 40px on the vertical axis at viewports ≤ 767px via CSS token overrides, not hardcoded px values.

#### Scenario: Reduced hero padding on mobile

- GIVEN a viewport of 375px
- WHEN the homepage is loaded
- THEN hero vertical padding is ≤ 40px

#### Scenario: Tokens drive padding, not hardcoded px

- GIVEN any section or hero element
- WHEN the component CSS is inspected
- THEN padding values reference CSS custom properties (tokens), not literal px values

---

### Requirement: REQ-006 Stack Row and Blog Card Collapse

`.stack-row` and `.blog-card` layouts MUST collapse to a single column at ≤ 600px.

#### Scenario: Stack row single column at 480px

- GIVEN a viewport width of 480px
- WHEN a page containing `.stack-row` is loaded
- THEN all `.stack-row` items render in a single column

#### Scenario: Blog card single column at 480px

- GIVEN a viewport width of 480px
- WHEN the blog index page is loaded
- THEN `.blog-card` items render in a single column

---

### Requirement: REQ-007 Component-Level Fixes

The following component-specific constraints MUST hold:

| Component | Constraint |
|-----------|-----------|
| `SectionList.astro` | `padding-left` MUST be ≤ 24px at ≤ 767px; hardcoded 56px MUST be removed |
| `CourseCard.astro` | Hover offset MUST use a CSS token, not hardcoded `-24px` |
| `BlogPost.astro` TOC | TOC MUST be hidden or repositioned at ≤ 767px |
| `.cat-grid` | MUST render single column at ≤ 480px |
| `.site-footer__bottom` | MUST wrap to multiple lines on screens ≤ 767px |

#### Scenario: SectionList padding on mobile

- GIVEN a viewport of 375px
- WHEN a course page with `SectionList` is loaded
- THEN the `SectionList` padding-left is ≤ 24px

#### Scenario: CourseCard uses CSS token for hover

- GIVEN any `CourseCard` element
- WHEN the component CSS is inspected
- THEN the hover transform/translate value references a CSS custom property

#### Scenario: TOC hidden on mobile

- GIVEN a viewport of 375px
- WHEN a blog post with a TOC is loaded
- THEN the TOC is not visible in the viewport

#### Scenario: cat-grid single column at 480px

- GIVEN a viewport width of 480px
- WHEN a page containing `.cat-grid` is loaded
- THEN items render in a single column

---

## Out of Scope

- Tailwind utility migration
- Visual redesign (colors, typography, brand identity)
- Dark mode
- Touch gestures beyond standard tap
- Server-side device detection
