# Remove VSIX publish steps design

Date: 2026-05-10

## Problem
Two GitHub workflows still do local packaging *and* publish to registries:
- `.github/workflows/marketplace-publish.yml`
- `.github/workflows/nightly-publish.yml`

User wants to keep:
- `.vsix` build
- git tag creation
- GitHub Release creation

User wants to remove only registry publish steps:
- VS Code Marketplace publish
- Open VSX publish

## Goals
- Keep VSIX packaging in both workflows.
- Keep git tag creation in `marketplace-publish.yml`.
- Keep GitHub Release creation in `marketplace-publish.yml`.
- Remove all registry publish steps from both workflows.

## Non-goals
- No changes to `.vsix` packaging commands.
- No changes to git tag logic.
- No changes to GitHub Release logic.
- No changes to workflow triggers or job permissions unless needed by removed steps.
- No changes to app code or package scripts.

## Design
### 1) Remove Marketplace publish from release workflow
In `.github/workflows/marketplace-publish.yml`, delete the `Publish Extension` step that runs:
- `pnpm --filter roo-cline publish:marketplace`

Keep:
- `Package Extension`
- `Create and Push Git Tag`
- `Create GitHub Release`

### 2) Remove registry publish from nightly workflow
In `.github/workflows/nightly-publish.yml`, delete both publishing steps:
- `Publish to VS Code Marketplace`
- `Publish to Open VSX Registry`

Keep:
- checkout
- node/pnpm setup
- nightly version patching
- `Build VSIX`

### 3) Preserve build artifacts
Both workflows should still leave the packaged `.vsix` in `bin/` so it can be used by:
- GitHub Release assets in the release workflow
- local inspection or later upload steps if added later

## Data flow after change
### marketplace-publish.yml
1. Trigger on release-related PR close or manual dispatch.
2. Checkout code.
3. Setup Node/pnpm.
4. Package extension into `.vsix`.
5. Create/push git tag.
6. Create GitHub Release with `.vsix` attached.
7. No registry publish happens.

### nightly-publish.yml
1. Trigger on `main` push or manual dispatch.
2. Checkout code.
3. Setup Node/pnpm.
4. Patch nightly version.
5. Build `.vsix`.
6. No registry publish happens.

## Risks
- Nightly workflow no longer publishes to registries automatically.
- Release workflow no longer publishes to Marketplace automatically.
- Release distribution now depends on GitHub Release only.

These risks are accepted by request.

## Testing
- Verify `marketplace-publish.yml` no longer contains `publish:marketplace`.
- Verify `nightly-publish.yml` no longer contains Marketplace/Open VSX publish commands.
- Verify both workflows still contain packaging/build steps.
- Verify `marketplace-publish.yml` still contains git tag and GitHub Release steps.

## Acceptance criteria
- `marketplace-publish.yml` no longer publishes to VS Code Marketplace.
- `nightly-publish.yml` no longer publishes to VS Code Marketplace or Open VSX.
- Both workflows still build `.vsix`.
- `marketplace-publish.yml` still tags and creates GitHub Release.
- No app code or package script changes required.