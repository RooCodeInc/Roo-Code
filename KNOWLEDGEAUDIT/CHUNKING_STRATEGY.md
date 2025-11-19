# Intelligent Chunking Strategy

**Date:** 2025-11-19
**Phase:** 3.2 - Design Intelligent Chunking Rules
**Status:** Complete

---

## Executive Summary

This document defines intelligent chunking rules that preserve semantic boundaries and context while respecting embedding size limits. The strategy prioritizes semantic completeness over strict size constraints.

**Key Principles:**
1. **Semantic Boundaries First:** Never split functions, methods, or classes mid-way
2. **Context Preservation:** Always include related code (comments, decorators, imports)
3. **Pragmatic Size Limits:** Allow larger chunks for semantic completeness
4. **Graceful Degradation:** Handle edge cases (very large functions) intelligently

---

## Chunking Rules

### Rule 1: Function/Method Boundaries (NEVER SPLIT)

**Priority:** Critical
**Applies to:** Functions, methods, arrow functions, function expressions

**Rule:**
- **NEVER** split a function or method mid-way
- Keep entire function in one chunk, even if it exceeds MAX_BLOCK_CHARS
- Exception: Functions >5000 chars (see Rule 1.1)

**Rationale:**
- Functions are atomic semantic units
- Splitting breaks signature, logic, and return context
- Metadata extraction requires complete function

**Implementation:**
```typescript
if (node.type === 'function_declaration' ||
    node.type === 'method_definition' ||
    node.type === 'arrow_function' ||
    node.type === 'function_expression') {

    // Keep entire function in one chunk
    if (node.text.length < 5000) {
        return createSingleChunk(node)
    } else {
        // Apply Rule 1.1 for very large functions
        return splitAtLogicalBoundaries(node)
    }
}
```

---

### Rule 1.1: Very Large Functions (>5000 chars)

**Priority:** High
**Applies to:** Functions exceeding 5000 characters

**Rule:**
- For functions >5000 chars, split at **logical boundaries**:
  1. Between top-level statements (not mid-statement)
  2. After variable declaration blocks
  3. Between logical sections (marked by comments)
  4. Before return statements (keep return with preceding logic)

**Rationale:**
- Very large functions are rare but exist
- Embedding models have limits (~8000 tokens ≈ 32,000 chars)
- Splitting at logical boundaries preserves partial semantic meaning

**Implementation:**
```typescript
function splitAtLogicalBoundaries(functionNode: Node): CodeBlock[] {
    const chunks: CodeBlock[] = []
    const statements = functionNode.children.filter(isStatement)

    let currentChunk: Node[] = []
    let currentSize = 0

    for (const stmt of statements) {
        if (currentSize + stmt.text.length > 3000 && currentChunk.length > 0) {
            // Create chunk with function signature + current statements
            chunks.push(createChunkWithSignature(functionNode, currentChunk))
            currentChunk = []
            currentSize = 0
        }
        currentChunk.push(stmt)
        currentSize += stmt.text.length
    }

    if (currentChunk.length > 0) {
        chunks.push(createChunkWithSignature(functionNode, currentChunk))
    }

    return chunks
}
```

**Note:** Each chunk includes the function signature for context.

---

### Rule 2: Class Boundaries (KEEP TOGETHER WHEN POSSIBLE)

**Priority:** High
**Applies to:** Classes, interfaces, type declarations

**Rule:**
- Keep entire class in one chunk if <3000 chars
- If class >3000 chars, split between methods (not mid-method)
- **Always** include in first chunk:
  - Class declaration
  - Class decorators
  - Constructor
  - Class-level properties
- Subsequent chunks include:
  - Class name (for context)
  - Individual methods (complete)

**Rationale:**
- Classes are cohesive units
- Constructor and properties provide essential context
- Methods can be understood independently if class context is preserved

**Implementation:**
```typescript
function chunkClass(classNode: Node): CodeBlock[] {
    if (classNode.text.length < 3000) {
        return [createSingleChunk(classNode)]
    }

    const chunks: CodeBlock[] = []
    const className = extractClassName(classNode)
    const classHeader = extractClassHeader(classNode) // declaration + constructor + properties
    const methods = extractMethods(classNode)

    // First chunk: class header
    chunks.push(createChunk(classHeader))

    // Subsequent chunks: individual methods with class context
    for (const method of methods) {
        const methodWithContext = `class ${className} {\n${method.text}\n}`
        chunks.push(createChunk(methodWithContext, { className }))
    }

    return chunks
}


## Chunk Size Optimization

### Size Limits

**Current Limits:**
- `MIN_BLOCK_CHARS = 50` (keep)
- `MAX_BLOCK_CHARS = 1000` (relax for semantic units)
- `MAX_CHARS_TOLERANCE_FACTOR = 1.15` (increase)

**Proposed Limits:**
- `MIN_BLOCK_CHARS = 50` (unchanged)
- `SEMANTIC_MAX_CHARS = 3000` (new - for complete semantic units)
- `ABSOLUTE_MAX_CHARS = 5000` (new - hard limit before forced split)
- `MAX_CHARS_TOLERANCE_FACTOR = 1.5` (increased from 1.15)

**Rationale:**
- Embedding models can handle ~8000 tokens (≈32,000 chars)
- 3000 chars ≈ 750 tokens (well within limits)
- 5000 chars ≈ 1250 tokens (still safe)
- Semantic completeness more valuable than strict size limits

### Size Priority

**Priority Order:**
1. **Semantic Completeness** (never split functions/methods)
2. **Context Preservation** (include comments, decorators)
3. **Size Optimization** (prefer smaller chunks when possible)

**Decision Tree:**
```
Is node a function/method?
├─ Yes: Is it <5000 chars?
│  ├─ Yes: Keep entire function (even if >3000 chars)
│  └─ No: Split at logical boundaries
└─ No: Is node a class?
   ├─ Yes: Is it <3000 chars?
   │  ├─ Yes: Keep entire class
   │  └─ No: Split between methods
   └─ No: Apply standard chunking (respect 3000 char limit)
```

---

## Edge Cases

### Edge Case 1: Very Large Functions (>5000 chars)

**Scenario:** Function with 200+ lines, 8000+ characters

**Strategy:**
- Split at logical boundaries (Rule 1.1)
- Include function signature in each chunk
- Mark chunks as related (same function)

**Example:**
```typescript
// Chunk 1: Signature + validation + setup
async function processLargeDataset(data: Data[]): Promise<Result> {
    // Validation (20 lines)
    // Setup (30 lines)
}

// Chunk 2: Signature + main processing
async function processLargeDataset(data: Data[]): Promise<Result> {
    // Main processing (80 lines)
}

// Chunk 3: Signature + cleanup + return
async function processLargeDataset(data: Data[]): Promise<Result> {
    // Cleanup (20 lines)
    // Return (10 lines)
}
```

---

### Edge Case 2: Very Large Classes (>10,000 chars)

**Scenario:** Class with 50+ methods, 10,000+ characters

**Strategy:**
- First chunk: Class header (declaration + constructor + properties)
- Subsequent chunks: Individual methods with class context
- Group related methods when possible

**Example:**
```typescript
// Chunk 1: Class header
class UserService {
    private db: Database
    constructor(db: Database) { ... }
}

// Chunk 2: CRUD methods
class UserService {
    async getUser(id: string) { ... }
    async createUser(data: UserData) { ... }
}

// Chunk 3: Auth methods
class UserService {
    async authenticate(username: string, password: string) { ... }
    async authorize(user: User, resource: string) { ... }
}
```

---

### Edge Case 3: Files with Many Imports (>50 imports)

**Scenario:** File with 50+ import statements, 2000+ chars of imports

**Strategy:**
- Store imports as metadata (not in chunk content)
- Include import count in chunk metadata
- Optionally: Include only relevant imports in metadata

**Example:**
```typescript
// Chunk metadata
{
    imports: [
        { source: './types', symbols: ['User', 'Role'] },
        { source: './utils', symbols: ['hash', 'compare'] },
        // ... 48 more imports
    ],
    importCount: 50
}

// Chunk content (no imports)
export async function authenticate(username: string, password: string) {
    // Implementation using imported symbols
}
```

---

### Edge Case 4: Minified/Generated Code

**Scenario:** Minified JavaScript, generated code, very long lines

**Strategy:**
- Detect minified code (line length >500 chars, no whitespace)
- Skip indexing or apply special handling
- Optionally: Pretty-print before chunking

**Detection:**
```typescript
function isMinified(content: string): boolean {
    const lines = content.split('\n')
    const avgLineLength = content.length / lines.length
    const hasWhitespace = /\s{2,}/.test(content)

    return avgLineLength > 500 && !hasWhitespace
}
```

---

### Edge Case 5: Mixed Language Files (e.g., Vue, Svelte)

**Scenario:** Single file with HTML, CSS, JavaScript

**Strategy:**
- Parse each section separately
- Chunk each language independently
- Preserve section boundaries

**Example (Vue):**
```vue
<!-- Chunk 1: Template -->
<template>
    <div>{{ message }}</div>
</template>

<!-- Chunk 2: Script -->
<script>
export default {
    data() { return { message: 'Hello' } }
}
</script>

<!-- Chunk 3: Style -->
<style scoped>
div { color: blue; }
</style>
```

---

## Implementation Plan

### Phase 3.3: Implementation Steps

1. **Update Constants** (`src/services/code-index/constants/index.ts`)
   ```typescript
   export const SEMANTIC_MAX_CHARS = 3000
   export const ABSOLUTE_MAX_CHARS = 5000
   export const MAX_CHARS_TOLERANCE_FACTOR = 1.5
   ```

2. **Add Semantic Boundary Detection** (`src/services/code-index/processors/parser.ts`)
   ```typescript
   function isSemanticUnit(node: Node): boolean {
       return ['function_declaration', 'method_definition',
               'arrow_function', 'function_expression',
               'class_declaration'].includes(node.type)
   }
   ```

3. **Implement Comment Inclusion**
   ```typescript
   function includeComments(node: Node, fileContent: string): string {
       // Look backwards for comments
       // Include JSDoc, inline comments, trailing comments
   }
   ```

4. **Implement Import Metadata**
   ```typescript
   function extractFileImports(fileContent: string): ImportInfo[] {
       // Parse all import statements
       // Return as metadata
   }
   ```

5. **Implement Smart Splitting**
   ```typescript
   function smartChunk(node: Node): CodeBlock[] {
       if (isSemanticUnit(node)) {
           if (node.text.length < ABSOLUTE_MAX_CHARS) {
               return [createSingleChunk(node)]
           } else {
               return splitAtLogicalBoundaries(node)
           }
       } else {
           return standardChunk(node)
       }
   }
   ```

---

## Testing Strategy

### Test Cases

1. **Large Function Test**
   - Input: Function with 2000 chars
   - Expected: Single chunk (not split)
   - Verify: Complete function signature + body

2. **Very Large Function Test**
   - Input: Function with 6000 chars
   - Expected: Multiple chunks at logical boundaries
   - Verify: Each chunk has function signature

3. **Class Test**
   - Input: Class with 4000 chars, 5 methods
   - Expected: First chunk (header), subsequent chunks (methods)
   - Verify: Class context preserved

4. **Comment Test**
   - Input: Function with JSDoc (300 chars)
   - Expected: JSDoc included in chunk
   - Verify: Documentation present

5. **Import Test**
   - Input: File with 20 imports, 1 function
   - Expected: Imports in metadata, function in content
   - Verify: Import metadata populated

---

## Success Metrics

### Quantitative Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Functions split mid-way | 15-20% | <2% | Count split functions |
| Comments orphaned | 30-40% | <5% | Count orphaned comments |
| Import context lost | 80-90% | <10% | Count chunks without import metadata |
| Classes split | 10-15% | <5% | Count split classes |
| Context preservation score | 60% | 85% | Weighted average of above |

### Qualitative Metrics

- ✅ All functions semantically complete
- ✅ All comments associated with code
- ✅ All chunks have import context
- ✅ All decorators with targets
- ✅ No arbitrary line-based splits

---

## Rollback Plan

If intelligent chunking causes issues:

1. **Revert parser.ts changes**
2. **Keep constants at current values**
3. **Disable semantic boundary detection**
4. **Fall back to current chunking**

**Rollback Trigger:**
- Indexing performance degrades >50%
- Chunk sizes exceed embedding limits
- Search quality decreases

---

## Conclusion

This intelligent chunking strategy prioritizes semantic completeness over strict size limits. Key improvements:

1. **Never split functions/methods** (Rule 1)
2. **Keep classes together when possible** (Rule 2)
3. **Always include comments** (Rule 3)
4. **Preserve import context** (Rule 4)
5. **Include decorators with targets** (Rule 5)

**Expected Impact:**
- Context preservation: 60% → 85% (+25%)
- Broken chunks: 40% → <15% (-25%)
- Search relevance: +15-20% (from better context)

**Next Steps:**
- Task 3.3: Implement smart chunking logic in parser
- Task 3.4: Validate improvements with test cases
### Rule 3: Comment Preservation (ALWAYS INCLUDE)

**Priority:** Critical
**Applies to:** All code chunks

**Rule:**
- **Always** include preceding comments with code
- Include JSDoc/docstrings
- Include inline comments
- Include trailing comments (for closing braces)

**Rationale:**
- Comments provide semantic context
- JSDoc describes parameters, return types, behavior
- Essential for understanding code purpose

**Implementation:**
```typescript
function includeComments(node: Node, fileContent: string): string {
    const startLine = node.startPosition.row
    const endLine = node.endPosition.row

    // Look backwards for comments
    let commentStartLine = startLine
    for (let i = startLine - 1; i >= 0; i--) {
        const line = getLine(fileContent, i).trim()
        if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*') || line === '') {
            commentStartLine = i
        } else {
            break
        }
    }

    // Extract code with comments
    return extractLines(fileContent, commentStartLine, endLine)
}
```

---

### Rule 4: Import Context (PRESERVE RELEVANT IMPORTS)

**Priority:** High
**Applies to:** All code chunks

**Rule:**
- **Option A (Recommended):** Include all file imports as metadata in every chunk
- **Option B:** Include only imports used in chunk (requires symbol analysis)
- **Option C:** Include all imports in chunk content (increases size)

**Rationale:**
- Imports provide type and dependency context
- Essential for understanding code behavior
- Metadata approach keeps chunk size manageable

**Implementation (Option A - Metadata):**
```typescript
interface CodeBlock {
    // ... existing fields
    imports?: ImportInfo[]  // Already added in Phase 2
}

function createChunkWithImports(node: Node, fileImports: ImportInfo[]): CodeBlock {
    return {
        // ... other fields
        imports: fileImports,  // Include all file imports as metadata
    }
}
```

**Implementation (Option B - Relevant Imports):**
```typescript
function getRelevantImports(node: Node, fileImports: ImportInfo[]): ImportInfo[] {
    const usedSymbols = extractUsedSymbols(node)
    return fileImports.filter(imp =>
        imp.symbols.some(sym => usedSymbols.has(sym))
    )
}
```

**Recommendation:** Use Option A (metadata) for simplicity and completeness.

---

### Rule 5: Decorator Preservation (ALWAYS INCLUDE WITH TARGET)

**Priority:** High
**Applies to:** Decorated classes, methods, properties

**Rule:**
- **Always** include decorators with their targets
- Class decorators with class
- Method decorators with method
- Property decorators with property

**Rationale:**
- Decorators modify behavior
- Framework-specific context (Angular, NestJS, etc.)
- Essential for understanding code purpose

**Implementation:**
```typescript
function includeDecorators(node: Node): Node {
    // Tree-sitter includes decorators as part of the node
    // Ensure we don't strip them during chunking
    return node  // Decorators are already part of the AST node
}
```

**Note:** Tree-sitter already includes decorators in the node, so this is mostly about not stripping them.

---


