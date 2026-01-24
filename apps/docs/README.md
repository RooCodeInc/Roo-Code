# Roo Code Documentation

This directory contains the official documentation site for Roo Code, built with [Docusaurus](https://docusaurus.io/).

## Development

```bash
# From the monorepo root
pnpm install

# Start the development server
pnpm --filter @roo-code/docs start

# Build the site
pnpm --filter @roo-code/docs build

# Serve the built site locally
pnpm --filter @roo-code/docs serve
```

## Environment Variables

Create a `.env` file based on `.env.example`:

- `POSTHOG_API_KEY`: Analytics key for PostHog (optional)
- `INTERCOM_APP_ID`: Intercom widget ID (optional)

## Vercel Deployment Setup

The docs are deployed to Vercel automatically on push to `main`. To set up:

### Required Secrets

Add these secrets to the GitHub repository settings:

1. **VERCEL_TOKEN**: Personal Access Token from Vercel

    - Go to Vercel → Settings → Tokens
    - Create a new token with appropriate permissions

2. **VERCEL_ORG_ID**: Organization ID from Vercel

    - Run `vercel link` in the docs directory
    - Find the ID in `.vercel/project.json`

3. **VERCEL_DOCS_PROJECT_ID**: Project ID for the docs

    - Same as above, from `.vercel/project.json`

4. **POSTHOG_API_KEY**: PostHog analytics key (optional)

5. **INTERCOM_APP_ID**: Intercom widget ID (optional)

### Vercel Project Configuration

In the Vercel project settings:

- **Root Directory**: `apps/docs`
- **Build Command**: `pnpm build`
- **Output Directory**: `build`
- **Install Command**: `pnpm install --frozen-lockfile`
- **Framework Preset**: Other
- **Node Version**: 20.x

### Custom Domain

Configure the custom domain `docs.roocode.com` in Vercel project settings.

## Structure

- `docs/`: Markdown documentation files
- `src/`: Custom React components and theme overrides
- `static/`: Static assets (images, etc.)
- `docusaurus.config.ts`: Main configuration file
- `sidebars.ts`: Sidebar navigation structure

## Writing Documentation

- Use absolute, extensionless paths for internal links: `/basic-usage/how-tools-work`
- Use HTML `<img>` tags for images: `<img src="/img/example.png" alt="Description" width="600" />`
- Add redirects in `docusaurus.config.ts` when moving/renaming pages

## Migration Notes

This documentation was migrated from the standalone `Roo-Code-Docs` repository into the monorepo as `apps/docs`.

Key changes:

- Package name changed to `@roo-code/docs`
- `@roo-code/types` dependency uses `workspace:^` protocol
- Edit URLs now point to `apps/docs/` path in the Roo-Code repository
- Deployment moved from standalone repo to monorepo workflows
