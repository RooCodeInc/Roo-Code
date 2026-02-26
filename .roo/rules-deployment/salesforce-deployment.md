# Salesforce Deployment Guidelines (High Priority)

Priority: HIGH

These rules guide the agent when planning or executing Salesforce metadata deployments.

## Core principles

- Deploy only changed components, not entire folders.
- Use the modern Salesforce CLI `sf` commands, not legacy `sfdx`.
- Prefer manifest- or metadata-type-targeted deploys that include only components detected as changed.
- Validate first (check-only) when appropriate; run minimal, relevant tests.

## Compatibility with existing component guides

- This document sets deployment strategy and CLI usage. It does not override component-specific creation, structure, or metadata rules in:
    - `.roo/rules-code/apex-guide.md`
    - `.roo/rules-code/lwc-guide.md`
    - `.roo/rules-Salesforce_Agent/*` (custom-object, custom-field, assignment-rules, field-permissions, etc.)
- When a component guide requires immediate deployment (e.g., after creating a profile, queue, or tab), follow that requirement but still:
    - Use `sf` CLI commands (not `sfdx`).
    - Deploy only the changed component(s) rather than the entire folder.
    - Prefer `--check-only` (dry run) first when not explicitly prohibited, then perform the actual deploy.
    - Run minimal, relevant tests (e.g., apex tests impacted by the change).

## Detecting changed components

- Compute the delta from your default branch or last commit:
    - Use `git diff --name-only` to list changed files in `force-app/**`.
    - Map changed file paths to metadata types (e.g., ApexClass, ApexTrigger, AuraDefinitionBundle, LWC, CustomObject, etc.).
    - Optionally generate a dynamic `package.xml` manifest that includes only changed components.

## Deployment Instructions

- **Use the `<sf_deploy_metadata>` tool for all deployments.**
- The tool handles both validation (dry-run) and actual deployment of metadata.
- Simply provide the metadata components that need to be deployed, and the tool will handle the deployment process.

- All metadata retrieval and deployment operations should use the `<sf_deploy_metadata>` tool, which abstracts away the CLI commands and provides a unified interface for deployment.

## Packaging only changed components

- If a manifest is required, generate a dynamic `package.xml` from the delta set.
- Include only metadata members corresponding to changed paths.
- Avoid using `--source-dir force-app` at the repo root without filtering—it will deploy the whole folder.

## Testing strategy

- The `<sf_deploy_metadata>` tool handles test execution during deployment.
- Default to `RunLocalTests` unless org or compliance requires `RunAllTestsInOrg`.
- For Apex, select only impacted test classes when possible (e.g., based on dependency mapping).

## Do NOT

- Do not run sf CLI deploy commands directly; always use the `<sf_deploy_metadata>` tool.
- Do not deploy entire `force-app` when only a few components changed.
- Do not run all tests for trivial changes unless required by policy.

## Notes

- These rules are intended for CI pipelines and local deploy flows.
- The agent should prefer delta-based deploys and provide explicit component lists.
- When unsure of metadata type mappings, the agent should propose a generated `package.xml` containing only changed items.
