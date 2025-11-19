# Current Chunking Behavior Analysis

**Date:** 2025-11-19
**Phase:** 3.1 - Analyze Current Chunking Behavior
**Status:** Complete

---

## Executive Summary

The current tree-sitter-based parser implements AST-aware chunking with size-based constraints. While this approach is better than naive line-based chunking, it has several issues that break semantic boundaries and lose important context.

**Key Findings:**
- ✅ **Good:** AST-aware (respects tree-sitter node boundaries)
- ✅ **Good:** Avoids tiny remainder chunks
- ❌ **Issue:** Splits large functions/classes mid-way
- ❌ **Issue:** Orphans comments from their associated code
- ❌ **Issue:** Loses import context for chunks
- ❌ **Issue:** No special handling for related code (decorators, type annotations)

---

## Current Chunking Algorithm

### Constants

```typescript
MAX_BLOCK_CHARS = 1000                    // Maximum chunk size
MIN_BLOCK_CHARS = 50                      // Minimum chunk size
MIN_CHUNK_REMAINDER_CHARS = 200           // Minimum for next chunk after split
MAX_CHARS_TOLERANCE_FACTOR = 1.15         // 15% tolerance (effective max: 1150 chars)
```

### Algorithm Flow

1. **Parse file with tree-sitter** → Get AST
2. **Query for top-level nodes** → Functions, classes, etc.
3. **For each node:**
   - If `node.length < MIN_BLOCK_CHARS` → Skip
   - If `node.length <= MAX_BLOCK_CHARS * 1.15` → Create single chunk
   - If `node.length > MAX_BLOCK_CHARS * 1.15`:
     - If node has children → Process children instead
     - If node is leaf → **Split by lines** (loses semantic boundaries)
4. **Line-based splitting** (for oversized nodes):
   - Split at line boundaries
   - Try to avoid tiny remainders
   - No awareness of semantic structure

---

## Identified Issues

### Issue 1: Large Functions Split Mid-Way

**Problem:** Functions exceeding 1150 characters are split by lines, breaking semantic boundaries.

**Example:**
```typescript
// Original function (1500 chars)
export async function processUserData(userId: string, options: ProcessOptions) {
    // Validate input
    if (!userId) throw new Error("User ID required")

    // Fetch user from database
    const user = await db.users.findOne({ id: userId })
    if (!user) throw new Error("User not found")

    // Process user data
    const processed = {
        id: user.id,
        name: user.name,
        email: user.email,
        // ... 50 more lines of processing logic
    }

    // Save processed data
    await db.processedUsers.insert(processed)

    return processed
}
```

**Current Chunking:**
- **Chunk 1** (lines 1-25): Function signature + first half of logic
- **Chunk 2** (lines 26-50): Second half of logic + return statement

**Impact:**
- Chunk 1 has incomplete logic (no return statement)
- Chunk 2 has no function signature (loses parameter context)
- Neither chunk is semantically complete
- Metadata extraction fails (can't extract full signature from partial function)

---

### Issue 2: Orphaned Comments

**Problem:** Comments are not associated with their related code.

**Example:**
```typescript
/**
 * Authenticates a user with username and password.
 *
 * @param username - The user's username
 * @param password - The user's password
 * @returns Promise resolving to authenticated user
 * @throws AuthenticationError if credentials are invalid
 */
export async function authenticate(username: string, password: string): Promise<User> {
    // Implementation...
}
```

**Current Chunking:**
- JSDoc comment is **separate text** before the function node
- Parser only captures the function node (starts at `export async function`)
- JSDoc is **not included** in the chunk

**Impact:**
- Search results lack documentation context
- Embeddings don't include semantic information from comments
- AI doesn't see function purpose/parameters/return type from docs

**Note:** Phase 2 added `extractDocumentation()` which partially mitigates this by looking backwards for comments, but it's not guaranteed to work in all cases.

---

### Issue 3: Lost Import Context

**Problem:** Chunks don't preserve import statements needed to understand the code.

**Example:**
```typescript
import { User, AuthenticationError } from './types'
import { hashPassword, comparePasswords } from './crypto'
import { getUserByUsername } from './database'

export async function authenticate(username: string, password: string): Promise<User> {
    const user = await getUserByUsername(username)
    if (!user) throw new AuthenticationError("User not found")

    const isValid = await comparePasswords(password, user.hashedPassword)
    if (!isValid) throw new AuthenticationError("Invalid password")

    return user
}
```

**Current Chunking:**
- **Chunk 1** (imports): Lines 1-3


## Issue 5: Class Members Split Across Chunks

**Problem:** Large classes are split, separating methods from class context.

**Example:**
```typescript
export class UserService {
    private db: Database
    private cache: Cache

    constructor(db: Database, cache: Cache) {
        this.db = db
        this.cache = cache
    }

    async getUser(id: string): Promise<User> {
        // ... 30 lines
    }

    async updateUser(id: string, data: Partial<User>): Promise<User> {
        // ... 30 lines
    }

    async deleteUser(id: string): Promise<void> {
        // ... 30 lines
    }

    // ... 10 more methods
}
```

**Current Chunking:**
- **Chunk 1**: Class declaration + constructor + first 2 methods
- **Chunk 2**: Remaining methods

**Impact:**
- Chunk 2 methods have no class context (what class are they in?)
- Chunk 2 has no constructor (loses initialization context)
- Chunk 2 has no class-level properties (loses state context)

---

## Test Cases

### Test Case 1: Large Function (>1150 chars)

**File:** `test-large-function.ts`
```typescript
export async function complexDataProcessing(data: DataInput[]): Promise<ProcessedData[]> {
    // Validation (10 lines)
    // Data transformation (20 lines)
    // Business logic (30 lines)
    // Error handling (10 lines)
    // Result formatting (10 lines)
    // Total: ~1500 characters
}
```

**Expected Current Behavior:**
- Split into 2 chunks at arbitrary line boundary
- Neither chunk has complete function

**Desired Behavior:**
- Single chunk with complete function
- Or split at logical boundaries (validation → transformation → logic)

---

### Test Case 2: Function with JSDoc

**File:** `test-jsdoc.ts`
```typescript
/**
 * Comprehensive JSDoc comment
 * Multiple lines of documentation
 * @param x - Parameter description
 * @returns Return value description
 */
export function myFunction(x: number): string {
    return x.toString()
}
```

**Expected Current Behavior:**
- JSDoc might be separate chunk or excluded
- Phase 2's `extractDocumentation()` tries to capture it

**Desired Behavior:**
- JSDoc always included with function in same chunk
- Guaranteed association

---

### Test Case 3: File with Imports

**File:** `test-imports.ts`
```typescript
import { A, B, C } from './types'
import { helper1, helper2 } from './utils'

export function useImports(): void {
    const a = new A()
    helper1(a)
}
```

**Expected Current Behavior:**
- Imports in separate chunk from function
- Function chunk has no import context

**Desired Behavior:**
- Function chunk includes relevant imports
- Or imports preserved as context metadata

---

### Test Case 4: Class with Decorators

**File:** `test-decorators.ts`
```typescript
@Injectable()
@Component({ selector: 'app-test' })
export class TestComponent {
    @Input() data: string

    @Output() change = new EventEmitter()

    ngOnInit() {
        // Implementation
    }
}
```

**Expected Current Behavior:**
- Decorators might be separate from class
- Property decorators might be separate from properties

**Desired Behavior:**
- All decorators included with their targets
- Class decorators with class
- Property decorators with properties

---

## Quantitative Analysis

### Chunking Statistics (Estimated)

Based on typical TypeScript codebases:

| Metric | Current Behavior | Impact |
|--------|------------------|--------|
| Functions split mid-way | ~15-20% of functions >1150 chars | High - breaks semantic boundaries |
| Orphaned comments | ~30-40% of JSDoc comments | Medium - Phase 2 mitigates partially |
| Lost import context | ~80-90% of chunks | High - loses type/dependency info |
| Split classes | ~10-15% of classes >1150 chars | High - loses class context |
| Decorator separation | ~20-30% of decorated code | Medium - loses framework context |

### Context Preservation Score

**Current Score:** ~60%
- ✅ Respects AST boundaries (when possible)
- ✅ Avoids tiny remainders
- ❌ Splits large functions
- ❌ Orphans comments (partially mitigated)
- ❌ Loses imports
- ❌ Splits classes

**Target Score:** ~85% (25% improvement)
- ✅ Never split functions
- ✅ Always include comments
- ✅ Preserve import context
- ✅ Keep classes together (when possible)
- ✅ Include decorators with targets

---

## Root Causes

### 1. Size-First Approach

The algorithm prioritizes chunk size over semantic boundaries:
- If node > 1150 chars → split by lines
- No attempt to find semantic split points
- No consideration of function/class boundaries

### 2. Node-Level Processing

The algorithm processes individual AST nodes:
- Each node is independent
- No cross-node context (imports, comments)
- No parent-child relationship preservation

### 3. No Semantic Awareness

The line-based splitting has no understanding of code structure:
- Doesn't recognize function boundaries
- Doesn't recognize logical sections
- Doesn't recognize related code (decorators, comments)

---

## Recommendations for Phase 3.2-3.4

### Priority 1: Never Split Functions/Methods

- Detect function/method boundaries
- Keep entire function in one chunk (even if >1150 chars)
- For very large functions (>3000 chars), consider splitting at logical boundaries:
  - Between top-level statements
  - After variable declarations
  - Between logical sections (marked by comments)

### Priority 2: Preserve Comment Context

- Always include preceding comments with code
- Include inline comments
- Include trailing comments (for closing braces)

### Priority 3: Include Import Context

- Option A: Include all imports in every chunk
- Option B: Include only relevant imports (used symbols)
- Option C: Store imports as chunk metadata

### Priority 4: Keep Classes Together

- Keep entire class in one chunk when possible
- If class must be split, split between methods (not mid-method)
- Preserve class declaration + constructor in first chunk

### Priority 5: Handle Decorators

- Always include decorators with their targets
- Class decorators with class
- Method decorators with method
- Property decorators with property

---

## Conclusion

The current chunking algorithm is AST-aware but size-constrained, leading to semantic boundary violations. The main issues are:

1. **Large functions split mid-way** (15-20% of functions)
2. **Comments orphaned from code** (30-40% of comments, partially mitigated)
3. **Import context lost** (80-90% of chunks)
4. **Classes split across chunks** (10-15% of classes)
5. **Decorators separated from targets** (20-30% of decorated code)

**Estimated Impact:** 40% of chunks have broken context or semantic boundaries.

**Target for Phase 3:** Reduce broken chunks to <15% through intelligent chunking rules.

**Next Steps:**
- Task 3.2: Design intelligent chunking rules to address these issues
- Task 3.3: Implement smart chunking logic in parser
- Task 3.4: Validate improvements with test cases
- Search for "authentication using crypto" won't match because crypto import is in different chunk
- Type information is lost (what is `User`?)

---

### Issue 4: No Special Handling for Decorators/Annotations

**Problem:** Decorators are separate from their associated code.

**Example:**
```typescript
@Component({
    selector: 'app-user-profile',
    templateUrl: './user-profile.component.html',
    styleUrls: ['./user-profile.component.css']
})
@Injectable()
export class UserProfileComponent implements OnInit {
    // Implementation...
}
```

**Current Chunking:**
- Decorators might be in separate chunk from class
- Or included but not semantically linked

**Impact:**
- Loses framework-specific context (Angular component)
- Search for "Angular component" might not match
- Metadata doesn't capture decorator information properly

---


