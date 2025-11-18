# Roo Code Index: World-Class Implementation Roadmap

**Version:** 1.0  
**Last Updated:** 2025-11-18  
**Status:** Planning Phase

---

## Executive Summary

This document provides a comprehensive, step-by-step implementation roadmap to transform Roo's codebase index from its current basic implementation into a world-class context engine that rivals Augment Code's capabilities.

**Current State:** Qdrant vector search with tree-sitter parsing  
**Target State:** Hybrid search (Vector + Graph + Keyword) with LSP integration, intelligent query routing, and advanced ranking

**Estimated Timeline:** 8-12 weeks (8 phases)  
**Estimated Effort:** ~200-300 hours total

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Target State Vision](#target-state-vision)
3. [Implementation Phases](#implementation-phases)
4. [Technical Specifications](#technical-specifications)
5. [Testing Strategy](#testing-strategy)
6. [Migration & Rollback](#migration--rollback)
7. [Success Metrics](#success-metrics)

---

## Current State Analysis

### What Roo Has Today

**✅ Strengths:**
- Qdrant vector database (local + cloud support)
- Tree-sitter parsing for 30+ languages
- Incremental indexing with hash-based change detection
- Real-time file watching and updates
- Multiple embedding providers (OpenAI, Ollama, Gemini, etc.)
- Singleton pattern for workspace-specific instances

**❌ Gaps:**
- No graph database for structural relationships
- No keyword/BM25 search (only semantic)
- No LSP integration (reinventing the wheel with tree-sitter)
- Limited metadata (just file path, lines, content)
- No query intelligence or routing
- Generic system prompts (AI doesn't know how to use the index effectively)
- No test-to-code mapping
- No pattern detection
- No context-aware ranking
- No result explanations

### Current Architecture

```
CodeIndexManager (Singleton)
    ↓
CodeIndexOrchestrator
    ↓
    ├─→ CodeIndexScanner (Initial scan)
    ├─→ CodeIndexFileWatcher (Real-time updates)
    ├─→ CodeIndexParser (Tree-sitter)
    ├─→ CodeIndexEmbedder (Multiple providers)
    └─→ QdrantVectorStore (Vector storage)
```

### Current Files

**Core Implementation:**
- `src/services/code-index/manager.ts` - Entry point, singleton
- `src/services/code-index/orchestrator.ts` - Coordinates indexing
- `src/services/code-index/scanner.ts` - Initial file scanning
- `src/services/code-index/file-watcher.ts` - Real-time updates
- `src/services/code-index/parser.ts` - Tree-sitter parsing
- `src/services/code-index/embedder.ts` - Embedding generation
- `src/services/code-index/vector-store.ts` - Qdrant interface
- `src/services/code-index/search-service.ts` - Search implementation

**System Prompts:**
- `src/core/prompts/system.ts` - Main prompt assembly
- `src/core/prompts/sections/tool-use-guidelines.ts` - Tool usage guidance
- `src/core/prompts/sections/capabilities.ts` - Capability descriptions
- `src/core/prompts/sections/objective.ts` - Task workflow
- `src/core/prompts/sections/rules.ts` - Rules and constraints

**Tools:**
- `src/core/tools/CodebaseSearchTool.ts` - Search tool interface
- `src/core/tools/ListCodeDefinitionNamesTool.ts` - Tree-sitter definitions

---

## Target State Vision

### What We're Building

**🎯 World-Class Codebase Index with:**

1. **Hybrid Search Architecture**
   - Vector search (Qdrant) for semantic similarity
   - Graph search (Neo4j) for structural relationships
   - Keyword search (BM25) for exact matches
   - Intelligent query routing

2. **LSP Integration**
   - Leverage VSCode's Language Server Protocol
   - Accurate type information
   - Instant reference finding
   - Call hierarchy traversal

3. **Enhanced Metadata**
   - Symbol names, types, visibility
   - Import/export relationships
   - File-level metadata
   - Test-to-code mappings
   - Detected patterns

4. **Intelligent Query Processing**
   - Query understanding and classification
   - Automatic query expansion
   - Context-aware ranking
   - Result diversity and deduplication

5. **Advanced Features**
   - Pattern detection (design patterns, conventions)
   - Test-to-code mapping
   - Multi-factor ranking
   - Result explanations
   - Search analytics

6. **Enhanced System Prompts**
   - Specific use cases and examples
   - Multi-search strategies
   - Verification workflows
   - Query pattern library

### Target Architecture

```
CodeIndexManager
    ↓
UnifiedSearchOrchestrator
    ↓
    ├─→ QueryAnalyzer (Understand intent)
    ├─→ QueryExpander (Expand terms)
    ├─→ SearchRouter (Route to backends)
    │   ├─→ VectorSearch (Qdrant)
    │   ├─→ GraphSearch (Neo4j)
    │   ├─→ KeywordSearch (BM25)
    │   └─→ LSPSearch (VSCode)
    ├─→ ResultMerger (Combine results)
    ├─→ ResultRanker (Multi-factor scoring)
    └─→ ResultExplainer (Why these results?)

Indexing Pipeline:
    ↓
    ├─→ TreeSitterParser (Code structure)
    ├─→ LSPEnricher (Type info, references)
    ├─→ MetadataExtractor (Symbols, imports)
    ├─→ PatternDetector (Patterns, conventions)
    ├─→ TestMapper (Test-to-code links)
    ├─→ VectorIndexer (Qdrant)
    ├─→ GraphIndexer (Neo4j)
    └─→ KeywordIndexer (BM25)
```

---

## Implementation Phases

### Overview

| Phase | Name | Duration | Complexity | Dependencies |
|-------|------|----------|------------|--------------|
| 0 | Foundation & Setup | 1 week | Low | None |
| 1 | System Prompt Improvements | 1 week | Low | Phase 0 |
| 2 | Enhanced Metadata | 2 weeks | Medium | Phase 0 |
| 3 | BM25 Keyword Search | 1-2 weeks | Medium | Phase 2 |
| 4 | Neo4j Integration | 2-3 weeks | High | Phase 2 |
| 5 | LSP Integration | 1-2 weeks | Medium | Phase 0 |
| 6 | Hybrid Search & Routing | 2 weeks | High | Phases 3,4,5 |
| 7 | Advanced Features | 2-3 weeks | High | Phase 6 |
| 8 | Performance & Polish | 1-2 weeks | Medium | Phase 7 |

**Total Estimated Duration:** 8-12 weeks

---

## Phase 0: Foundation & Setup

**Duration:** 1 week
**Complexity:** Low
**Prerequisites:** None

### Overview

Set up development environment, understand current implementation deeply, create test fixtures, and establish baseline metrics.

### Tasks

#### Task 0.1: Deep Code Analysis
- [ ] **Review all current code-index files**
  - **Files to review:**
    - `src/services/code-index/*.ts` (all files)
    - `src/core/tools/CodebaseSearchTool.ts`
    - `src/core/prompts/sections/*.ts`
  - **Complexity:** Low
  - **Acceptance Criteria:**
    - Document all current data flows
    - Identify extension points for new features
    - Map all configuration options
  - **Deliverable:** `KNOWLEDGEAUDIT/CURRENT_IMPLEMENTATION_DEEP_DIVE.md`

#### Task 0.2: Set Up Test Workspace
- [ ] **Create comprehensive test fixtures**
  - **Files to create:**
    - `src/services/code-index/__tests__/fixtures/sample-workspace/`
      - Sample TypeScript files with various patterns
      - Sample Python files
      - Sample test files
      - Sample configuration files
  - **Complexity:** Low
  - **Acceptance Criteria:**
    - At least 20 sample files covering common patterns
    - Include edge cases (large files, complex imports, etc.)
    - Include test files that map to code files
  - **Deliverable:** Test fixture directory

#### Task 0.3: Establish Baseline Metrics
- [ ] **Measure current performance**
  - **Files to create:**
    - `src/services/code-index/__tests__/performance-baseline.spec.ts`
  - **Complexity:** Low
  - **Metrics to capture:**
    - Indexing speed (files/second)
    - Search latency (ms)
    - Memory usage
    - Index size
  - **Acceptance Criteria:**
    - Automated benchmark suite
    - Baseline metrics documented
  - **Deliverable:** Performance baseline report

#### Task 0.4: Create Development Branch
- [ ] **Set up git workflow**
  - **Commands:**
    ```bash
    git checkout -b feature/world-class-index
    git push -u origin feature/world-class-index
    ```
  - **Complexity:** Low
  - **Acceptance Criteria:**
    - Branch created and pushed
    - CI/CD still passing
  - **Deliverable:** Feature branch

### Testing
- Run existing test suite: `npm test`
- Verify all tests pass before proceeding

### Rollback
- Delete feature branch if needed: `git branch -D feature/world-class-index`

---

## Phase 1: System Prompt Improvements

**Duration:** 1 week
**Complexity:** Low
**Prerequisites:** Phase 0
**Expected Impact:** 🔥🔥🔥 (Highest ROI!)

### Overview

Enhance system prompts to teach Roo how to use the codebase index effectively. This is the highest-impact, lowest-effort improvement.

### Tasks

#### Task 1.1: Update Tool Use Guidelines
- [ ] **Enhance codebase_search guidance**
  - **File to modify:** `src/core/prompts/sections/tool-use-guidelines.ts`
  - **Complexity:** Low
  - **Changes:**
    ```typescript
    // Add specific guidance on WHEN to use codebase_search
    const codebaseSearchGuidance = `
    ## When to Use codebase_search

    Use codebase_search in these situations:
    1. **Before reading files** - Search first to find relevant files
    2. **Before making changes** - Verify you understand the codebase
    3. **After making changes** - Find code that might be affected
    4. **When exploring** - Build understanding of unfamiliar code
    5. **For verification** - Confirm patterns and conventions

    ## How to Craft Good Queries

    **Natural Language Queries:**
    - "authentication implementation"
    - "how are errors handled"
    - "database connection setup"

    **Symbol-Specific Queries:**
    - "UserService class"
    - "login function"
    - "API endpoints"

    **Pattern Queries:**
    - "all controllers"
    - "test files for authentication"
    - "error handling patterns"

    ## Multi-Search Strategy

    Use 2-3 searches to build understanding:
    1. **Broad search** - "authentication" (get overview)
    2. **Narrow search** - "login function" (find specific code)
    3. **Verification search** - "all callers of login" (understand usage)
    `
  - **Acceptance Criteria:**
    - Specific examples added
    - Multi-search strategy documented
    - When/how guidance clear
  - **Deliverable:** Updated tool-use-guidelines.ts

#### Task 1.2: Update Capabilities Section
- [ ] **Add codebase_search examples**
  - **File to modify:** `src/core/prompts/sections/capabilities.ts`
  - **Complexity:** Low
  - **Changes:**
    ```typescript
    // Add example queries to capabilities description
    const codebaseSearchCapability = `
    - **codebase_search**: Semantic search across the entire codebase
      - Pre-built index of all code files
      - Understands code semantics, not just keywords
      - Examples:
        * "authentication implementation" → finds auth code
        * "UserService" → finds class and usages
        * "error handling patterns" → finds error handling code
      - Use BEFORE reading files to find what you need
      - Use MULTIPLE searches to build understanding
    `
  - **Acceptance Criteria:**
    - Concrete examples added
    - Emphasizes search-first workflow
  - **Deliverable:** Updated capabilities.ts

#### Task 1.3: Update Objective Section
- [ ] **Add search workflow to task execution**
  - **File to modify:** `src/core/prompts/sections/objective.ts`
  - **Complexity:** Low
  - **Changes:**
    ```typescript
    // Add search step to workflow
    const taskWorkflow = `
    1. **Search & Understand** (CRITICAL)
       - Use codebase_search to find relevant code
       - Use 2-3 searches: broad → narrow → specific
       - Build mental model before reading files

    2. **Read & Analyze**
       - Read files found by search
       - Understand patterns and conventions

    3. **Plan Changes**
       - Design changes that follow existing patterns
       - Consider impact on other code

    4. **Verify Impact** (CRITICAL)
       - Search for code that might be affected
       - Check for callers, importers, similar patterns

    5. **Make Changes**
       - Implement following discovered patterns

    6. **Verify Changes**
       - Search again to confirm no breakage
    `
  - **Acceptance Criteria:**
    - Search integrated into workflow
    - Verification steps added
  - **Deliverable:** Updated objective.ts

#### Task 1.4: Update Rules Section
- [ ] **Add verification workflow rules**
  - **File to modify:** `src/core/prompts/sections/rules.ts`
  - **Complexity:** Low
  - **Changes:**
    ```typescript
    // Add search-before-edit rule
    const searchRules = `
    - **ALWAYS search before editing:**
      1. Search for the code you want to change
      2. Search for similar patterns in the codebase
      3. Search for code that might be affected
      4. Only then make changes

    - **ALWAYS verify after editing:**
      1. Search for callers of changed functions
      2. Search for importers of changed modules
      3. Search for similar code that might need updates
    `
  - **Acceptance Criteria:**
    - Search-before-edit rule added
    - Verification workflow documented
  - **Deliverable:** Updated rules.ts

#### Task 1.5: Create Query Pattern Library
- [ ] **Add query pattern examples to tool description**
  - **File to modify:** `src/core/prompts/tools/codebase-search.ts`
  - **Complexity:** Low
  - **Changes:**
    ```typescript
    // Add query pattern library
    const queryPatterns = `
    ## Query Pattern Library

    **Finding Implementations:**
    - "authentication implementation"
    - "database connection setup"
    - "API endpoint handlers"

    **Finding Usages:**
    - "all callers of login function"
    - "where is UserService used"
    - "imports of auth module"

    **Finding Tests:**
    - "tests for authentication"
    - "test files for UserService"
    - "integration tests"

    **Finding Patterns:**
    - "error handling patterns"
    - "validation logic"
    - "all controllers"

    **Finding Examples:**
    - "example of API endpoint"
    - "how to use UserService"
    - "similar to login function"
    `
  - **Acceptance Criteria:**
    - 20+ query pattern examples
    - Organized by use case
  - **Deliverable:** Updated codebase-search.ts

### Testing

**Manual Testing:**
1. Start Roo with updated prompts
2. Ask: "How is authentication implemented?"
3. Verify Roo uses codebase_search FIRST
4. Verify Roo uses multiple searches
5. Verify Roo follows discovered patterns

**Automated Testing:**
```typescript
// src/core/prompts/__tests__/system-prompts.spec.ts
describe('System Prompts', () => {
  it('should include codebase_search guidance', () => {
    const prompts = generateSystemPrompts()
    expect(prompts).toContain('Use codebase_search in these situations')
    expect(prompts).toContain('Multi-Search Strategy')
  })

  it('should include query pattern library', () => {
    const prompts = generateSystemPrompts()
    expect(prompts).toContain('Query Pattern Library')
  })
})
```

### Success Metrics

**Before:**
- Roo uses codebase_search ~30% of the time
- Usually only 1 search per task
- Often reads files before searching

**After:**
- Roo uses codebase_search ~80% of the time
- Average 2-3 searches per task
- Always searches before reading files

### Rollback

```bash
git checkout main -- src/core/prompts/sections/
git commit -m "Rollback: Revert prompt improvements"
```

---

## Phase 2: Enhanced Metadata & Multi-Level Indexing

**Duration:** 2 weeks
**Complexity:** Medium
**Prerequisites:** Phase 0
**Expected Impact:** 🔥🔥 (High)

### Overview

Enhance the metadata stored with each code segment to enable richer search and better ranking. Add symbol information, imports/exports, file-level metadata, and multi-level indexing.

### Tasks

#### Task 2.1: Define Enhanced Metadata Schema
- [ ] **Create comprehensive metadata types**
  - **File to create:** `src/services/code-index/types/metadata.ts`
  - **Complexity:** Low
  - **Schema:**
    ```typescript
    export interface SymbolMetadata {
      name: string
      type: 'class' | 'function' | 'method' | 'variable' | 'constant' | 'interface' | 'type'
      visibility: 'public' | 'private' | 'protected' | 'internal'
      isExported: boolean
      isAsync?: boolean
      parameters?: ParameterInfo[]
      returnType?: string
      documentation?: string
    }

    export interface ParameterInfo {
      name: string
      type?: string
      optional: boolean
      defaultValue?: string
    }

    export interface ImportInfo {
      source: string  // File path or module name
      symbols: string[]  // Imported symbols
      isDefault: boolean
      isDynamic: boolean
    }

    export interface ExportInfo {
      symbol: string
      type: 'named' | 'default' | 're-export'
      source?: string  // For re-exports
    }

    export interface FileMetadata {
      language: string
      framework?: string  // React, Vue, Express, etc.
      category?: string  // component, service, controller, test, etc.
      dependencies: string[]  // External dependencies used
      exports: ExportInfo[]
      imports: ImportInfo[]
      symbols: SymbolMetadata[]
      lineCount: number
      complexity?: number  // Cyclomatic complexity
      lastModified: Date
    }

    export interface EnhancedCodeSegment {
      // Existing fields
      segmentHash: string
      filePath: string
      content: string
      startLine: number
      endLine: number
      language: string

      // New metadata fields
      symbolName?: string
      symbolType?: SymbolMetadata['type']
      symbolVisibility?: SymbolMetadata['visibility']
      isExported?: boolean
      imports?: ImportInfo[]
      exports?: ExportInfo[]
      documentation?: string

      // File-level metadata
      fileMetadata?: FileMetadata

      // Relationships (for later Neo4j integration)
      calls?: string[]  // Functions this code calls
      calledBy?: string[]  // Functions that call this code
      imports?: string[]  // Files this imports from
      importedBy?: string[]  // Files that import this
    }
    ```
  - **Acceptance Criteria:**
    - Complete type definitions
    - JSDoc documentation
    - Exported from index
  - **Deliverable:** metadata.ts with comprehensive types

#### Task 2.2: Enhance Tree-Sitter Parser
- [ ] **Extract symbol metadata from AST**
  - **File to modify:** `src/services/code-index/parser.ts`
  - **Complexity:** Medium
  - **Changes:**
    ```typescript
    import { SymbolMetadata, ImportInfo, ExportInfo } from './types/metadata'

    export class CodeIndexParser {
      async parseWithMetadata(filePath: string, content: string): Promise<ParsedSegment[]> {
        const segments = await this.parseIntoSegments(filePath, content)

        // Enhance each segment with metadata
        for (const segment of segments) {
          segment.symbolMetadata = await this.extractSymbolMetadata(segment)
          segment.imports = await this.extractImports(filePath, content)
          segment.exports = await this.extractExports(filePath, content)
        }

        return segments
      }

      private async extractSymbolMetadata(segment: ParsedSegment): Promise<SymbolMetadata | undefined> {
        // Use tree-sitter to extract symbol info
        const tree = await this.parseCode(segment.content, segment.language)
        const rootNode = tree.rootNode

        // Find symbol definition in this segment
        const symbolNode = this.findSymbolNode(rootNode, segment.startLine)
        if (!symbolNode) return undefined

        return {
          name: this.getSymbolName(symbolNode),
          type: this.getSymbolType(symbolNode),
          visibility: this.getVisibility(symbolNode),
          isExported: this.isExported(symbolNode),
          isAsync: this.isAsync(symbolNode),
          parameters: this.extractParameters(symbolNode),
          returnType: this.extractReturnType(symbolNode),
          documentation: this.extractDocumentation(symbolNode)
        }
      }

      private async extractImports(filePath: string, content: string): Promise<ImportInfo[]> {
        // Parse import statements
        const tree = await this.parseCode(content, this.getLanguage(filePath))
        const imports: ImportInfo[] = []

        // Query for import statements
        const query = this.getImportQuery(this.getLanguage(filePath))
        const matches = query.matches(tree.rootNode)

        for (const match of matches) {
          imports.push({
            source: this.getImportSource(match),
            symbols: this.getImportedSymbols(match),
            isDefault: this.isDefaultImport(match),
            isDynamic: this.isDynamicImport(match)
          })
        }

        return imports
      }

      private async extractExports(filePath: string, content: string): Promise<ExportInfo[]> {
        // Similar to extractImports but for exports
        // ...
      }
    }
    ```
  - **Acceptance Criteria:**
    - Extracts symbol metadata for all supported languages
    - Extracts imports and exports
    - Handles edge cases (dynamic imports, re-exports)
    - Unit tests pass
  - **Deliverable:** Enhanced parser.ts

#### Task 2.3: Update Qdrant Schema
- [ ] **Store enhanced metadata in Qdrant**
  - **File to modify:** `src/services/code-index/vector-store.ts`
  - **Complexity:** Medium
  - **Changes:**
    ```typescript
    export class QdrantVectorStore {
      async upsertSegments(segments: EnhancedCodeSegment[]): Promise<void> {
        const points = segments.map(segment => ({
          id: segment.segmentHash,
          vector: segment.embedding,
          payload: {
            // Existing fields
            filePath: segment.filePath,
            content: segment.content,
            startLine: segment.startLine,
            endLine: segment.endLine,
            language: segment.language,

            // New metadata fields
            symbolName: segment.symbolName,
            symbolType: segment.symbolType,
            symbolVisibility: segment.symbolVisibility,
            isExported: segment.isExported,
            imports: segment.imports,
            exports: segment.exports,
            documentation: segment.documentation,

            // File-level metadata
            fileMetadata: segment.fileMetadata,

            // Searchable fields
            hasDocumentation: !!segment.documentation,
            isPublic: segment.symbolVisibility === 'public',
            importCount: segment.imports?.length || 0,
            exportCount: segment.exports?.length || 0
          }
        }))

        await this.client.upsert(this.collectionName, { points })
      }

      async searchWithFilters(query: string, filters?: SearchFilters): Promise<SearchResult[]> {
        const filter: any = {}

        if (filters?.symbolType) {
          filter.must = filter.must || []
          filter.must.push({
            key: 'symbolType',
            match: { value: filters.symbolType }
          })
        }

        if (filters?.isExported !== undefined) {
          filter.must = filter.must || []
          filter.must.push({
            key: 'isExported',
            match: { value: filters.isExported }
          })
        }

        if (filters?.language) {
          filter.must = filter.must || []
          filter.must.push({
            key: 'language',
            match: { value: filters.language }
          })
        }

        return this.search(query, { filter })
      }
    }
    ```
  - **Acceptance Criteria:**
    - All metadata stored in Qdrant payload
    - Filterable by symbol type, visibility, exports
    - Backward compatible with existing data
  - **Deliverable:** Enhanced vector-store.ts

#### Task 2.4: Create Metadata Extractor Service
- [ ] **Centralize metadata extraction logic**
  - **File to create:** `src/services/code-index/metadata-extractor.ts`
  - **Complexity:** Medium
  - **Implementation:**
    ```typescript
    export class MetadataExtractor {
      async extractFileMetadata(filePath: string, content: string): Promise<FileMetadata> {
        const language = this.detectLanguage(filePath)
        const framework = await this.detectFramework(filePath, content)
        const category = this.categorizeFile(filePath, content)

        return {
          language,
          framework,
          category,
          dependencies: await this.extractDependencies(filePath, content),
          exports: await this.extractExports(filePath, content),
          imports: await this.extractImports(filePath, content),
          symbols: await this.extractSymbols(filePath, content),
          lineCount: content.split('\n').length,
          complexity: await this.calculateComplexity(content),
          lastModified: await this.getLastModified(filePath)
        }
      }

      private detectFramework(filePath: string, content: string): string | undefined {
        // Detect React
        if (content.includes('import React') || content.includes('from "react"')) {
          return 'React'
        }

        // Detect Vue
        if (filePath.endsWith('.vue') || content.includes('from "vue"')) {
          return 'Vue'
        }

        // Detect Express
        if (content.includes('from "express"') || content.includes('require("express")')) {
          return 'Express'
        }

        // Add more framework detection...
        return undefined
      }

      private categorizeFile(filePath: string, content: string): string {
        // Test files
        if (filePath.includes('.test.') || filePath.includes('.spec.') || filePath.includes('__tests__')) {
          return 'test'
        }

        // Components
        if (filePath.includes('component') || content.includes('export default function') && content.includes('return (')) {
          return 'component'
        }

        // Services
        if (filePath.includes('service')) {
          return 'service'
        }

        // Controllers
        if (filePath.includes('controller')) {
          return 'controller'
        }

        // Utils
        if (filePath.includes('util') || filePath.includes('helper')) {
          return 'utility'
        }

        return 'other'
      }
    }
    ```
  - **Acceptance Criteria:**
    - Detects common frameworks
    - Categorizes files accurately
    - Extracts all metadata fields
  - **Deliverable:** metadata-extractor.ts

#### Task 2.5: Update Indexing Pipeline
- [ ] **Integrate metadata extraction into indexing**
  - **File to modify:** `src/services/code-index/orchestrator.ts`
  - **Complexity:** Low
  - **Changes:**
    ```typescript
    import { MetadataExtractor } from './metadata-extractor'

    export class CodeIndexOrchestrator {
      private metadataExtractor: MetadataExtractor

      async indexFile(filePath: string): Promise<void> {
        const content = await fs.readFile(filePath, 'utf-8')

        // Parse into segments
        const segments = await this.parser.parseWithMetadata(filePath, content)

        // Extract file-level metadata
        const fileMetadata = await this.metadataExtractor.extractFileMetadata(filePath, content)

        // Attach file metadata to all segments
        for (const segment of segments) {
          segment.fileMetadata = fileMetadata
        }

        // Generate embeddings
        const embeddings = await this.embedder.generateEmbeddings(segments)

        // Store in Qdrant
        await this.vectorStore.upsertSegments(segments)
      }
    }
    ```
  - **Acceptance Criteria:**
    - Metadata extracted for all indexed files
    - No performance regression
    - Incremental updates work correctly
  - **Deliverable:** Updated orchestrator.ts

### Testing

**Unit Tests:**
```typescript
// src/services/code-index/__tests__/metadata-extractor.spec.ts
describe('MetadataExtractor', () => {
  it('should extract symbol metadata', async () => {
    const code = `
      export class UserService {
        async login(username: string, password: string): Promise<User> {
          // ...
        }
      }
    `
    const metadata = await extractor.extractFileMetadata('UserService.ts', code)

    expect(metadata.symbols).toHaveLength(2)  // class + method
    expect(metadata.symbols[0].name).toBe('UserService')
    expect(metadata.symbols[0].type).toBe('class')
    expect(metadata.symbols[1].name).toBe('login')
    expect(metadata.symbols[1].isAsync).toBe(true)
  })

  it('should detect framework', async () => {
    const reactCode = 'import React from "react"'
    const metadata = await extractor.extractFileMetadata('App.tsx', reactCode)
    expect(metadata.framework).toBe('React')
  })

  it('should categorize files', async () => {
    const testFile = 'UserService.test.ts'
    const metadata = await extractor.extractFileMetadata(testFile, '')
    expect(metadata.category).toBe('test')
  })
})
```

**Integration Tests:**
```typescript
// src/services/code-index/__tests__/enhanced-metadata.integration.spec.ts
describe('Enhanced Metadata Integration', () => {
  it('should index file with metadata', async () => {
    await orchestrator.indexFile('test-fixtures/UserService.ts')

    const results = await searchService.search('UserService')
    expect(results[0].symbolName).toBe('UserService')
    expect(results[0].symbolType).toBe('class')
    expect(results[0].isExported).toBe(true)
  })

  it('should filter by symbol type', async () => {
    const results = await searchService.searchWithFilters('user', {
      symbolType: 'class'
    })

    expect(results.every(r => r.symbolType === 'class')).toBe(true)
  })
})
```

### Success Metrics

**Before:**
- Metadata: file path, lines, content only
- No filtering capabilities
- No symbol information

**After:**
- Rich metadata: symbols, imports, exports, framework, category
- Filterable by type, visibility, exports
- 30% better search relevance (measured by user feedback)

### Rollback

```bash
# Revert metadata changes
git checkout main -- src/services/code-index/types/metadata.ts
git checkout main -- src/services/code-index/metadata-extractor.ts
git checkout main -- src/services/code-index/parser.ts
git checkout main -- src/services/code-index/vector-store.ts
git checkout main -- src/services/code-index/orchestrator.ts
git commit -m "Rollback: Revert enhanced metadata"
```

---

## Phase 3: BM25 Keyword Search

**Duration:** 1-2 weeks
**Complexity:** Medium
**Prerequisites:** Phase 2 (Enhanced Metadata)
**Expected Impact:** 🔥🔥🔥 (Very High)

### Overview

Add BM25 keyword search to complement vector search. BM25 excels at exact symbol name matches while vector search handles semantic similarity.

### Tasks

#### Task 3.1: Install BM25 Library
- [ ] **Add BM25 dependency**
  - **Command:**
    ```bash
    cd src
    npm install bm25
    npm install --save-dev @types/bm25
    ```
  - **Complexity:** Low
  - **Acceptance Criteria:**
    - Package installed
    - Types available
  - **Deliverable:** Updated package.json

#### Task 3.2: Create BM25 Index Service
- [ ] **Implement BM25 indexing and search**
  - **File to create:** `src/services/code-index/bm25-index.ts`
  - **Complexity:** Medium
  - **Implementation:**
    ```typescript
    import BM25 from 'bm25'

    export interface BM25Document {
      id: string  // segmentHash
      tokens: string[]
      metadata: {
        filePath: string
        symbolName?: string
        content: string
      }
    }

    export class BM25Index {
      private index: BM25
      private documents: Map<string, BM25Document>

      constructor() {
        this.documents = new Map()
      }

      async buildIndex(segments: EnhancedCodeSegment[]): Promise<void> {
        const documents: BM25Document[] = segments.map(segment => ({
          id: segment.segmentHash,
          tokens: this.tokenize(segment),
          metadata: {
            filePath: segment.filePath,
            symbolName: segment.symbolName,
            content: segment.content
          }
        }))

        // Store documents
        for (const doc of documents) {
          this.documents.set(doc.id, doc)
        }

        // Build BM25 index
        this.index = new BM25(documents.map(d => d.tokens))
      }

      async addDocument(segment: EnhancedCodeSegment): Promise<void> {
        const doc: BM25Document = {
          id: segment.segmentHash,
          tokens: this.tokenize(segment),
          metadata: {
            filePath: segment.filePath,
            symbolName: segment.symbolName,
            content: segment.content
          }
        }

        this.documents.set(doc.id, doc)
        this.index.addDocument(doc.tokens)
      }

      async removeDocument(segmentHash: string): Promise<void> {
        this.documents.delete(segmentHash)
        // Note: BM25 library doesn't support removal, need to rebuild
        await this.rebuildIndex()
      }

      async search(query: string, limit: number = 20): Promise<BM25SearchResult[]> {
        const queryTokens = this.tokenizeQuery(query)
        const scores = this.index.search(queryTokens)

        // Get top results
        const results = scores
          .map((score, index) => {
            const docArray = Array.from(this.documents.values())
            const doc = docArray[index]
            return {
              segmentHash: doc.id,
              score: score,
              filePath: doc.metadata.filePath,
              symbolName: doc.metadata.symbolName,
              content: doc.metadata.content
            }
          })
          .filter(r => r.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)

        return results
      }

      private tokenize(segment: EnhancedCodeSegment): string[] {
        const text = [
          segment.content,
          segment.symbolName || '',
          segment.filePath,
          segment.documentation || ''
        ].join(' ')

        return this.tokenizeText(text)
      }

      private tokenizeQuery(query: string): string[] {
        return this.tokenizeText(query)
      }

      private tokenizeText(text: string): string[] {
        // Tokenization strategy:
        // 1. Split on non-alphanumeric
        // 2. Keep camelCase and PascalCase intact
        // 3. Also split camelCase into parts
        // 4. Lowercase everything
        // 5. Remove stopwords

        const tokens: string[] = []

        // Split on non-alphanumeric but keep the text
        const words = text.split(/\s+/)

        for (const word of words) {
          // Add the whole word
          const cleaned = word.toLowerCase().replace(/[^a-z0-9]/g, '')
          if (cleaned.length > 2 && !this.isStopword(cleaned)) {
            tokens.push(cleaned)
          }

          // Split camelCase: getUserById → get, user, by, id
          const camelParts = word.split(/(?=[A-Z])/)
          for (const part of camelParts) {
            const cleaned = part.toLowerCase().replace(/[^a-z0-9]/g, '')
            if (cleaned.length > 2 && !this.isStopword(cleaned)) {
              tokens.push(cleaned)
            }
          }
        }

        return tokens
      }

      private isStopword(word: string): boolean {
        const stopwords = new Set([
          'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
          'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
          'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
          'would', 'should', 'could', 'may', 'might', 'must', 'can'
        ])
        return stopwords.has(word)
      }

      private async rebuildIndex(): Promise<void> {
        const docs = Array.from(this.documents.values())
        this.index = new BM25(docs.map(d => d.tokens))
      }

      async persist(filePath: string): Promise<void> {
        // Serialize index to disk
        const data = {
          documents: Array.from(this.documents.entries())
        }
        await fs.writeFile(filePath, JSON.stringify(data), 'utf-8')
      }

      async load(filePath: string): Promise<void> {
        // Load index from disk
        const data = JSON.parse(await fs.readFile(filePath, 'utf-8'))
        this.documents = new Map(data.documents)
        await this.rebuildIndex()
      }
    }
    ```
  - **Acceptance Criteria:**
    - BM25 indexing works
    - Search returns relevant results
    - Tokenization handles camelCase
    - Persistence works
  - **Deliverable:** bm25-index.ts

#### Task 3.3: Create Hybrid Search Service
- [ ] **Combine vector and BM25 search**
  - **File to create:** `src/services/code-index/hybrid-search.ts`
  - **Complexity:** Medium
  - **Implementation:**
    ```typescript
    export interface HybridSearchOptions {
      vectorWeight?: number
      bm25Weight?: number
      limit?: number
    }

    export class HybridSearchService {
      constructor(
        private vectorStore: QdrantVectorStore,
        private bm25Index: BM25Index
      ) {}

      async search(query: string, options?: HybridSearchOptions): Promise<SearchResult[]> {
        const weights = this.getAdaptiveWeights(query, options)
        const limit = options?.limit || 20

        // Run both searches in parallel
        const [vectorResults, bm25Results] = await Promise.all([
          this.vectorStore.search(query, limit * 2),
          this.bm25Index.search(query, limit * 2)
        ])

        // Merge and rank results
        return this.mergeResults(vectorResults, bm25Results, weights, limit)
      }

      private getAdaptiveWeights(query: string, options?: HybridSearchOptions): { vector: number, bm25: number } {
        // If user specified weights, use them
        if (options?.vectorWeight !== undefined && options?.bm25Weight !== undefined) {
          return {
            vector: options.vectorWeight,
            bm25: options.bm25Weight
          }
        }

        // Adaptive weighting based on query characteristics

        // If query looks like a symbol name (PascalCase or camelCase), boost BM25
        if (/^[A-Z][a-zA-Z0-9]*$/.test(query) ||  // PascalCase
            /^[a-z][a-zA-Z0-9]*$/.test(query)) {  // camelCase
          return { vector: 0.3, bm25: 0.7 }
        }

        // If query is natural language (3+ words), boost vector
        if (query.split(/\s+/).length > 3) {
          return { vector: 0.8, bm25: 0.2 }
        }

        // If query contains special characters (like operators), boost BM25
        if (/[<>!=+\-*\/]/.test(query)) {
          return { vector: 0.2, bm25: 0.8 }
        }

        // Default: balanced
        return { vector: 0.6, bm25: 0.4 }
      }

      private mergeResults(
        vectorResults: SearchResult[],
        bm25Results: BM25SearchResult[],
        weights: { vector: number, bm25: number },
        limit: number
      ): SearchResult[] {
        // Normalize scores to 0-1 range
        const normalizedVector = this.normalizeScores(vectorResults)
        const normalizedBM25 = this.normalizeScores(bm25Results)

        // Combine scores
        const combined = new Map<string, SearchResult>()

        for (const result of normalizedVector) {
          combined.set(result.segmentHash, {
            ...result,
            score: result.score * weights.vector,
            scoreBreakdown: {
              vector: result.score,
              bm25: 0,
              combined: result.score * weights.vector
            }
          })
        }

        for (const result of normalizedBM25) {
          const existing = combined.get(result.segmentHash)
          if (existing) {
            existing.score += result.score * weights.bm25
            existing.scoreBreakdown!.bm25 = result.score
            existing.scoreBreakdown!.combined = existing.score
          } else {
            combined.set(result.segmentHash, {
              ...result,
              score: result.score * weights.bm25,
              scoreBreakdown: {
                vector: 0,
                bm25: result.score,
                combined: result.score * weights.bm25
              }
            })
          }
        }

        // Sort by combined score and return top results
        return Array.from(combined.values())
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
      }

      private normalizeScores<T extends { score: number }>(results: T[]): T[] {
        if (results.length === 0) return results

        const maxScore = Math.max(...results.map(r => r.score))
        if (maxScore === 0) return results

        return results.map(r => ({
          ...r,
          score: r.score / maxScore
        }))
      }
    }
    ```
  - **Acceptance Criteria:**
    - Hybrid search combines both backends
    - Adaptive weighting works correctly
    - Score normalization is accurate
    - Results are properly merged
  - **Deliverable:** hybrid-search.ts

#### Task 3.4: Integrate BM25 into Indexing Pipeline
- [ ] **Update orchestrator to build BM25 index**
  - **File to modify:** `src/services/code-index/orchestrator.ts`
  - **Complexity:** Low
  - **Changes:**
    ```typescript
    import { BM25Index } from './bm25-index'

    export class CodeIndexOrchestrator {
      private bm25Index: BM25Index

      async initialize(): Promise<void> {
        // Initialize BM25 index
        this.bm25Index = new BM25Index()

        // Try to load existing index
        const bm25Path = path.join(this.indexDir, 'bm25-index.json')
        if (await fs.pathExists(bm25Path)) {
          await this.bm25Index.load(bm25Path)
        }
      }

      async indexFile(filePath: string): Promise<void> {
        // ... existing code ...

        // Add to BM25 index
        for (const segment of segments) {
          await this.bm25Index.addDocument(segment)
        }

        // Persist BM25 index
        await this.bm25Index.persist(path.join(this.indexDir, 'bm25-index.json'))
      }

      async removeFile(filePath: string): Promise<void> {
        // ... existing code ...

        // Remove from BM25 index
        const segments = await this.getSegmentsForFile(filePath)
        for (const segment of segments) {
          await this.bm25Index.removeDocument(segment.segmentHash)
        }
      }
    }
    ```
  - **Acceptance Criteria:**
    - BM25 index built alongside vector index
    - Incremental updates work
    - Index persisted to disk
  - **Deliverable:** Updated orchestrator.ts

#### Task 3.5: Update Search Service
- [ ] **Use hybrid search by default**
  - **File to modify:** `src/services/code-index/search-service.ts`
  - **Complexity:** Low
  - **Changes:**
    ```typescript
    import { HybridSearchService } from './hybrid-search'

    export class CodeIndexSearchService {
      private hybridSearch: HybridSearchService

      async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
        // Use hybrid search by default
        return this.hybridSearch.search(query, options)
      }

      // Keep vector-only search for specific use cases
      async vectorSearch(query: string, options?: SearchOptions): Promise<SearchResult[]> {
        return this.vectorStore.search(query, options)
      }

      // Keep BM25-only search for specific use cases
      async keywordSearch(query: string, options?: SearchOptions): Promise<SearchResult[]> {
        return this.bm25Index.search(query, options?.limit)
      }
    }
    ```
  - **Acceptance Criteria:**
    - Hybrid search is default
    - Individual backends still accessible
    - Backward compatible
  - **Deliverable:** Updated search-service.ts

### Testing

**Unit Tests:**
```typescript
// src/services/code-index/__tests__/bm25-index.spec.ts
describe('BM25Index', () => {
  it('should tokenize camelCase correctly', () => {
    const tokens = index.tokenizeText('getUserById')
    expect(tokens).toContain('getuserbyid')  // whole word
    expect(tokens).toContain('get')  // camel parts
    expect(tokens).toContain('user')
    expect(tokens).toContain('by')
    expect(tokens).toContain('id')
  })

  it('should find exact symbol matches', async () => {
    await index.addDocument({
      segmentHash: '123',
      symbolName: 'UserService',
      content: 'class UserService { ... }'
    })

    const results = await index.search('UserService')
    expect(results[0].symbolName).toBe('UserService')
    expect(results[0].score).toBeGreaterThan(0.5)
  })
})

// src/services/code-index/__tests__/hybrid-search.spec.ts
describe('HybridSearchService', () => {
  it('should boost BM25 for symbol names', () => {
    const weights = service.getAdaptiveWeights('UserService')
    expect(weights.bm25).toBeGreaterThan(weights.vector)
  })

  it('should boost vector for natural language', () => {
    const weights = service.getAdaptiveWeights('how to authenticate users')
    expect(weights.vector).toBeGreaterThan(weights.bm25)
  })

  it('should merge results correctly', async () => {
    const results = await service.search('UserService')
    expect(results[0].scoreBreakdown).toBeDefined()
    expect(results[0].scoreBreakdown.vector).toBeGreaterThanOrEqual(0)
    expect(results[0].scoreBreakdown.bm25).toBeGreaterThanOrEqual(0)
  })
})
```

### Success Metrics

**Before:**
- Query "UserService" → might not find exact class
- Query "getUserById" → semantic search struggles with exact names
- No keyword matching

**After:**
- Query "UserService" → finds exact class (BM25 boost)
- Query "getUserById" → finds exact function (BM25 boost)
- Query "authentication implementation" → semantic search (vector boost)
- 40% improvement in exact symbol finding

### Rollback

```bash
git checkout main -- src/services/code-index/bm25-index.ts
git checkout main -- src/services/code-index/hybrid-search.ts
git checkout main -- src/services/code-index/orchestrator.ts
git checkout main -- src/services/code-index/search-service.ts
npm uninstall bm25
git commit -m "Rollback: Revert BM25 integration"
```

---

## Phase 4: Neo4j Integration

**Duration:** 2-3 weeks
**Complexity:** High
**Prerequisites:** Phase 2 (Enhanced Metadata)
**Expected Impact:** 🔥🔥🔥 (Very High for structural queries)

### Overview

Add Neo4j graph database for structural code relationships. Enable queries like "find all callers of function X" and "show dependency chain".

**Note:** This phase is detailed in `NEO4J_INTEGRATION_PLAN.md`. Here's the implementation checklist.

### Tasks

#### Task 4.1: Set Up Neo4j Configuration
- [ ] **Add Neo4j support (local + cloud)**
  - **Files to create:**
    - `src/services/code-index/config/neo4j-config.ts`
  - **Complexity:** Low
  - **Configuration:**
    ```typescript
    export interface Neo4jConfig {
      enabled: boolean
      mode: 'local' | 'cloud'
      local?: {
        uri: string  // bolt://localhost:7687
        username: string
        password: string
      }
      cloud?: {
        uri: string  // neo4j+s://xxx.databases.neo4j.io
        username: string
        password: string
      }
    }

    export function getNeo4jConfig(): Neo4jConfig {
      return {
        enabled: vscode.workspace.getConfiguration('roo.codeIndex').get('neo4j.enabled', false),
        mode: vscode.workspace.getConfiguration('roo.codeIndex').get('neo4j.mode', 'local'),
        local: {
          uri: vscode.workspace.getConfiguration('roo.codeIndex').get('neo4j.local.uri', 'bolt://localhost:7687'),
          username: vscode.workspace.getConfiguration('roo.codeIndex').get('neo4j.local.username', 'neo4j'),
          password: vscode.workspace.getConfiguration('roo.codeIndex').get('neo4j.local.password', '')
        },
        cloud: {
          uri: vscode.workspace.getConfiguration('roo.codeIndex').get('neo4j.cloud.uri', ''),
          username: vscode.workspace.getConfiguration('roo.codeIndex').get('neo4j.cloud.username', ''),
          password: vscode.workspace.getConfiguration('roo.codeIndex').get('neo4j.cloud.password', '')
        }
      }
    }
    ```
  - **VSCode Settings to add:**
    ```json
    {
      "roo.codeIndex.neo4j.enabled": false,
      "roo.codeIndex.neo4j.mode": "local",
      "roo.codeIndex.neo4j.local.uri": "bolt://localhost:7687",
      "roo.codeIndex.neo4j.cloud.uri": ""
    }
    ```
  - **Acceptance Criteria:**
    - Configuration supports local and cloud
    - Optional (disabled by default)
    - Secure password storage
  - **Deliverable:** neo4j-config.ts + VSCode settings

#### Task 4.2: Install Neo4j Driver
- [ ] **Add Neo4j dependency**
  - **Command:**
    ```bash
    cd src
    npm install neo4j-driver
    npm install --save-dev @types/neo4j-driver
    ```
  - **Complexity:** Low
  - **Acceptance Criteria:**
    - Package installed
    - Types available
  - **Deliverable:** Updated package.json

#### Task 4.3: Create Neo4j Service
- [ ] **Implement graph database interface**
  - **File to create:** `src/services/code-index/neo4j-service.ts`
  - **Complexity:** High
  - **Schema:**
    ```cypher
    // Nodes
    (:File {path, language, category})
    (:Symbol {name, type, visibility, filePath, startLine, endLine})
    (:Package {name, version})

    // Relationships
    (File)-[:IMPORTS]->(File)
    (File)-[:EXPORTS]->(Symbol)
    (Symbol)-[:CALLS]->(Symbol)
    (Symbol)-[:EXTENDS]->(Symbol)
    (Symbol)-[:IMPLEMENTS]->(Symbol)
    (Symbol)-[:DEFINED_IN]->(File)
    (File)-[:DEPENDS_ON]->(Package)
    (Test:File)-[:TESTS]->(File)
    ```
  - **Implementation:** See `NEO4J_INTEGRATION_PLAN.md` for full code
  - **Key Methods:**
    - `createFileNode(filePath, metadata)`
    - `createSymbolNode(symbol, filePath)`
    - `createRelationship(from, to, type)`
    - `findCallers(symbolName)`
    - `findCallees(symbolName)`
    - `findDependencies(filePath)`
    - `findDependents(filePath)`
  - **Acceptance Criteria:**
    - Connects to Neo4j (local or cloud)
    - Creates nodes and relationships
    - Queries work correctly
    - Handles connection errors gracefully
  - **Deliverable:** neo4j-service.ts

#### Task 4.4: Create Graph Indexer
- [ ] **Build AST → Neo4j pipeline**
  - **File to create:** `src/services/code-index/graph-indexer.ts`
  - **Complexity:** High
  - **Implementation:**
    ```typescript
    export class GraphIndexer {
      constructor(private neo4jService: Neo4jService) {}

      async indexFile(filePath: string, metadata: FileMetadata, segments: EnhancedCodeSegment[]): Promise<void> {
        // Create file node
        await this.neo4jService.createFileNode(filePath, {
          language: metadata.language,
          category: metadata.category,
          framework: metadata.framework
        })

        // Create symbol nodes
        for (const symbol of metadata.symbols) {
          await this.neo4jService.createSymbolNode(symbol, filePath)
        }

        // Create import relationships
        for (const imp of metadata.imports) {
          await this.neo4jService.createImportRelationship(filePath, imp.source)
        }

        // Create call relationships (from AST analysis)
        const calls = await this.extractCallRelationships(segments)
        for (const call of calls) {
          await this.neo4jService.createCallRelationship(call.caller, call.callee)
        }

        // Create inheritance relationships
        const inheritance = await this.extractInheritanceRelationships(segments)
        for (const rel of inheritance) {
          await this.neo4jService.createExtendsRelationship(rel.child, rel.parent)
        }
      }

      private async extractCallRelationships(segments: EnhancedCodeSegment[]): Promise<CallRelationship[]> {
        // Use tree-sitter to find function calls
        // ...
      }
    }
    ```
  - **Acceptance Criteria:**
    - Extracts all relationships from AST
    - Creates correct graph structure
    - Handles errors gracefully
  - **Deliverable:** graph-indexer.ts

#### Task 4.5: Integrate Neo4j into Pipeline
- [ ] **Update orchestrator to use Neo4j**
  - **File to modify:** `src/services/code-index/orchestrator.ts`
  - **Complexity:** Medium
  - **Changes:**
    ```typescript
    import { Neo4jService } from './neo4j-service'
    import { GraphIndexer } from './graph-indexer'

    export class CodeIndexOrchestrator {
      private neo4jService?: Neo4jService
      private graphIndexer?: GraphIndexer

      async initialize(): Promise<void> {
        // ... existing code ...

        // Initialize Neo4j if enabled
        const neo4jConfig = getNeo4jConfig()
        if (neo4jConfig.enabled) {
          this.neo4jService = new Neo4jService(neo4jConfig)
          await this.neo4jService.connect()
          this.graphIndexer = new GraphIndexer(this.neo4jService)
        }
      }

      async indexFile(filePath: string): Promise<void> {
        // ... existing code ...

        // Index in Neo4j if enabled
        if (this.graphIndexer) {
          await this.graphIndexer.indexFile(filePath, fileMetadata, segments)
        }
      }
    }
    ```
  - **Acceptance Criteria:**
    - Neo4j indexing is optional
    - Works alongside Qdrant and BM25
    - No performance regression when disabled
  - **Deliverable:** Updated orchestrator.ts

### Testing

**Unit Tests:**
```typescript
// src/services/code-index/__tests__/neo4j-service.spec.ts
describe('Neo4jService', () => {
  it('should create file node', async () => {
    await service.createFileNode('UserService.ts', {
      language: 'typescript',
      category: 'service'
    })

    const node = await service.findFileNode('UserService.ts')
    expect(node).toBeDefined()
    expect(node.language).toBe('typescript')
  })

  it('should find callers', async () => {
    // Set up: create login function and its callers
    await service.createSymbolNode({ name: 'login', type: 'function' }, 'auth.ts')
    await service.createSymbolNode({ name: 'handleLogin', type: 'function' }, 'controller.ts')
    await service.createCallRelationship('handleLogin', 'login')

    const callers = await service.findCallers('login')
    expect(callers).toContainEqual(expect.objectContaining({ name: 'handleLogin' }))
  })
})
```

**Integration Tests:**
```typescript
// src/services/code-index/__tests__/graph-indexing.integration.spec.ts
describe('Graph Indexing', () => {
  it('should build complete graph for file', async () => {
    await orchestrator.indexFile('test-fixtures/UserService.ts')

    // Verify file node exists
    const fileNode = await neo4jService.findFileNode('UserService.ts')
    expect(fileNode).toBeDefined()

    // Verify symbol nodes exist
    const symbols = await neo4jService.findSymbolsInFile('UserService.ts')
    expect(symbols.length).toBeGreaterThan(0)

    // Verify relationships exist
    const imports = await neo4jService.findImports('UserService.ts')
    expect(imports.length).toBeGreaterThan(0)
  })
})
```

### Success Metrics

**Before:**
- No structural queries possible
- Can't find callers or dependencies
- No graph visualization

**After:**
- Query "find all callers of login" → instant results
- Query "show dependency chain" → complete graph
- 100% accurate structural relationships

### Rollback

```bash
git checkout main -- src/services/code-index/neo4j-service.ts
git checkout main -- src/services/code-index/graph-indexer.ts
git checkout main -- src/services/code-index/config/neo4j-config.ts
git checkout main -- src/services/code-index/orchestrator.ts
npm uninstall neo4j-driver
git commit -m "Rollback: Revert Neo4j integration"
```

---

## Phase 5: LSP Integration

**Duration:** 1-2 weeks
**Complexity:** Medium
**Prerequisites:** Phase 0
**Expected Impact:** 🔥🔥🔥 (Very High - leverages existing infrastructure)

### Overview

Integrate VSCode's Language Server Protocol to get accurate type information, references, and symbol data without reinventing the wheel.

### Tasks

#### Task 5.1: Create LSP Service Wrapper
- [ ] **Wrap VSCode LSP commands**
  - **File to create:** `src/services/code-index/lsp-service.ts`
  - **Complexity:** Medium
  - **Implementation:**
    ```typescript
    import * as vscode from 'vscode'

    export interface LSPSymbolInfo {
      name: string
      kind: vscode.SymbolKind
      type?: string
      documentation?: string
      location: vscode.Location
    }

    export interface LSPReferenceInfo {
      location: vscode.Location
      isDefinition: boolean
    }

    export class LSPService {
      async getSymbolInfo(filePath: string, line: number, character: number = 0): Promise<LSPSymbolInfo | undefined> {
        const uri = vscode.Uri.file(filePath)
        const position = new vscode.Position(line, character)

        // Get hover information (includes type)
        const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
          'vscode.executeHoverProvider',
          uri,
          position
        )

        // Get symbol information
        const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
          'vscode.executeDocumentSymbolProvider',
          uri
        )

        const symbol = this.findSymbolAtPosition(symbols, line)
        if (!symbol) return undefined

        return {
          name: symbol.name,
          kind: symbol.kind,
          type: this.extractType(hovers),
          documentation: this.extractDocumentation(hovers),
          location: new vscode.Location(uri, symbol.range)
        }
      }

      async findAllReferences(filePath: string, symbolName: string, line: number): Promise<LSPReferenceInfo[]> {
        const uri = vscode.Uri.file(filePath)
        const position = new vscode.Position(line, 0)

        const locations = await vscode.commands.executeCommand<vscode.Location[]>(
          'vscode.executeReferenceProvider',
          uri,
          position
        )

        return (locations || []).map(loc => ({
          location: loc,
          isDefinition: loc.uri.fsPath === filePath && loc.range.start.line === line
        }))
      }

      async findDefinition(filePath: string, line: number, character: number = 0): Promise<vscode.Location | undefined> {
        const uri = vscode.Uri.file(filePath)
        const position = new vscode.Position(line, character)

        const locations = await vscode.commands.executeCommand<vscode.Location[]>(
          'vscode.executeDefinitionProvider',
          uri,
          position
        )

        return locations?.[0]
      }

      async getCallHierarchy(filePath: string, symbolName: string, line: number): Promise<vscode.CallHierarchyItem[]> {
        const uri = vscode.Uri.file(filePath)
        const position = new vscode.Position(line, 0)

        const items = await vscode.commands.executeCommand<vscode.CallHierarchyItem[]>(
          'vscode.prepareCallHierarchy',
          uri,
          position
        )

        return items || []
      }

      async searchWorkspaceSymbols(query: string): Promise<vscode.SymbolInformation[]> {
        const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
          'vscode.executeWorkspaceSymbolProvider',
          query
        )

        return symbols || []
      }

      private findSymbolAtPosition(symbols: vscode.DocumentSymbol[] | undefined, line: number): vscode.DocumentSymbol | undefined {
        if (!symbols) return undefined

        for (const symbol of symbols) {
          if (symbol.range.start.line <= line && symbol.range.end.line >= line) {
            // Check children first (more specific)
            const child = this.findSymbolAtPosition(symbol.children, line)
            return child || symbol
          }
        }

        return undefined
      }

      private extractType(hovers: vscode.Hover[] | undefined): string | undefined {
        if (!hovers || hovers.length === 0) return undefined

        const content = hovers[0].contents[0]
        if (typeof content === 'string') {
          return content
        } else if ('value' in content) {
          // Extract type from markdown code block
          const match = content.value.match(/```typescript\n(.*?)\n```/s)
          return match?.[1]
        }

        return undefined
      }

      private extractDocumentation(hovers: vscode.Hover[] | undefined): string | undefined {
        if (!hovers || hovers.length === 0) return undefined

        // Documentation is usually in the second content item
        if (hovers[0].contents.length > 1) {
          const content = hovers[0].contents[1]
          if (typeof content === 'string') {
            return content
          } else if ('value' in content) {
            return content.value
          }
        }

        return undefined
      }
    }
    ```
  - **Acceptance Criteria:**
    - All LSP commands wrapped
    - Error handling for unavailable LSP
    - Type extraction works
    - Reference finding works
  - **Deliverable:** lsp-service.ts

#### Task 5.2: Enrich Code Segments with LSP Data
- [ ] **Add LSP metadata to segments**
  - **File to modify:** `src/services/code-index/parser.ts`
  - **Complexity:** Medium
  - **Changes:**
    ```typescript
    import { LSPService } from './lsp-service'

    export class CodeIndexParser {
      constructor(private lspService: LSPService) {}

      async parseWithLSP(filePath: string, content: string): Promise<EnhancedCodeSegment[]> {
        // First, parse with tree-sitter
        const segments = await this.parseWithMetadata(filePath, content)

        // Then, enrich with LSP data
        for (const segment of segments) {
          try {
            const lspInfo = await this.lspService.getSymbolInfo(
              filePath,
              segment.startLine
            )

            if (lspInfo) {
              segment.lspMetadata = {
                type: lspInfo.type,
                documentation: lspInfo.documentation,
                kind: lspInfo.kind
              }
            }
          } catch (error) {
            // LSP might not be available for this file/language
            // Continue without LSP data
          }
        }

        return segments
      }
    }
    ```
  - **Acceptance Criteria:**
    - LSP data added when available
    - Graceful fallback when LSP unavailable
    - No performance regression
  - **Deliverable:** Updated parser.ts

#### Task 5.3: Create LSP Search Backend
- [ ] **Add LSP-powered search**
  - **File to create:** `src/services/code-index/lsp-search.ts`
  - **Complexity:** Medium
  - **Implementation:**
    ```typescript
    export class LSPSearchService {
      constructor(private lspService: LSPService) {}

      async searchSymbols(query: string): Promise<SearchResult[]> {
        // Use VSCode's workspace symbol search
        const symbols = await this.lspService.searchWorkspaceSymbols(query)

        return symbols.map(symbol => ({
          filePath: symbol.location.uri.fsPath,
          symbolName: symbol.name,
          symbolType: this.symbolKindToType(symbol.kind),
          startLine: symbol.location.range.start.line,
          endLine: symbol.location.range.end.line,
          score: this.calculateRelevance(symbol.name, query)
        }))
      }

      async findReferences(symbolName: string, filePath: string, line: number): Promise<SearchResult[]> {
        const references = await this.lspService.findAllReferences(filePath, symbolName, line)

        return references.map(ref => ({
          filePath: ref.location.uri.fsPath,
          startLine: ref.location.range.start.line,
          endLine: ref.location.range.end.line,
          isDefinition: ref.isDefinition
        }))
      }
    }
    ```
  - **Acceptance Criteria:**
    - Symbol search works
    - Reference finding works
    - Results formatted correctly
  - **Deliverable:** lsp-search.ts

### Testing

**Manual Testing:**
1. Open a TypeScript file
2. Search for a class name
3. Verify LSP data is included in results
4. Search for "all references to X"
5. Verify LSP finds all references

**Automated Testing:**
```typescript
// src/services/code-index/__tests__/lsp-service.spec.ts
describe('LSPService', () => {
  it('should get symbol info', async () => {
    const info = await lspService.getSymbolInfo('UserService.ts', 5)
    expect(info).toBeDefined()
    expect(info.name).toBe('UserService')
    expect(info.type).toContain('class')
  })

  it('should find all references', async () => {
    const refs = await lspService.findAllReferences('UserService.ts', 'login', 10)
    expect(refs.length).toBeGreaterThan(0)
  })
})
```

### Success Metrics

**Before:**
- No type information
- Can't find references accurately
- Reinventing LSP with tree-sitter

**After:**
- 100% accurate type information
- Instant reference finding
- Leverages VSCode's existing LSP

### Rollback

```bash
git checkout main -- src/services/code-index/lsp-service.ts
git checkout main -- src/services/code-index/lsp-search.ts
git checkout main -- src/services/code-index/parser.ts
git commit -m "Rollback: Revert LSP integration"
```

---

## Phase 6: Hybrid Search & Intelligent Query Routing

**Duration:** 2 weeks
**Complexity:** High
**Prerequisites:** Phases 3, 4, 5 (BM25, Neo4j, LSP)
**Expected Impact:** 🔥🔥🔥 (Very High - brings everything together)

### Overview

Create unified search orchestrator that intelligently routes queries to the appropriate backend(s) and merges results with multi-factor ranking.

### Tasks

#### Task 6.1: Create Query Analyzer
- [ ] **Understand query intent**
  - **File to create:** `src/services/code-index/query-analyzer.ts`
  - **Complexity:** Medium
  - **Implementation:**
    ```typescript
    export type QueryIntent =
      | 'find_implementation'
      | 'find_usages'
      | 'find_callers'
      | 'find_dependencies'
      | 'find_tests'
      | 'find_examples'
      | 'find_pattern'
      | 'semantic_search'

    export interface QueryAnalysis {
      intent: QueryIntent
      symbolName?: string
      symbolType?: string
      language?: string
      backends: ('vector' | 'bm25' | 'graph' | 'lsp')[]
      weights: { vector: number, bm25: number, graph: number, lsp: number }
    }

    export class QueryAnalyzer {
      analyze(query: string): QueryAnalysis {
        const lowerQuery = query.toLowerCase()

        // Detect intent from query patterns
        if (lowerQuery.includes('all callers') || lowerQuery.includes('who calls')) {
          return {
            intent: 'find_callers',
            symbolName: this.extractSymbolName(query),
            backends: ['graph', 'lsp'],
            weights: { vector: 0, bm25: 0, graph: 0.6, lsp: 0.4 }
          }
        }

        if (lowerQuery.includes('all usages') || lowerQuery.includes('where is') || lowerQuery.includes('used')) {
          return {
            intent: 'find_usages',
            symbolName: this.extractSymbolName(query),
            backends: ['lsp', 'graph', 'bm25'],
            weights: { vector: 0, bm25: 0.3, graph: 0.3, lsp: 0.4 }
          }
        }

        if (lowerQuery.includes('dependencies') || lowerQuery.includes('imports')) {
          return {
            intent: 'find_dependencies',
            backends: ['graph'],
            weights: { vector: 0, bm25: 0, graph: 1.0, lsp: 0 }
          }
        }

        if (lowerQuery.includes('test') && (lowerQuery.includes('for') || lowerQuery.includes('of'))) {
          return {
            intent: 'find_tests',
            backends: ['graph', 'bm25', 'vector'],
            weights: { vector: 0.3, bm25: 0.3, graph: 0.4, lsp: 0 }
          }
        }

        // If query looks like a symbol name, use BM25 + LSP
        if (this.isSymbolName(query)) {
          return {
            intent: 'find_implementation',
            symbolName: query,
            backends: ['bm25', 'lsp', 'vector'],
            weights: { vector: 0.2, bm25: 0.5, graph: 0, lsp: 0.3 }
          }
        }

        // Default: semantic search
        return {
          intent: 'semantic_search',
          backends: ['vector', 'bm25'],
          weights: { vector: 0.7, bm25: 0.3, graph: 0, lsp: 0 }
        }
      }

      private isSymbolName(query: string): boolean {
        // PascalCase or camelCase
        return /^[A-Z][a-zA-Z0-9]*$/.test(query) || /^[a-z][a-zA-Z0-9]*$/.test(query)
      }

      private extractSymbolName(query: string): string | undefined {
        // Extract symbol name from queries like "all callers of login"
        const patterns = [
          /(?:callers? of|usages? of|references? to)\s+([a-zA-Z0-9_]+)/i,
          /where is\s+([a-zA-Z0-9_]+)/i,
          /find\s+([a-zA-Z0-9_]+)/i
        ]

        for (const pattern of patterns) {
          const match = query.match(pattern)
          if (match) return match[1]
        }

        return undefined
      }
    }
    ```
  - **Acceptance Criteria:**
    - Correctly identifies query intent
    - Extracts symbol names
    - Selects appropriate backends
    - Assigns reasonable weights
  - **Deliverable:** query-analyzer.ts

#### Task 6.2: Create Unified Search Orchestrator
- [ ] **Route queries and merge results**
  - **File to create:** `src/services/code-index/unified-search.ts`
  - **Complexity:** High
  - **Implementation:**
    ```typescript
    export class UnifiedSearchOrchestrator {
      constructor(
        private queryAnalyzer: QueryAnalyzer,
        private vectorStore: QdrantVectorStore,
        private bm25Index: BM25Index,
        private neo4jService?: Neo4jService,
        private lspService?: LSPService
      ) {}

      async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
        // 1. Analyze query
        const analysis = this.queryAnalyzer.analyze(query)

        // 2. Route to appropriate backends
        const results = await this.routeQuery(query, analysis)

        // 3. Merge and rank results
        const merged = await this.mergeResults(results, analysis.weights)

        // 4. Apply context-aware ranking
        const ranked = await this.applyContextRanking(merged, options?.context)

        // 5. Ensure diversity
        const diverse = this.ensureDiversity(ranked)

        // 6. Add explanations
        return this.addExplanations(diverse, analysis)
      }

      private async routeQuery(query: string, analysis: QueryAnalysis): Promise<BackendResults> {
        const promises: Promise<any>[] = []
        const results: BackendResults = {}

        if (analysis.backends.includes('vector')) {
          promises.push(
            this.vectorStore.search(query).then(r => { results.vector = r })
          )
        }

        if (analysis.backends.includes('bm25')) {
          promises.push(
            this.bm25Index.search(query).then(r => { results.bm25 = r })
          )
        }

        if (analysis.backends.includes('graph') && this.neo4jService) {
          promises.push(
            this.searchGraph(query, analysis).then(r => { results.graph = r })
          )
        }

        if (analysis.backends.includes('lsp') && this.lspService) {
          promises.push(
            this.searchLSP(query, analysis).then(r => { results.lsp = r })
          )
        }

        await Promise.all(promises)
        return results
      }

      private async searchGraph(query: string, analysis: QueryAnalysis): Promise<SearchResult[]> {
        if (!this.neo4jService) return []

        switch (analysis.intent) {
          case 'find_callers':
            return this.neo4jService.findCallers(analysis.symbolName!)
          case 'find_dependencies':
            return this.neo4jService.findDependencies(query)
          case 'find_tests':
            return this.neo4jService.findTests(query)
          default:
            return []
        }
      }

      private async searchLSP(query: string, analysis: QueryAnalysis): Promise<SearchResult[]> {
        if (!this.lspService) return []

        switch (analysis.intent) {
          case 'find_implementation':
          case 'find_usages':
            return this.lspService.searchSymbols(analysis.symbolName || query)
          default:
            return []
        }
      }

      private async mergeResults(results: BackendResults, weights: any): Promise<SearchResult[]> {
        const merged = new Map<string, SearchResult>()

        // Normalize and combine scores
        for (const [backend, backendResults] of Object.entries(results)) {
          if (!backendResults) continue

          const normalized = this.normalizeScores(backendResults)
          const weight = weights[backend] || 0

          for (const result of normalized) {
            const key = `${result.filePath}:${result.startLine}`
            const existing = merged.get(key)

            if (existing) {
              existing.score += result.score * weight
              existing.scoreBreakdown![backend] = result.score
            } else {
              merged.set(key, {
                ...result,
                score: result.score * weight,
                scoreBreakdown: { [backend]: result.score }
              })
            }
          }
        }

        return Array.from(merged.values()).sort((a, b) => b.score - a.score)
      }

      private async applyContextRanking(results: SearchResult[], context?: SearchContext): Promise<SearchResult[]> {
        if (!context) return results

        // Boost results from current file
        if (context.currentFile) {
          results.forEach(r => {
            if (r.filePath === context.currentFile) {
              r.score *= 1.3
            }
          })
        }

        // Boost results from recently viewed files
        if (context.recentFiles) {
          results.forEach(r => {
            if (context.recentFiles!.includes(r.filePath)) {
              r.score *= 1.2
            }
          })
        }

        // Boost results that import current file
        if (context.currentFile && this.neo4jService) {
          const importers = await this.neo4jService.findImporters(context.currentFile)
          results.forEach(r => {
            if (importers.some(imp => imp.filePath === r.filePath)) {
              r.score *= 1.15
            }
          })
        }

        return results.sort((a, b) => b.score - a.score)
      }

      private ensureDiversity(results: SearchResult[]): SearchResult[] {
        // Ensure results come from different files
        const seen = new Set<string>()
        const diverse: SearchResult[] = []
        const maxPerFile = 3
        const fileCounts = new Map<string, number>()

        for (const result of results) {
          const count = fileCounts.get(result.filePath) || 0
          if (count < maxPerFile) {
            diverse.push(result)
            fileCounts.set(result.filePath, count + 1)
          }
        }

        return diverse
      }

      private addExplanations(results: SearchResult[], analysis: QueryAnalysis): SearchResult[] {
        return results.map(result => ({
          ...result,
          explanation: this.generateExplanation(result, analysis)
        }))
      }

      private generateExplanation(result: SearchResult, analysis: QueryAnalysis): string {
        const parts: string[] = []

        if (result.scoreBreakdown) {
          if (result.scoreBreakdown.vector > 0.5) {
            parts.push('semantically similar')
          }
          if (result.scoreBreakdown.bm25 > 0.5) {
            parts.push('exact keyword match')
          }
          if (result.scoreBreakdown.graph > 0.5) {
            parts.push('structurally related')
          }
          if (result.scoreBreakdown.lsp > 0.5) {
            parts.push('LSP verified')
          }
        }

        if (result.symbolName) {
          parts.push(`contains ${result.symbolName}`)
        }

        return parts.join(', ') || 'relevant to query'
      }
    }
    ```
  - **Acceptance Criteria:**
    - Routes queries correctly
    - Merges results from all backends
    - Context-aware ranking works
    - Diversity ensured
    - Explanations generated
  - **Deliverable:** unified-search.ts

#### Task 6.3: Update Search Service to Use Unified Orchestrator
- [ ] **Replace existing search with unified search**
  - **File to modify:** `src/services/code-index/search-service.ts`
  - **Complexity:** Low
  - **Changes:**
    ```typescript
    import { UnifiedSearchOrchestrator } from './unified-search'

    export class CodeIndexSearchService {
      private unifiedSearch: UnifiedSearchOrchestrator

      async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
        return this.unifiedSearch.search(query, options)
      }
    }
    ```
  - **Acceptance Criteria:**
    - All searches use unified orchestrator
    - Backward compatible
    - Options passed through correctly
  - **Deliverable:** Updated search-service.ts

### Testing

**Integration Tests:**
```typescript
// src/services/code-index/__tests__/unified-search.integration.spec.ts
describe('Unified Search', () => {
  it('should route "find all callers" to graph', async () => {
    const results = await orchestrator.search('find all callers of login')

    // Should use graph backend
    expect(results[0].scoreBreakdown.graph).toBeGreaterThan(0)
  })

  it('should route symbol name to BM25 + LSP', async () => {
    const results = await orchestrator.search('UserService')

    // Should use BM25 and LSP
    expect(results[0].scoreBreakdown.bm25).toBeGreaterThan(0)
    expect(results[0].scoreBreakdown.lsp).toBeGreaterThan(0)
  })

  it('should route natural language to vector', async () => {
    const results = await orchestrator.search('how to authenticate users')

    // Should use vector search
    expect(results[0].scoreBreakdown.vector).toBeGreaterThan(0)
  })

  it('should apply context ranking', async () => {
    const results = await orchestrator.search('authentication', {
      context: {
        currentFile: 'auth.ts',
        recentFiles: ['login.ts']
      }
    })

    // Results from auth.ts should be boosted
    expect(results[0].filePath).toBe('auth.ts')
  })
})
```

### Success Metrics

**Before:**
- Single search backend (vector only)
- No query understanding
- No context awareness
- No result explanations

**After:**
- Intelligent routing to 4 backends
- Query intent detection
- Context-aware ranking
- Result explanations
- 60% improvement in search relevance

### Rollback

```bash
git checkout main -- src/services/code-index/query-analyzer.ts
git checkout main -- src/services/code-index/unified-search.ts
git checkout main -- src/services/code-index/search-service.ts
git commit -m "Rollback: Revert unified search"
```

---

## Phases 7-8: Summary

**Phase 7: Advanced Features** (2-3 weeks)
- Test-to-code mapping (see ADDITIONAL_ENHANCEMENTS.md)
- Pattern detection (see ADDITIONAL_ENHANCEMENTS.md)
- Query expansion
- Search analytics

**Phase 8: Performance & Polish** (1-2 weeks)
- Caching layer (in-memory LRU cache)
- Parallel indexing
- Index compression
- Performance monitoring
- Documentation

**Note:** Detailed task breakdowns for Phases 7-8 are available in the referenced documents. Focus on completing Phases 0-6 first as they provide the core functionality.

---

## Technical Specifications

### Data Schemas

#### Qdrant Collection Schema
```typescript
{
  collection_name: "roo-code-index",
  vectors: {
    size: 1536,  // OpenAI ada-002 or equivalent
    distance: "Cosine"
  },
  payload_schema: {
    // Core fields
    filePath: "keyword",
    content: "text",
    startLine: "integer",
    endLine: "integer",
    language: "keyword",

    // Symbol metadata
    symbolName: "keyword",
    symbolType: "keyword",  // class, function, method, etc.
    symbolVisibility: "keyword",  // public, private, protected
    isExported: "bool",

    // File metadata
    framework: "keyword",  // React, Vue, Express, etc.
    category: "keyword",  // component, service, controller, test

    // Searchable flags
    hasDocumentation: "bool",
    isPublic: "bool",
    importCount: "integer",
    exportCount: "integer"
  }
}
```

#### Neo4j Graph Schema
```cypher
// Node types
CREATE CONSTRAINT file_path IF NOT EXISTS FOR (f:File) REQUIRE f.path IS UNIQUE;
CREATE CONSTRAINT symbol_id IF NOT EXISTS FOR (s:Symbol) REQUIRE s.id IS UNIQUE;
CREATE INDEX file_language IF NOT EXISTS FOR (f:File) ON (f.language);
CREATE INDEX symbol_name IF NOT EXISTS FOR (s:Symbol) ON (s.name);

// Nodes
(:File {
  path: string,
  language: string,
  category: string,
  framework: string,
  lineCount: integer,
  lastModified: datetime
})

(:Symbol {
  id: string,  // unique identifier
  name: string,
  type: string,  // class, function, method, etc.
  visibility: string,
  filePath: string,
  startLine: integer,
  endLine: integer
})

(:Package {
  name: string,
  version: string
})

// Relationships
(File)-[:IMPORTS {symbols: [string]}]->(File)
(File)-[:EXPORTS]->(Symbol)
(Symbol)-[:CALLS]->(Symbol)
(Symbol)-[:EXTENDS]->(Symbol)
(Symbol)-[:IMPLEMENTS]->(Symbol)
(Symbol)-[:DEFINED_IN]->(File)
(File)-[:DEPENDS_ON]->(Package)
(Test:File)-[:TESTS {confidence: float}]->(File)
```

### API Interfaces

#### Search API
```typescript
interface SearchOptions {
  limit?: number
  filters?: {
    language?: string
    symbolType?: string
    category?: string
    isExported?: boolean
  }
  context?: {
    currentFile?: string
    recentFiles?: string[]
    currentSymbol?: string
  }
  backends?: ('vector' | 'bm25' | 'graph' | 'lsp')[]
}

interface SearchResult {
  filePath: string
  content: string
  startLine: number
  endLine: number
  score: number
  scoreBreakdown?: {
    vector?: number
    bm25?: number
    graph?: number
    lsp?: number
    combined: number
  }
  symbolName?: string
  symbolType?: string
  explanation?: string
}

interface CodeIndexAPI {
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>
  findReferences(symbolName: string, filePath: string): Promise<SearchResult[]>
  findCallers(symbolName: string): Promise<SearchResult[]>
  findDependencies(filePath: string): Promise<string[]>
  getFileMetadata(filePath: string): Promise<FileMetadata>
}
```

### Configuration

#### VSCode Settings
```json
{
  "roo.codeIndex.enabled": true,
  "roo.codeIndex.embedder": "openai",
  "roo.codeIndex.qdrant.mode": "local",
  "roo.codeIndex.neo4j.enabled": false,
  "roo.codeIndex.neo4j.mode": "local",
  "roo.codeIndex.lsp.enabled": true,
  "roo.codeIndex.search.defaultBackends": ["vector", "bm25", "lsp"],
  "roo.codeIndex.search.maxResults": 20,
  "roo.codeIndex.indexing.excludePatterns": [
    "**/node_modules/**",
    "**/dist/**",
    "**/.git/**"
  ]
}
```

---

## Testing Strategy

### Unit Tests
- Test each service in isolation
- Mock dependencies
- Cover edge cases
- Target: 80%+ code coverage

### Integration Tests
- Test end-to-end workflows
- Use real test fixtures
- Verify all backends work together
- Test error handling

### Performance Tests
- Benchmark indexing speed
- Benchmark search latency
- Test with large codebases (100k+ lines)
- Monitor memory usage

### Manual Testing Checklist
- [ ] Index a real project
- [ ] Search for various query types
- [ ] Verify results are relevant
- [ ] Test with Neo4j enabled/disabled
- [ ] Test with LSP enabled/disabled
- [ ] Verify incremental updates work
- [ ] Test error recovery

---

## Migration & Rollback

### Migration Path

**From Current Index to Enhanced Index:**

1. **Backup existing index**
   ```bash
   cp -r ~/.roo/code-index ~/.roo/code-index.backup
   ```

2. **Gradual migration**
   - Phase 1: System prompts (no data migration needed)
   - Phase 2: Enhanced metadata (rebuild index with new schema)
   - Phase 3: BM25 (build new index alongside existing)
   - Phase 4: Neo4j (optional, build separately)
   - Phase 5: LSP (no data migration needed)
   - Phase 6: Unified search (no data migration needed)

3. **Rebuild index with new schema**
   ```typescript
   // Add migration command
   vscode.commands.registerCommand('roo.rebuildIndex', async () => {
     await codeIndexManager.clearIndexData()
     await codeIndexManager.startIndexing()
   })
   ```

### Rollback Plan

**Per-Phase Rollback:**
- Each phase has specific rollback instructions
- Use git to revert code changes
- Delete new index files if needed
- Restore from backup if necessary

**Complete Rollback:**
```bash
# Revert all code changes
git checkout main

# Restore old index
rm -rf ~/.roo/code-index
mv ~/.roo/code-index.backup ~/.roo/code-index

# Reinstall dependencies
cd src
npm install
```

---

## Success Metrics

### Quantitative Metrics

**Indexing Performance:**
- Current: ~100 files/second
- Target: ~150 files/second (with all enhancements)

**Search Latency:**
- Current: ~200ms average
- Target: ~150ms average (with caching)

**Search Relevance:**
- Current: ~60% user satisfaction
- Target: ~90% user satisfaction

**Coverage:**
- Current: ~70% of codebase indexed
- Target: ~95% of codebase indexed

### Qualitative Metrics

**Before:**
- Roo uses codebase_search ~30% of the time
- Often reads files before searching
- Struggles with exact symbol names
- Can't find structural relationships
- No query understanding

**After:**
- Roo uses codebase_search ~80% of the time
- Always searches before reading
- Finds exact symbols instantly
- Understands structural relationships
- Intelligent query routing
- Context-aware results
- Result explanations

---

## Conclusion

This roadmap provides a comprehensive, step-by-step plan to transform Roo's codebase index into a world-class context engine. By following these phases sequentially, we will:

1. ✅ Teach Roo how to use the index effectively (Phase 1)
2. ✅ Enrich metadata for better search (Phase 2)
3. ✅ Add keyword search for exact matches (Phase 3)
4. ✅ Add graph database for structural queries (Phase 4)
5. ✅ Leverage VSCode's LSP for accurate type info (Phase 5)
6. ✅ Unify all backends with intelligent routing (Phase 6)
7. ✅ Add advanced features (Phase 7)
8. ✅ Optimize performance (Phase 8)

**Next Steps:**
1. Review and approve this roadmap
2. Start with Phase 0 (Foundation & Setup)
3. Execute phases sequentially
4. Track progress with checkboxes
5. Measure success metrics after each phase

**Estimated Completion:** 8-12 weeks from start

---

**Document Status:** ✅ Complete and ready for execution

**Last Updated:** 2025-11-18

**Maintained By:** AI Assistant (executing the plan)

