# Blog Specification for roocode.com/blog

This document captures all decisions for the canonical blog on roocode.com/blog so implementation can proceed without ambiguity.

## Canonical URL

- **Primary:** `https://roocode.com/blog`
- **Substack:** `https://blog.roocode.com` (syndication + subscribe/community)
- Substack posts should link back to canonical roocode.com URLs

## Content Source

- **Location:** `src/content/blog/`
- **Format:** Markdown files (`.md`)
- **Naming Convention:** `{slug}.md` (e.g., `prds-are-becoming-artifacts-of-the-past.md`)

## Frontmatter Schema

All fields are **required** for both draft and published posts.

```yaml
---
title: "Post Title"
slug: "post-slug"
description: "Brief description for SEO and previews"
tags:
  - tag1
  - tag2
status: "draft" | "published"
publish_date: "YYYY-MM-DD"
publish_time_pt: "h:mmam/pm"
---
```

### Field Details

| Field             | Type     | Format                       | Example                                                   |
| ----------------- | -------- | ---------------------------- | --------------------------------------------------------- |
| `title`           | string   | Any text                     | `"PRDs Are Becoming Artifacts of the Past"`               |
| `slug`            | string   | `^[a-z0-9]+(?:-[a-z0-9]+)*$` | `"prds-are-becoming-artifacts-of-the-past"`               |
| `description`     | string   | Any text                     | `"The economics of software specification have flipped."` |
| `tags`            | string[] | Array of strings (max 15)    | `["product-management", "ai"]`                            |
| `status`          | enum     | `"draft"` or `"published"`   | `"published"`                                             |
| `publish_date`    | string   | `YYYY-MM-DD`                 | `"2026-01-12"`                                            |
| `publish_time_pt` | string   | `h:mmam/pm` only             | `"9:00am"`                                                |

### Time Format Rules

- **Allowed:** `h:mmam/pm` (e.g., `9:00am`, `12:30pm`, `1:00pm`)
- **NOT allowed:** 24-hour format (`HH:mm`), `h:mma` without minutes

### Slug Rules

- Must match regex: `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- Must be unique across all posts
- Duplicate slugs will fail fast with a clear error

## Publish Gating Rules

Publishing is evaluated in **Pacific Time (PT)**.

A post is public when:

```
status = "published"
AND (
  now_pt_date > publish_date
  OR (now_pt_date == publish_date AND now_pt_minutes >= publish_time_pt_minutes)
)
```

### Scheduling Behavior

- A committed + deployed post becomes visible automatically on/after its scheduled publish moment **without a deploy**
- Adding a brand-new post file still requires merge/deploy
- "No deploy" means the time-gate flips automatically at request-time

## Rendering Strategy

- **Mode:** Dynamic SSR (not static generation)
- **Runtime:** Node.js (required for filesystem reads)
- **Route Config:**
    ```typescript
    export const dynamic = "force-dynamic"
    export const runtime = "nodejs"
    ```
- Do NOT implement `generateStaticParams` (conflicts with request-time gating)

## Display Rules

- UI shows **date only** (no time)
- Format: `Posted YYYY-MM-DD` (e.g., `Posted 2026-01-29`)
- Date is displayed in PT

## Markdown Rendering

- **Allowed:** Standard Markdown + GFM (GitHub Flavored Markdown)
- **NOT allowed:** Raw HTML
- Use `react-markdown` with `remark-gfm` plugin
- Do NOT include `rehype-raw`

## YouTube Quotes + Timestamps

Blog posts often include blockquotes sourced from Roo Code podcast videos.

- Any YouTube link in markdown opens in an in-page modal (does not navigate away).
- To start the modal at a specific point in the episode, add a timestamp to the URL:
    - `...watch?v=VIDEO_ID&t=123` (seconds)
    - `...watch?v=VIDEO_ID&t=1m23s` (h/m/s)
    - `...watch?v=VIDEO_ID&t=1:23` (mm:ss)

### Authoring Helper Script

If you have the Knowledge Graph repo checked out locally, you can auto-suggest timestamps by matching quotes against transcript lines:

- `Roo-Code-GTM-Knowledge-Graph/scripts/add-youtube-quote-timestamps.ts`
- Run (recommended from the `Roo-Code/` repo root):
    - `npx tsx ../Roo-Code-GTM-Knowledge-Graph/scripts/add-youtube-quote-timestamps.ts` (dry-run + JSON output)
    - `npx tsx ../Roo-Code-GTM-Knowledge-Graph/scripts/add-youtube-quote-timestamps.ts --write` (updates blog markdown links)
    - Optional tuning:
        - `--maxWindowLines=12` (increase if transcripts are heavily line-wrapped)
        - `--writeMinScore=0.9` (only write very high-confidence matches)

## Substack Syndication Checklist

When syndicating to Substack (`blog.roocode.com`):

1. Use shorter excerpts on Substack
2. Add a link back to canonical URL at the top: `Originally published at roocode.com/blog/[slug]`
3. Ensure canonical URL in Substack post settings points to roocode.com

## Containment Rules

Blog changes should be limited to:

1. `/blog` pages (`src/app/blog/`)
2. Blog content layer (`src/lib/blog/`)
3. Blog content (`src/content/blog/`)
4. Minimal glue:
    - Navigation links (nav-bar, footer)
    - Sitemap configuration
    - Analytics events

Do NOT modify:

- Unrelated page components
- Site-wide layout (except adding breadcrumbs/scripts)
- Unrelated route behavior

## Sitemap Behavior

- Sitemap is generated at **build time** via `next-sitemap`
- Newly-unlocked scheduled posts may lag until the next deploy
- This lag is acceptable for MVP
- For real-time sitemap updates, a dynamic sitemap route would be needed (future enhancement)

## File Structure

```
apps/web-roo-code/
├── src/
│   ├── app/
│   │   └── blog/
│   │       ├── page.tsx           # Blog index
│   │       └── [slug]/
│   │           └── page.tsx       # Blog post page
│   ├── content/
│   │   └── blog/
│   │       └── *.md               # Blog post files
│   ├── lib/
│   │   └── blog/
│   │       ├── index.ts           # Exports
│   │       ├── types.ts           # TypeScript types
│   │       ├── content.ts         # Content loading
│   │       ├── time.ts            # PT utilities
│   │       ├── validation.ts      # Zod schema
│   │       └── analytics.ts       # PostHog events
│   └── components/
│       └── blog/
│           └── BlogAnalytics.tsx  # Client analytics
└── docs/
    └── blog.md                    # This file
```

## Related Issues

- MKT-66: Blog Spec Document (this file)
- MKT-67: Blog Content Layer
- MKT-68: Blog Index Page
- MKT-69: Blog Post Page
- MKT-70: Blog SEO & Structured Data
- MKT-71: Blog Sitemap
- MKT-72: Blog Navigation Links
- MKT-73: First Published Blog Post
- MKT-74: Blog Analytics (PostHog)
