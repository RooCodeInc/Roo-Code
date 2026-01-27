# Blog MVP Specification

> **Canonical URL:** `https://roocode.com/blog`

This document specifies the MVP implementation for the Roo Code marketing blog.

---

## Table of Contents

1. [Overview](#overview)
2. [Folder Structure & Naming Conventions](#folder-structure--naming-conventions)
3. [Frontmatter Schema](#frontmatter-schema)
4. [Publish Gating Rules](#publish-gating-rules)
5. [Rendering Strategy](#rendering-strategy)
6. [Display Rules](#display-rules)
7. [Markdown Rendering Constraints](#markdown-rendering-constraints)
8. [Slug Rules](#slug-rules)
9. [Substack Syndication Checklist](#substack-syndication-checklist)
10. [Containment Rules](#containment-rules)

---

## Overview

The blog lives at `https://roocode.com/blog` as the canonical source. Substack (`https://blog.roocode.com`) serves as a syndication channel with shorter excerpts and links back to the canonical posts.

### Routes

| Route          | Description                              |
| -------------- | ---------------------------------------- |
| `/blog`        | Blog index page (lists published posts)  |
| `/blog/[slug]` | Individual post page (Article page type) |

---

## Folder Structure & Naming Conventions

### Content Location

```
apps/web-roo-code/
├── content/
│   └── blog/
│       ├── my-first-post.md
│       ├── another-great-article.md
│       └── ...
```

### File Naming

- **Format:** `{slug}.md`
- **Rules:**
    - Use lowercase letters, numbers, and hyphens only
    - No underscores, spaces, or special characters
    - The filename (without `.md`) becomes the URL slug
    - Example: `introducing-roo-code-cloud.md` → `/blog/introducing-roo-code-cloud`

---

## Frontmatter Schema

All blog posts require YAML frontmatter at the top of the Markdown file.

### Required Fields

| Field             | Type                       | Description                                      |
| ----------------- | -------------------------- | ------------------------------------------------ |
| `title`           | `string`                   | Post title (displayed in UI and meta tags)       |
| `description`     | `string`                   | Post excerpt/summary (used for SEO and previews) |
| `author`          | `string`                   | Author name                                      |
| `publish_date`    | `YYYY-MM-DD`               | Publication date in ISO format                   |
| `publish_time_pt` | `h:mmam/pm`                | Publication time in Pacific Time                 |
| `status`          | `"draft"` \| `"published"` | Publication status                               |
| `slug`            | `string`                   | URL slug (must match filename)                   |

### Optional Fields

| Field           | Type       | Description                                 |
| --------------- | ---------- | ------------------------------------------- |
| `cover_image`   | `string`   | Path to cover image (relative to `/public`) |
| `tags`          | `string[]` | List of topic tags                          |
| `canonical_url` | `string`   | Override canonical URL (if cross-posting)   |

### Example Frontmatter

```yaml
---
title: "Introducing Roo Code Cloud: AI-Powered Code Review"
description: "Learn how Roo Code Cloud brings intelligent code review to your team's workflow with automated PR analysis and suggestions."
author: "Matt Rubens"
publish_date: 2026-01-29
publish_time_pt: 9:00am
status: published
slug: introducing-roo-code-cloud
cover_image: /images/blog/introducing-roo-code-cloud-cover.png
tags:
    - roo-code-cloud
    - product-launch
    - code-review
---
```

### Time Format Requirements

- **Allowed format:** `h:mmam/pm` (12-hour format)
- **Examples:**
    - ✅ `9:00am`
    - ✅ `12:30pm`
    - ✅ `11:59pm`
    - ❌ `09:00` (24-hour format not allowed)
    - ❌ `9:00 AM` (space not allowed)
    - ❌ `9:00a` (must be `am/pm`, not `a/p`)

---

## Publish Gating Rules

Posts are gated by both date and time in **Pacific Time (PT)**.

### Visibility Logic

A post is **publicly visible** when ALL of the following are true:

1. `status` is `"published"`
2. Current PT date/time is at or past the scheduled publish moment

```typescript
// Pseudocode for publish gating
function isPostVisible(post: BlogPost): boolean {
	if (post.status !== "published") return false

	const now = getCurrentTimePT()
	const publishMoment = parsePublishMoment(post.publish_date, post.publish_time_pt)

	return now >= publishMoment
}

// More explicitly:
// now_pt_date > publish_date
// OR (now_pt_date === publish_date AND now_pt_minutes >= publish_time_pt_minutes)
```

### Key Behavior

- **No deploy required for time-gating:** Once a post is merged and deployed with `status: published` and a future `publish_date`/`publish_time_pt`, it will automatically become visible at the scheduled time.
- **Adding new posts still requires deploy:** Creating a brand-new post file requires merge and deploy to make it available.
- **Draft posts never visible:** Posts with `status: "draft"` are not rendered on any public page.

---

## Rendering Strategy

### Dynamic SSR (Required)

Blog routes **must** use Server-Side Rendering (SSR) to evaluate publish gating at request time.

```typescript
// In Next.js App Router
export const dynamic = "force-dynamic"
export const runtime = "nodejs" // Required for filesystem access
```

### Why Dynamic?

- Enables time-based publish gating without redeployment
- Posts automatically appear at their scheduled publish time
- No ISR/static generation (would require revalidation)

### Runtime Requirements

- **Node.js runtime** (not Edge) - required for filesystem reads of Markdown content
- Configure in route files:
    ```typescript
    export const runtime = "nodejs"
    ```

---

## Display Rules

### Date Display

- **Format:** `Posted YYYY-MM-DD` (date only, no time)
- **Timezone:** Pacific Time (PT)
- **Example:** `Posted 2026-01-29`

### No Time Display

The publication time is used internally for gating but is **never shown to users**.

---

## Markdown Rendering Constraints

### Markdown Only

- ✅ Standard Markdown syntax
- ✅ GFM (GitHub Flavored Markdown) extensions
- ❌ **No raw HTML** - HTML tags in content are stripped/escaped

### Allowed Syntax

- Headings (`#`, `##`, etc.)
- Paragraphs and line breaks
- Bold, italic, strikethrough
- Links and images (Markdown syntax only)
- Code blocks and inline code
- Ordered and unordered lists
- Blockquotes
- Tables (GFM)
- Horizontal rules

### Disallowed

- `<div>`, `<span>`, `<script>`, or any HTML tags
- Inline styles
- Custom components (unless explicitly supported)

---

## Slug Rules

### Format

Slugs must match the pattern: `^[a-z0-9]+(?:-[a-z0-9]+)*$`

- Lowercase letters and numbers only
- Words separated by single hyphens
- No leading/trailing hyphens
- No consecutive hyphens

### Examples

| Valid           | Invalid                                |
| --------------- | -------------------------------------- |
| `hello-world`   | `Hello-World` (uppercase)              |
| `post-123`      | `post_123` (underscore)                |
| `a`             | `-hello` (leading hyphen)              |
| `my-great-post` | `my--great-post` (consecutive hyphens) |

### Uniqueness

- Slugs must be unique across all posts
- Duplicate slugs must fail fast with a clear error during build/dev
- Error message should identify both conflicting files

---

## Substack Syndication Checklist

When publishing a new post, follow this checklist for Substack syndication:

### Before Publishing

- [ ] Post is live on `roocode.com/blog/[slug]`
- [ ] All images are accessible and loading correctly
- [ ] Meta tags and OG image are rendering

### Substack Post Creation

- [ ] Create new post on Substack (`blog.roocode.com`)
- [ ] Use shortened excerpt (1-2 paragraphs max)
- [ ] Add prominent link back to canonical: `Read the full article at roocode.com/blog/[slug]`
- [ ] Include canonical URL in Substack post settings (if available)
- [ ] Match publish date with canonical post

### Post-Publish Verification

- [ ] Substack post links correctly to canonical
- [ ] Email notification (if enabled) includes canonical link
- [ ] Social preview shows canonical URL

---

## Containment Rules

Changes for the blog feature should be **contained** to minimize impact on existing site functionality.

### In Scope

| Area        | Details                                            |
| ----------- | -------------------------------------------------- |
| Blog routes | `app/blog/` directory (index + dynamic slug)       |
| Content     | `content/blog/` directory                          |
| Navigation  | Add blog link to nav bar and footer                |
| Sitemap     | Add blog URLs to sitemap generation                |
| Analytics   | Track blog page views (existing PostHog/GTM setup) |
| SEO         | Add structured data for Article page type          |

### Out of Scope

| Area           | Notes                          |
| -------------- | ------------------------------ |
| Homepage       | No blog preview widget in MVP  |
| Other routes   | No changes to existing pages   |
| Authentication | Blog is fully public           |
| Comments       | Not in MVP                     |
| Search         | Not in MVP                     |
| RSS feed       | Not in MVP (consider post-MVP) |

### Glue Code

Minimal integration points:

1. **Navigation:** Add "Blog" link to `components/chromes/nav-bar.tsx` and `components/chromes/footer.tsx`
2. **Constants:** Update `EXTERNAL_LINKS.BLOG` to internal `/blog` path (or add `INTERNAL_LINKS.BLOG`)
3. **Sitemap:** Add blog URLs to `app/robots.ts` and sitemap generation
4. **Structured Data:** Add Article schema to blog post pages

---

## Implementation Checklist

For implementers, ensure the following:

- [ ] Create `content/blog/` directory
- [ ] Create `app/blog/page.tsx` (index)
- [ ] Create `app/blog/[slug]/page.tsx` (post)
- [ ] Implement Markdown parsing with frontmatter
- [ ] Implement publish gating logic (PT timezone)
- [ ] Add slug validation with duplicate detection
- [ ] Configure dynamic SSR with Node.js runtime
- [ ] Strip/escape HTML from Markdown content
- [ ] Add navigation links
- [ ] Update sitemap
- [ ] Add Article structured data
- [ ] Write tests for publish gating logic

---

## References

- **Issue:** MKT-66
- **Current external blog:** `EXTERNAL_LINKS.BLOG` in `src/lib/constants.ts`
- **First post content:** See MKT-73 for source content
