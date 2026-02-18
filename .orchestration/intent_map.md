# Intent Map (Spatial Map)

This file maps high-level business intents to physical files and (optionally) AST node selectors.

## Example mappings

- **INT-001 — Code Indexing: Workspace Symbol Index**

    - Files:
        - `src/services/code-index/**`
        - `src/services/code-index/manager.ts`
        - `src/services/code-index/cache-manager.ts`
    - AST nodes (examples):
        - `src/services/code-index/manager.ts::ClassDeclaration:CodeIndexManager`
        - `src/services/code-index/cache-manager.ts::FunctionDeclaration:computeFileHash`

- **INT-002 — JWT Authentication Migration**
    - Files:
        - `src/auth/**`
        - `src/middleware/jwt.ts`
    - AST nodes (examples):
        - `src/auth/jwt.ts::ClassDeclaration:JwtManager`
        - `src/middleware/jwt.ts::FunctionDeclaration:jwtMiddleware`

## How to read this map

- File globs convey the primary surface area owned by the intent.
- AST node selectors (optional) provide precise anchors for spatial hashes and traceability.

## Update policy

1. When an intent evolves (new files added to scope), append the mapping here and update `active_intents.yaml`.
2. Keep entries minimal and machine-parseable: file globs first, optional AST selectors second.
