# Research: Intent-Governed Hook Middleware

**Feature**: Intent-Governed Hook Middleware  
**Date**: 2026-02-16  
**Phase**: 0 - Outline & Research

## Research Tasks

### 1. Glob Pattern Matching for Scope Validation

**Task**: Research glob pattern matching libraries and best practices for file path validation in Node.js/TypeScript

**Decision**: Use `minimatch` library (already available in Node.js ecosystem, widely used, supports `*` and `**` wildcards)

**Rationale**:

- `minimatch` is the de facto standard for glob matching in Node.js
- Lightweight and performant (<10ms per validation meets spec requirement)
- Supports both `*` (single segment) and `**` (recursive) wildcards as required
- Well-maintained and battle-tested
- Can normalize paths for cross-platform compatibility

**Alternatives Considered**:

- Node.js built-in `path` module: Limited glob support, would require custom implementation
- `glob` package: Overkill for pattern matching (designed for file system traversal)
- Regular expressions: More complex, harder to maintain, less intuitive for users
- Custom implementation: Unnecessary complexity, reinventing the wheel

**Implementation Notes**:

- Use `minimatch.match(path, pattern)` for single pattern matching
- For multiple patterns, check if any pattern matches (OR logic)
- Normalize file paths to workspace-relative before matching
- Handle edge cases: symbolic links, special characters, Windows path separators

---

### 2. SHA256 Content Hashing Implementation

**Task**: Research SHA256 hashing implementation in Node.js for file content

**Decision**: Use Node.js built-in `crypto` module with `createHash('sha256')`

**Rationale**:

- Native Node.js module, no external dependencies
- Cryptographically secure (meets constitution requirement)
- High performance (can handle 1MB files in <50ms as required)
- Standard implementation, well-documented
- Supports streaming for large files if needed

**Alternatives Considered**:

- External libraries (e.g., `crypto-js`): Unnecessary dependency, larger bundle size
- MD5: Faster but not cryptographically secure (violates constitution)
- Custom hash function: Unnecessary complexity, security risk

**Implementation Notes**:

- Use `crypto.createHash('sha256').update(content).digest('hex')` for string content
- For file content, read as Buffer and hash directly
- Normalize whitespace if needed (per constitution: "whitespace-normalized, comment-preserved")
- Handle encoding consistently (UTF-8 for text files)

---

### 3. YAML Parsing for active_intents.yaml

**Task**: Research YAML parsing libraries for TypeScript/Node.js

**Decision**: Use `js-yaml` library (standard YAML parser for JavaScript/TypeScript)

**Rationale**:

- Most popular YAML parser for Node.js (millions of downloads)
- TypeScript support with type definitions
- Handles YAML schema validation
- Good error messages for malformed YAML
- Supports both parsing and stringifying (if needed for updates)

**Alternatives Considered**:

- `yaml` package: Newer but less mature, smaller ecosystem
- Custom YAML parser: Unnecessary complexity
- JSON instead of YAML: Less human-readable, harder to edit manually

**Implementation Notes**:

- Use `yaml.load()` for parsing with schema validation
- Validate parsed structure matches expected intent schema
- Handle YAML errors gracefully (per FR-015)
- Cache parsed intents to avoid re-parsing on every operation

---

### 4. JSONL (JSON Lines) File Handling

**Task**: Research best practices for append-only JSONL file operations

**Decision**: Use Node.js built-in `fs` module with append mode (`fs.appendFileSync` or `fs.promises.appendFile`)

**Rationale**:

- Native Node.js functionality, no dependencies
- Append-only operation is atomic at OS level (reduces corruption risk)
- Simple implementation (one JSON object per line)
- Efficient for large files (streaming not needed for append operations)

**Alternatives Considered**:

- Database (SQLite, etc.): Overkill for append-only log, adds complexity
- Structured logging libraries: Unnecessary abstraction for simple JSONL format
- Custom file locking: OS-level append is sufficient for single-writer scenarios

**Implementation Notes**:

- Use `fs.promises.appendFile()` for async operations
- Format: `JSON.stringify(entry) + '\n'` per line
- Handle file creation if doesn't exist
- Error handling for disk full, permissions, etc. (per SC-009: 99.9% success rate)

---

### 5. Middleware/Interceptor Pattern in TypeScript

**Task**: Research middleware patterns for intercepting function calls in TypeScript

**Decision**: Use function composition with async/await, following existing Roo Code patterns

**Rationale**:

- Aligns with existing `BaseTool.handle()` pattern
- TypeScript-friendly (type safety for tool parameters)
- Supports async operations (file I/O, approvals)
- Composable (multiple hooks can be chained)
- Fail-safe (errors in hooks don't crash extension)

**Alternatives Considered**:

- Proxy pattern: More complex, harder to debug
- Decorators: Less flexible, harder to compose
- Event emitters: More overhead, less direct control flow

**Implementation Notes**:

- Create `HookEngine` class that wraps tool execution
- Pre-hooks: `await preHook(tool, params)` before `tool.execute()`
- Post-hooks: `await postHook(tool, result)` after `tool.execute()`
- Return early from pre-hook if validation fails
- Catch and log hook errors, don't propagate to tool execution

---

### 6. Optimistic Locking with Content Hashes

**Task**: Research optimistic locking patterns using content hashes

**Decision**: Store expected hash when operation starts, compare before write

**Rationale**:

- Simple and effective for single-file operations
- Content hash is more reliable than modification time
- Detects actual content changes, not just metadata changes
- Aligns with spatial independence principle

**Alternatives Considered**:

- File locking (pessimistic): Blocks other operations, not suitable for parallel orchestration
- Version numbers: Requires maintaining version state, more complex
- Modification time: Less reliable, can change without content change

**Implementation Notes**:

- Store `expectedHash` when file is read/operation starts
- Before write: Read current file, compute hash, compare
- If mismatch: Return error, don't write
- If match: Proceed with write, update hash
- Handle race conditions: Multiple operations on same file

---

### 7. System Prompt Injection Pattern

**Task**: Research how to inject dynamic content into system prompts in Roo Code

**Decision**: Modify `SYSTEM_PROMPT()` function to append intent context XML block

**Rationale**:

- Aligns with existing prompt construction pattern
- XML blocks are standard in LLM prompts (Anthropic, OpenAI)
- Minimal changes to existing code
- Context is injected at construction time (per assumption)

**Alternatives Considered**:

- Separate prompt section: More complex, harder to maintain
- Template system: Overkill for simple context injection
- Dynamic prompt modification: Risk of breaking existing prompt structure

**Implementation Notes**:

- Load active intent from `IntentManager` in `SYSTEM_PROMPT()`
- Format as XML: `<intent_context>...</intent_context>`
- Append to prompt before returning
- Handle case when no active intent (optional context or prompt to select)

---

### 8. VS Code Extension File System Access

**Task**: Research VS Code API for workspace file system access

**Decision**: Use `vscode.workspace.fs` API for file operations in `.orchestration/` directory

**Rationale**:

- VS Code API provides cross-platform file operations
- Handles workspace-relative paths correctly
- Supports async operations
- Integrates with VS Code's file watching and permissions

**Alternatives Considered**:

- Node.js `fs` module: Works but doesn't integrate with VS Code workspace
- Third-party file libraries: Unnecessary dependency

**Implementation Notes**:

- Use `vscode.workspace.fs.readFile()` and `vscode.workspace.fs.writeFile()`
- Use `vscode.Uri.joinPath()` for path construction
- Handle workspace root detection: `vscode.workspace.workspaceFolders[0].uri`
- Create `.orchestration/` directory if doesn't exist

---

## Resolved Clarifications

All technical unknowns have been resolved:

1. ✅ Glob pattern matching: `minimatch` library
2. ✅ SHA256 hashing: Node.js `crypto` module
3. ✅ YAML parsing: `js-yaml` library
4. ✅ JSONL file handling: Node.js `fs.appendFile`
5. ✅ Middleware pattern: Function composition with async/await
6. ✅ Optimistic locking: Content hash comparison
7. ✅ System prompt injection: XML block in `SYSTEM_PROMPT()`
8. ✅ File system access: VS Code `workspace.fs` API

## Dependencies to Add

Based on research, the following dependencies need to be added to `package.json`:

- `minimatch`: ^10.0.0 (glob pattern matching)
- `js-yaml`: ^4.1.0 (YAML parsing)
- `@types/js-yaml`: ^4.0.0 (TypeScript types)

Note: `crypto` and `fs` are built-in Node.js modules, no installation needed.

## Performance Considerations

- Glob matching: <10ms per validation (meets SC-008)
- SHA256 hashing: <50ms for 1MB files (meets SC-004)
- YAML parsing: Cache parsed intents to avoid repeated parsing
- JSONL append: Async operations to avoid blocking
- Hook execution: <100ms total latency (meets constitution requirement)

## Security Considerations

- Path traversal: Validate file paths are within workspace before scope checking
- YAML injection: Use safe YAML parsing (js-yaml's `safeLoad` or `load` with schema)
- Content hashing: Use cryptographically secure SHA256 (not MD5)
- File permissions: Respect VS Code workspace permissions

## Next Steps

Proceed to Phase 1: Design & Contracts

- Generate data-model.md with entity definitions
- Create API contracts for hook system
- Generate quickstart.md for developers
