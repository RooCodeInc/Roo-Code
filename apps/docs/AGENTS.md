# AGENTS.md

This file provides guidance to agents when working with code in this repository.

Non-obvious, project-specific rules:

- Start/build preload dotenv; analytics plugin is enabled only when POSTHOG_API_KEY is set. Use .env based on [.env.example](.env.example). CI injects it in [.github/workflows/docusaurus-build.yml](.github/workflows/docusaurus-build.yml). See [package.json](package.json) and [docusaurus.config.ts](docusaurus.config.ts).
- Use Node 20 locally to match CI; engines allow >=18 but CI runs 20.
- Linting targets only /src; docs content is not linted. Use "pnpm run lint:unused" to enforce unused import removal. Type checking uses "tsc" only (no emit); [tsconfig.json](tsconfig.json) is editor-focused.
- When moving/renaming docs, you must add an explicit redirect in [docusaurus.config.ts](docusaurus.config.ts) under plugin-client-redirects. This is required by [.roorules](.roorules).
- Internal doc links must be absolute and extensionless per [.roorules](.roorules) (example: /basic-usage/how-tools-work). Do not include ".md".
- Images in docs must use HTML tags per [.roorules](.roorules): <img src="/img/...png" alt="..." width="600" />.
- Sitemap: preset sitemap is disabled; a custom plugin is configured in [docusaurus.config.ts](docusaurus.config.ts) to filter URLs containing "/page/". Do not re-enable the preset sitemap.
- Local search plugin is configured with docsRouteBasePath "/". Keep routeBasePath "/" consistent when adding content or links.
- "Tutorial Videos" sidebar is generated from [docs/tutorial-videos.json](docs/tutorial-videos.json); titles are truncated to 40 chars in [sidebars.ts](sidebars.ts). Modify the JSON to add/remove videos.
- Navigation/footer links are centralized in [src/constants.ts](src/constants.ts) and consumed by [docusaurus.config.ts](docusaurus.config.ts). Update constants rather than hardcoding URLs.
- Legacy [Rakefile](Rakefile) is unrelated (Jekyll). Do not use it; all builds run through Docusaurus scripts.
- For structural/formatting research, use Context7 MCP (ID "/facebook/docusaurus") via [.roo/mcp.json](.roo/mcp.json); see [.roorules](.roorules).
- CI runs build and check-types (no lint). Run lint locally to catch issues CI won't.
