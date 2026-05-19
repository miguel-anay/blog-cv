# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Astro v5.14.1 blog starter template with MDX support, RSS feeds, and sitemap generation. The project follows the **Scope Rule** architectural pattern and Screaming Architecture principles.

## Development Commands

```bash
npm run dev         # Start dev server at localhost:4321
npm run build       # Build production site to ./dist/
npm run preview     # Preview build locally
npm run astro ...   # Run CLI commands like `astro add`, `astro check`
```

## Architecture

### Scope Rule (Code Organization Principle)

**"Scope determines structure"** - This project follows strict component placement rules:

- **Code used by 2+ features** → Goes in `src/components/` (shared/global)
- **Code used by 1 feature** → Stays local in `src/features/[feature-name]/`
- **No exceptions** - This rule is absolute

### Directory Structure

```
src/
├── components/           # ONLY for components used in 2+ features
│   ├── layout/          # Site-wide layout components
│   │   ├── Header.astro        # Site header (used everywhere)
│   │   ├── HeaderLink.astro    # Co-located with Header
│   │   └── Footer.astro        # Site footer (used everywhere)
│   └── seo/             # SEO and metadata components
│       └── BaseHead.astro      # Meta tags and SEO (used everywhere)
├── features/            # Feature-specific components and logic
│   └── blog/
│       └── components/
│           └── FormattedDate.astro  # Blog-only date formatter
├── pages/               # File-based routing
│   ├── blog/
│   │   ├── [...slug].astro     # Dynamic blog routes
│   │   └── index.astro         # Blog listing page
│   ├── about.astro
│   ├── index.astro
│   └── rss.xml.js
├── layouts/             # Page layouts
│   └── BlogPost.astro
├── content/             # Content collections
│   └── blog/            # Blog posts (Markdown/MDX)
├── lib/                 # Utilities and constants
│   └── constants.ts     # Site-wide constants (SITE_TITLE, etc.)
└── styles/
    └── global.css
```

### Content Management
- **Blog Posts**: Markdown/MDX files in `src/content/blog/`
- **Content Collections**: Configured in `src/content.config.ts` with frontmatter schema validation
- **Frontmatter Schema**: Requires `title`, `description`, `pubDate`, optional `updatedDate` and `heroImage`

### Page Routing
- File-based routing in `src/pages/` directory
- Dynamic blog routes handled by `src/pages/blog/[...slug].astro`
- RSS feed generated at `src/pages/rss.xml.js`

### Configuration
- **Astro Config**: `astro.config.mjs` with MDX and sitemap integrations
- **Site Constants**: Global data in `src/lib/constants.ts` (SITE_TITLE, SITE_DESCRIPTION)
- **Site URL**: Configured as `https://example.com` in astro.config.mjs

### Component Organization Rules

**Shared Components** (in `src/components/`):
- Header, Footer, BaseHead - Used across all pages
- Organized by purpose: `layout/`, `seo/`

**Feature Components** (in `src/features/`):
- FormattedDate - Used only in blog feature
- Co-located with the feature that needs them

### Static-First Approach
- All components are static Astro components by default
- No client-side JavaScript unless explicitly needed
- Optimized for performance and SEO