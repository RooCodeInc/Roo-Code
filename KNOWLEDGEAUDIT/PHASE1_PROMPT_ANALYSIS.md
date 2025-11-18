# Phase 1: System Prompt Analysis

**Document Version:** 1.0  
**Created:** 2025-11-18  
**Last Updated:** 2025-11-18  
**Status:** 🔄 In Progress

---

## Executive Summary

This document provides a comprehensive analysis of all system prompts currently used in Roo Code's codebase indexing and search system. The analysis identifies strengths, weaknesses, and opportunities for improvement to enhance code understanding and search relevance.

**Key Findings:**

1. **Current Prompts Are Generic** - Prompts focus on semantic search but lack code-specific context
2. **Missing Code Structure Awareness** - No information about symbols, relationships, or code patterns
3. **Limited Metadata Utilization** - Only basic metadata (file path, lines) is exposed to the AI
4. **No Query Guidance** - No examples or patterns for effective code search queries
5. **High Improvement Potential** - Significant opportunity for 10-20% relevance improvement

**Recommendation:** Enhance prompts with code structure awareness, symbol information, and query patterns to dramatically improve search effectiveness.

---

## Table of Contents

1. [System Prompt Locations](#system-prompt-locations)
2. [Current Prompt Analysis](#current-prompt-analysis)
3. [Metadata Analysis](#metadata-analysis)
4. [Strengths and Weaknesses](#strengths-and-weaknesses)
5. [Improvement Opportunities](#improvement-opportunities)
6. [Recommendations](#recommendations)

---

## System Prompt Locations

### Primary System Prompt Files

#### 1. **`src/core/prompts/system.ts`**

**Purpose:** Main system prompt generation  
**Function:** `SYSTEM_PROMPT()` - Generates complete system prompt  
**Lines:** 242 lines

**Key Components:**
- Role definition (from mode configuration)
- Markdown formatting section
- Tool use section (tool catalog)
- Tool use guidelines
- MCP servers section
- Capabilities section
- Modes section
- Rules section
- System info section
- Objective section
- Custom instructions

**Code Index Integration:**
```typescript
const codeIndexManager = CodeIndexManager.getInstance(context, cwd)

// Used in:
- getToolUseGuidelinesSection(codeIndexManager, effectiveProtocol)
- getCapabilitiesSection(..., codeIndexManager, ...)
- getRulesSection(..., codeIndexManager, ...)
- getObjectiveSection(codeIndexManager, experiments)
```

#### 2. **`src/core/prompts/tools/codebase-search.ts`**

**Purpose:** Codebase search tool description  
**Function:** `getCodebaseSearchDescription()` - Describes codebase_search tool  
**Lines:** 24 lines

**Current Description:**
```
Find files most relevant to the search query using semantic search. 
Searches based on meaning rather than exact text matches. 
By default searches entire workspace. 
Reuse the user's exact wording unless there's a clear reason not to - 
their phrasing often helps semantic search. 
Queries MUST be in English (translate if needed).
```

**Parameters:**
- `query` (required) - The search query
- `path` (optional) - Limit search to specific subdirectory

#### 3. **`src/core/prompts/sections/tool-use-guidelines.ts`**

**Purpose:** Guidelines for using tools effectively  
**Function:** `getToolUseGuidelinesSection()` - Generates tool use guidelines  
**Lines:** 69 lines

**Code Index Specific Guideline:**
```
CRITICAL: For ANY exploration of code you haven't examined yet in this conversation, 
you MUST use the `codebase_search` tool FIRST before any other search or file 
exploration tools. This applies throughout the entire conversation, not just at 
the beginning. The codebase_search tool uses semantic search to find relevant code 
based on meaning rather than just keywords, making it far more effective than 
regex-based search_files for understanding implementations.
```

#### 4. **`src/core/prompts/sections/objective.ts`**

**Purpose:** Defines the AI's objective and workflow  
**Function:** `getObjectiveSection()` - Generates objective section  
**Lines:** 29 lines

**Code Index Specific Instruction:**
```
First, for ANY exploration of code you haven't examined yet in this conversation, 
you MUST use the `codebase_search` tool to search for relevant code based on the 
task's intent BEFORE using any other search or file exploration tools.
```

### Supporting Files

#### 5. **`src/core/tools/CodebaseSearchTool.ts`**

**Purpose:** Implementation of codebase search tool  
**Lines:** 159 lines

**Result Format:**
```typescript
{
  query: string,
  results: [{
    filePath: string,
    score: number,
    startLine: number,
    endLine: number,
    codeChunk: string
  }]
}
```

**Output Format:**
```
Query: {query}
Results:

File path: {relativePath}
Score: {score}
Lines: {startLine}-{endLine}
Code Chunk: {codeChunk}
```

#### 6. **`src/services/code-index/search-service.ts`**

**Purpose:** Search service implementation  
**Lines:** 75 lines

**Process:**
1. Generate embedding for query
2. Search vector store
3. Return results with scores

---

## Current Prompt Analysis

### 1. Codebase Search Tool Description

**Location:** `src/core/prompts/tools/codebase-search.ts`

**Current Content:**

```typescript
export function getCodebaseSearchDescription(args: ToolArgs): string {
	return `## codebase_search
Description: Find files most relevant to the search query using semantic search. Searches based on meaning rather than exact text matches. By default searches entire workspace. Reuse the user's exact wording unless there's a clear reason not to - their phrasing often helps semantic search. Queries MUST be in English (translate if needed).

Parameters:
- query: (required) The search query. Reuse the user's exact wording/question format unless there's a clear reason not to.
- path: (optional) Limit search to specific subdirectory (relative to the current workspace directory ${args.cwd}). Leave empty for entire workspace.

Usage:
<codebase_search>
<query>Your natural language query here</query>
<path>Optional subdirectory path</path>
</codebase_search>

Example:
<codebase_search>
<query>User login and password hashing</query>
<path>src/auth</path>
</codebase_search>
`
}
```

**Analysis:**

✅ **Strengths:**
- Clear description of semantic search capability
- Emphasizes reusing user's exact wording
- Provides concrete example
- Specifies English requirement

❌ **Weaknesses:**
- No guidance on what makes a good code search query
- Doesn't explain what "semantic search" means in code context
- No examples of different query types (symbol search, concept search, etc.)
- Doesn't mention what metadata is available in results
- No guidance on when to use vs. other search tools

🎯 **Improvement Opportunities:**
- Add examples of effective query patterns
- Explain code-specific semantic search capabilities
- Provide guidance on query formulation for different use cases
- Mention available metadata in results

### 2. Tool Use Guidelines Section

**Location:** `src/core/prompts/sections/tool-use-guidelines.ts`

**Current Content (Code Index Specific):**

```typescript
if (isCodebaseSearchAvailable) {
	guidelinesList.push(
		`${itemNumber++}. **CRITICAL: For ANY exploration of code you haven't examined yet in this conversation, you MUST use the \`codebase_search\` tool FIRST before any other search or file exploration tools.** This applies throughout the entire conversation, not just at the beginning. The codebase_search tool uses semantic search to find relevant code based on meaning rather than just keywords, making it far more effective than regex-based search_files for understanding implementations. Even if you've already explored some code, any new area of exploration requires codebase_search first.`,
	)
	guidelinesList.push(
		`${itemNumber++}. Choose the most appropriate tool based on the task and the tool descriptions provided. After using codebase_search for initial exploration of any new code area, you may then use more specific tools like search_files (for regex patterns), list_files, or read_file for detailed examination.`,
	)
}
```

**Analysis:**

✅ **Strengths:**
- Strong emphasis on using codebase_search first
- Explains advantage over regex-based search
- Provides workflow guidance (codebase_search → specific tools)

❌ **Weaknesses:**
- Doesn't explain HOW to use codebase_search effectively
- No guidance on query formulation
- Doesn't mention what to do with search results
- No examples of good vs. bad queries

🎯 **Improvement Opportunities:**
- Add query formulation guidance
- Provide examples of effective search patterns
- Explain how to interpret and use search results
- Add guidance on iterative search refinement

### 3. Objective Section

**Location:** `src/core/prompts/sections/objective.ts`

**Current Content (Code Index Specific):**

```typescript
const codebaseSearchInstruction = isCodebaseSearchAvailable
	? "First, for ANY exploration of code you haven't examined yet in this conversation, you MUST use the `codebase_search` tool to search for relevant code based on the task's intent BEFORE using any other search or file exploration tools. This applies throughout the entire task, not just at the beginning - whenever you need to explore a new area of code, codebase_search must come first. Then, "
	: "First, "
```

**Analysis:**

✅ **Strengths:**
- Reinforces codebase_search priority
- Emphasizes continuous use throughout task

❌ **Weaknesses:**
- Very brief, lacks detail
- No guidance on effective usage
- Doesn't explain the value proposition

🎯 **Improvement Opportunities:**
- Expand with usage examples
- Add query pattern guidance
- Explain expected outcomes

---

## Metadata Analysis

### Current Metadata Available

**From `CodeBlock` Interface:**
```typescript
interface CodeBlock {
	file_path: string
	identifier: string | null    // Function/class name (if available)
	type: string                  // Node type from tree-sitter
	start_line: number
	end_line: number
	content: string
	fileHash: string
	segmentHash: string
}
```

**Stored in Vector Store Payload:**
```typescript
interface Payload {
	filePath: string
	codeChunk: string
	startLine: number
	endLine: number
	[key: string]: any  // Additional metadata can be added
}
```

**Returned to AI:**
```
File path: {relativePath}
Score: {score}
Lines: {startLine}-{endLine}
Code Chunk: {codeChunk}
```

### Metadata Gaps

**Currently Available But NOT Exposed to AI:**
- `identifier` - Function/class name
- `type` - Tree-sitter node type (function_definition, class_definition, etc.)
- `fileHash` - File content hash
- `segmentHash` - Code segment hash

**Not Currently Captured:**
- Symbol relationships (imports, exports, calls)
- Type information
- Documentation/comments
- Code complexity metrics
- Language-specific metadata
- Parent/child relationships
- Cross-file references

### Impact of Missing Metadata

❌ **Problems:**
1. AI cannot distinguish between different code constructs
2. No context about what kind of code was found
3. Cannot filter by symbol type
4. No relationship information
5. Limited ability to understand code structure

🎯 **Opportunities:**
1. Expose `identifier` and `type` in search results
2. Add symbol relationship metadata
3. Include language and framework information
4. Add code construct categorization

---

## Strengths and Weaknesses

### Overall Strengths ✅

1. **Strong Emphasis on Semantic Search**
   - Clear priority given to codebase_search
   - Repeated throughout multiple prompt sections
   - Emphasizes advantages over keyword search

2. **User Query Preservation**
   - Encourages reusing user's exact wording
   - Recognizes value of natural phrasing

3. **Clear Tool Hierarchy**
   - Establishes codebase_search as first step
   - Provides workflow guidance

4. **Concrete Examples**
   - Includes XML usage example
   - Shows practical application

### Overall Weaknesses ❌

1. **Lack of Code-Specific Guidance**
   - No examples of code search patterns
   - Doesn't explain code semantic search
   - Missing query formulation guidance

2. **Minimal Metadata Exposure**
   - Only basic information in results
   - Identifier and type not shown
   - No relationship information

3. **No Query Pattern Library**
   - No examples of effective queries
   - No anti-patterns or warnings
   - No guidance for different use cases

4. **Limited Result Interpretation Guidance**
   - Doesn't explain how to use results
   - No guidance on score interpretation
   - No iterative refinement suggestions

5. **Missing Code Structure Context**
   - No information about code organization
   - No symbol hierarchy
   - No relationship awareness

---

## Improvement Opportunities

### High Priority (Expected 10-15% Impact)

#### 1. **Enhance Codebase Search Tool Description**

**Current:** Generic semantic search description
**Proposed:** Code-aware description with examples

**Changes:**
- Add code-specific query examples
- Explain different query types (symbol, concept, implementation)
- Provide query formulation patterns
- Show expected result formats with metadata

**Example Addition:**
```
Query Types and Examples:
1. Symbol Search: "UserService class" or "authenticate function"
2. Concept Search: "user authentication logic" or "database connection pooling"
3. Implementation Search: "how to hash passwords" or "JWT token validation"
4. Pattern Search: "error handling in API routes" or "React hooks usage"

Results include:
- File path and location (lines)
- Relevance score (0-1, higher is better)
- Code chunk with context
- Symbol information (function/class name, type)
```

#### 2. **Expose Additional Metadata in Results**

**Current:** Only file path, lines, score, code chunk
**Proposed:** Include identifier, type, and language

**Changes:**
```typescript
// Current output
File path: src/auth/UserService.ts
Score: 0.85
Lines: 45-67
Code Chunk: ...

// Proposed output
File path: src/auth/UserService.ts
Symbol: UserService
Type: class_definition
Language: TypeScript
Score: 0.85
Lines: 45-67
Code Chunk: ...
```

**Impact:** AI can better understand what kind of code was found

#### 3. **Add Query Pattern Library to Guidelines**

**Proposed Addition to Tool Use Guidelines:**

```
Effective Codebase Search Patterns:

For finding specific symbols:
- "ClassName class definition"
- "functionName function implementation"
- "CONSTANT_NAME constant declaration"

For understanding concepts:
- "how authentication works"
- "database connection management"
- "error handling strategy"

For finding patterns:
- "React component with hooks"
- "Express middleware for validation"
- "async/await error handling"

For exploring relationships:
- "files that import UserService"
- "callers of authenticate function"
- "implementations of Repository interface"
```

### Medium Priority (Expected 3-5% Impact)

#### 4. **Enhance Objective Section**

**Current:** Brief mention of codebase_search
**Proposed:** Detailed workflow with examples

**Addition:**
```
When exploring code:
1. Start with codebase_search using natural language queries
2. Review results to identify relevant files and symbols
3. Use read_file to examine specific implementations
4. Use search_files for exact pattern matching if needed
5. Iterate with refined queries based on findings
```

#### 5. **Add Result Interpretation Guidance**

**Proposed Addition:**
```
Interpreting Codebase Search Results:
- Scores > 0.8: Highly relevant, likely contains what you're looking for
- Scores 0.6-0.8: Relevant, worth examining
- Scores < 0.6: May be tangentially related
- Multiple high-scoring results: Concept is implemented in multiple places
- No results: Try rephrasing query or broadening search
```

### Low Priority (Expected 1-2% Impact)

#### 6. **Add Anti-Patterns and Warnings**

**Proposed Addition:**
```
Avoid These Query Patterns:
❌ Too vague: "code" or "function"
❌ Too specific: "line 45 in UserService.ts" (use read_file instead)
❌ Regex patterns: "user.*service" (use search_files instead)
❌ File names only: "UserService.ts" (use list_files instead)

✅ Good Queries:
✓ Specific concepts: "user authentication with JWT"
✓ Implementation questions: "how to validate email addresses"
✓ Pattern searches: "error handling in async functions"
```

---

## Recommendations

### Immediate Actions (Phase 1, Tasks 1.2-1.5)

1. **Task 1.2: Update Tool Use Guidelines**
   - Add query pattern library
   - Include result interpretation guidance
   - Add anti-patterns section
   - **Expected Impact:** 5-8% improvement

2. **Task 1.3: Update Capabilities Section**
   - Enhance codebase_search description
   - Add code-specific examples
   - Explain metadata in results
   - **Expected Impact:** 3-5% improvement

3. **Task 1.4: Update Objective Section**
   - Add detailed workflow guidance
   - Include iterative refinement process
   - **Expected Impact:** 2-3% improvement

4. **Task 1.5: Update Rules Section**
   - Add code search best practices
   - Include query formulation rules
   - **Expected Impact:** 1-2% improvement

5. **Task 1.6: Expose Additional Metadata**
   - Modify CodebaseSearchTool output format
   - Include identifier, type, language
   - **Expected Impact:** 3-5% improvement

**Total Expected Impact:** 14-23% improvement in search effectiveness

### Future Enhancements (Phase 2+)

1. **Phase 2: Enhanced Metadata Extraction**
   - Extract symbol relationships
   - Capture type information
   - Add documentation context

2. **Phase 3: BM25 Keyword Search**
   - Complement semantic search
   - Better exact symbol matching

3. **Phase 4: Neo4j Graph Relationships**
   - Enable relationship queries
   - Support "find callers" type searches

---

## Success Metrics

### Measurement Approach

**Before Phase 1:**
- Baseline search effectiveness (from Phase 0 metrics)
- Query success rate
- Result relevance scores

**After Phase 1:**
- Improved search effectiveness
- Higher query success rate
- Better result relevance
- Reduced need for query refinement

### Target Metrics

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Search Effectiveness | TBD | +10-20% | Manual evaluation |
| Query Success Rate | TBD | +15% | Successful first query |
| Result Relevance | TBD | +10% | Precision@5 |
| Query Refinement | TBD | -20% | Fewer iterations |

---

## Conclusion

The current system prompts provide a solid foundation for codebase search but lack code-specific guidance and metadata exposure. By enhancing prompts with:

1. **Code-aware query patterns**
2. **Additional metadata in results**
3. **Result interpretation guidance**
4. **Anti-patterns and best practices**

We can achieve the target 10-20% improvement in search effectiveness with relatively minimal changes to the existing system.

**Next Steps:**
1. ✅ Complete Task 1.1: Analyze Current Prompts (this document)
2. ⏭️ Begin Task 1.2: Update Tool Use Guidelines
3. ⏭️ Continue with Tasks 1.3-1.6
4. 📊 Measure impact and iterate

---

**Document Status:** ✅ Complete
**Ready for:** Task 1.2 - Update Tool Use Guidelines

