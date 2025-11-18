# Additional Enhancements from Research

## Overview

This document captures additional enhancement ideas gleaned from research and expert consultation, evaluated for relevance to Roo's use case.

---

## High-Value Additions

### 1. BM25 Keyword Search (HIGH PRIORITY) ⭐⭐⭐

**What:** Classic information retrieval algorithm that scores documents based on term frequency and inverse document frequency.

**Why:** Complements vector search perfectly:
- **Vector search:** Finds semantically similar code ("authentication" matches "login", "user verification")
- **BM25 search:** Finds exact keyword matches ("findUserById" matches "findUserById")

**Use case:**
```typescript
// User searches: "findUserById"
// Vector search might return: authentication code, user management, etc.
// BM25 search will return: exact function "findUserById" and its usages
```

**Implementation:**

```typescript
import { BM25 } from 'bm25'

class HybridSearchService {
  private bm25Index: BM25
  private vectorStore: QdrantVectorStore
  
  async buildBM25Index(segments: CodeSegment[]) {
    const documents = segments.map(s => ({
      id: s.segmentHash,
      text: s.content,
      tokens: this.tokenize(s.content)
    }))
    
    this.bm25Index = new BM25(documents)
  }
  
  async hybridSearch(query: string, limit: number = 20): Promise<SearchResult[]> {
    // Run both searches in parallel
    const [vectorResults, bm25Results] = await Promise.all([
      this.vectorSearch(query, limit * 2),
      this.bm25Search(query, limit * 2)
    ])
    
    // Merge with weighted scoring
    return this.mergeResults(vectorResults, bm25Results, {
      vectorWeight: 0.7,
      bm25Weight: 0.3
    })
  }
  
  private tokenize(text: string): string[] {
    // Simple tokenization (can be improved)
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2)
  }
  
  private bm25Search(query: string, limit: number): SearchResult[] {
    const queryTokens = this.tokenize(query)
    const scores = this.bm25Index.search(queryTokens)
    
    return scores
      .slice(0, limit)
      .map(({ id, score }) => ({
        ...this.getSegmentById(id),
        score: score
      }))
  }
  
  private mergeResults(
    vectorResults: SearchResult[],
    bm25Results: SearchResult[],
    weights: { vectorWeight: number, bm25Weight: number }
  ): SearchResult[] {
    const merged = new Map<string, SearchResult>()
    
    // Normalize scores to 0-1 range
    const normalizeScores = (results: SearchResult[]) => {
      const maxScore = Math.max(...results.map(r => r.score))
      return results.map(r => ({
        ...r,
        score: r.score / maxScore
      }))
    }
    
    const normalizedVector = normalizeScores(vectorResults)
    const normalizedBM25 = normalizeScores(bm25Results)
    
    // Combine scores
    for (const result of normalizedVector) {
      merged.set(result.segmentHash, {
        ...result,
        score: result.score * weights.vectorWeight
      })
    }
    
    for (const result of normalizedBM25) {
      const existing = merged.get(result.segmentHash)
      if (existing) {
        existing.score += result.score * weights.bm25Weight
      } else {
        merged.set(result.segmentHash, {
          ...result,
          score: result.score * weights.bm25Weight
        })
      }
    }
    
    // Sort by combined score
    return Array.from(merged.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
  }
}
```

**Benefits:**
- ✅ Catches exact symbol name matches
- ✅ Fast (no embedding generation needed)
- ✅ Lightweight (pure JavaScript)
- ✅ Complements semantic search perfectly

**Libraries:**
- `bm25` - Simple BM25 implementation
- `natural` - NLP library with BM25
- Custom implementation (it's a simple algorithm)

**Adaptive Weighting:**
```typescript
function getSearchWeights(query: string): { vectorWeight: number, bm25Weight: number } {
  // If query looks like a symbol name, boost BM25
  if (/^[A-Z][a-zA-Z0-9]*$/.test(query) || // PascalCase
      /^[a-z][a-zA-Z0-9]*$/.test(query)) {  // camelCase
    return { vectorWeight: 0.3, bm25Weight: 0.7 }
  }
  
  // If query is natural language, boost vector
  if (query.split(' ').length > 3) {
    return { vectorWeight: 0.8, bm25Weight: 0.2 }
  }
  
  // Default balanced
  return { vectorWeight: 0.6, bm25Weight: 0.4 }
}
```

---

### 2. LSP Integration (HIGH PRIORITY) ⭐⭐⭐

**What:** Leverage VSCode's Language Server Protocol to get accurate type information, definitions, and references.

**Why:** 
- VSCode already has LSP running for the workspace
- Get 100% accurate type information (no parsing/inference needed)
- Find all references instantly (LSP already computed this)
- No additional parsing overhead

**Use cases:**

**A. Accurate Type Information**
```typescript
// Instead of inferring from AST, query LSP:
const typeInfo = await vscode.commands.executeCommand(
  'vscode.executeHoverProvider',
  uri,
  position
)
// Returns: exact type, documentation, signature
```

**B. Find All References**
```typescript
// When user searches "all usages of UserService"
const references = await vscode.commands.executeCommand(
  'vscode.executeReferenceProvider',
  uri,
  position
)
// Returns: all references across entire workspace
```

**C. Go to Definition**
```typescript
const definitions = await vscode.commands.executeCommand(
  'vscode.executeDefinitionProvider',
  uri,
  position
)
```

**Implementation:**

```typescript
class LSPIntegration {
  async enrichCodeSegment(segment: CodeSegment): Promise<EnrichedSegment> {
    const uri = vscode.Uri.file(segment.filePath)
    const position = new vscode.Position(segment.startLine, 0)
    
    // Get type information
    const hover = await vscode.commands.executeCommand<vscode.Hover[]>(
      'vscode.executeHoverProvider',
      uri,
      position
    )
    
    // Get symbol information
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      uri
    )
    
    // Find symbol at this position
    const symbol = this.findSymbolAtPosition(symbols, segment.startLine)
    
    return {
      ...segment,
      symbolName: symbol?.name,
      symbolKind: symbol?.kind,
      typeInfo: hover?.[0]?.contents,
      documentation: this.extractDocumentation(hover)
    }
  }
  
  async findAllReferences(symbolName: string, filePath: string, line: number): Promise<Location[]> {
    const uri = vscode.Uri.file(filePath)
    const position = new vscode.Position(line, 0)
    
    const references = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeReferenceProvider',
      uri,
      position
    )
    
    return references || []
  }
  
  async getCallHierarchy(symbolName: string, filePath: string, line: number) {
    const uri = vscode.Uri.file(filePath)
    const position = new vscode.Position(line, 0)
    
    // Get incoming calls (who calls this)
    const incomingCalls = await vscode.commands.executeCommand(
      'vscode.prepareCallHierarchy',
      uri,
      position
    )
    
    return incomingCalls
  }
}
```

**Integration with Search:**

```typescript
class EnhancedSearchService {
  async search(query: string): Promise<SearchResult[]> {
    // First, try to extract symbol name from query
    const symbolName = this.extractSymbolName(query)
    
    if (symbolName) {
      // Use LSP to find exact references
      const lspResults = await this.lspIntegration.findSymbol(symbolName)
      
      if (lspResults.length > 0) {
        // Combine LSP results with semantic search
        const semanticResults = await this.semanticSearch(query)
        return this.mergeResults(lspResults, semanticResults)
      }
    }
    
    // Fall back to regular search
    return this.hybridSearch(query)
  }
}
```

**Benefits:**
- ✅ 100% accurate type information
- ✅ No additional parsing (LSP already running)
- ✅ Instant reference finding
- ✅ Works across all languages VSCode supports
- ✅ Leverages existing infrastructure

**VSCode LSP Commands:**
- `vscode.executeHoverProvider` - Get type info
- `vscode.executeDefinitionProvider` - Go to definition
- `vscode.executeReferenceProvider` - Find all references
- `vscode.executeDocumentSymbolProvider` - Get symbols in file
- `vscode.executeWorkspaceSymbolProvider` - Search symbols in workspace
- `vscode.prepareCallHierarchy` - Get call hierarchy
- `vscode.executeTypeDefinitionProvider` - Go to type definition
- `vscode.executeImplementationProvider` - Find implementations

---

### 3. Test-to-Code Mapping (MEDIUM PRIORITY) ⭐⭐

**What:** Link test files to the code they test, and vice versa.

**Why:**
- When code changes, know which tests might be affected
- When searching, show related tests
- Help AI understand expected behavior from tests

**Implementation:**

```typescript
interface TestMapping {
  testFile: string
  testName: string
  testedFile: string
  testedSymbol: string
  confidence: number  // 0-1, how confident we are in the mapping
}

class TestMapper {
  async buildTestMappings(workspace: string): Promise<TestMapping[]> {
    const mappings: TestMapping[] = []
    
    // Find all test files
    const testFiles = await this.findTestFiles(workspace)
    
    for (const testFile of testFiles) {
      // Strategy 1: Import analysis
      const imports = await this.extractImports(testFile)
      for (const imp of imports) {
        mappings.push({
          testFile,
          testName: this.extractTestName(testFile),
          testedFile: imp.filePath,
          testedSymbol: imp.symbol,
          confidence: 0.8
        })
      }
      
      // Strategy 2: File name convention
      // user.test.ts -> user.ts
      // UserService.spec.ts -> UserService.ts
      const testedFile = this.inferTestedFile(testFile)
      if (testedFile) {
        mappings.push({
          testFile,
          testName: path.basename(testFile),
          testedFile,
          testedSymbol: '*',
          confidence: 0.6
        })
      }
      
      // Strategy 3: Code analysis
      // Look for describe('UserService', ...) or test('login', ...)
      const testCases = await this.extractTestCases(testFile)
      for (const testCase of testCases) {
        const symbol = this.extractTestedSymbol(testCase.name)
        if (symbol) {
          mappings.push({
            testFile,
            testName: testCase.name,
            testedFile: testCase.file || '',
            testedSymbol: symbol,
            confidence: 0.7
          })
        }
      }
    }
    
    return mappings
  }
  
  private findTestFiles(workspace: string): Promise<string[]> {
    // Find files matching test patterns
    return glob([
      '**/*.test.ts',
      '**/*.test.js',
      '**/*.spec.ts',
      '**/*.spec.js',
      '**/__tests__/**/*.ts',
      '**/__tests__/**/*.js',
    ], { cwd: workspace })
  }
}
```

**Store in Neo4j:**
```cypher
// Create test-to-code relationships
MATCH (test:File {isTest: true, path: $testFile})
MATCH (code:File {path: $testedFile})
CREATE (test)-[:TESTS {confidence: $confidence}]->(code)

// Query: Find tests for a file
MATCH (test:File)-[:TESTS]->(code:File {path: $filePath})
RETURN test.path, test.name
ORDER BY test.confidence DESC
```

**Integration with Search:**
```typescript
async function searchWithTests(query: string): Promise<SearchResult[]> {
  const results = await hybridSearch(query)
  
  // For each result, find related tests
  for (const result of results) {
    result.relatedTests = await this.testMapper.findTestsFor(result.filePath)
  }
  
  return results
}
```

**Benefits:**
- ✅ Know which tests to run when code changes
- ✅ Help AI understand expected behavior
- ✅ Show test examples when searching for code
- ✅ Verify changes don't break tests

---

### 4. Pattern Detection (MEDIUM PRIORITY) ⭐⭐

**What:** Automatically detect common design patterns, coding conventions, and architectural patterns in the codebase.

**Why:**
- Help AI follow established patterns
- Onboarding: understand codebase conventions
- Consistency: ensure new code matches existing patterns

**Patterns to Detect:**

**A. Design Patterns**
- Singleton, Factory, Observer, Strategy, etc.
- Detect from code structure (AST patterns)

**B. Coding Conventions**
- Naming conventions (camelCase, PascalCase, snake_case)
- File organization patterns
- Import ordering
- Error handling patterns

**C. Architectural Patterns**
- MVC, MVVM, Clean Architecture
- Layered architecture (controllers, services, repositories)
- Microservices patterns

**Implementation:**

```typescript
interface DetectedPattern {
  type: 'design' | 'convention' | 'architecture'
  name: string
  description: string
  examples: CodeLocation[]
  confidence: number
}

class PatternDetector {
  async detectPatterns(workspace: string): Promise<DetectedPattern[]> {
    const patterns: DetectedPattern[] = []

    // Detect naming conventions
    patterns.push(...await this.detectNamingConventions(workspace))

    // Detect file organization
    patterns.push(...await this.detectFileOrganization(workspace))

    // Detect error handling patterns
    patterns.push(...await this.detectErrorHandling(workspace))

    // Detect design patterns
    patterns.push(...await this.detectDesignPatterns(workspace))

    return patterns
  }

  private async detectNamingConventions(workspace: string): Promise<DetectedPattern[]> {
    const files = await this.getAllFiles(workspace)
    const symbols = await this.extractAllSymbols(files)

    // Analyze naming patterns
    const classNames = symbols.filter(s => s.type === 'class').map(s => s.name)
    const functionNames = symbols.filter(s => s.type === 'function').map(s => s.name)

    const patterns: DetectedPattern[] = []

    // Check class naming
    if (classNames.every(n => /^[A-Z]/.test(n))) {
      patterns.push({
        type: 'convention',
        name: 'PascalCase for classes',
        description: 'All classes use PascalCase naming',
        examples: classNames.slice(0, 5).map(n => ({ name: n })),
        confidence: 0.95
      })
    }

    // Check function naming
    if (functionNames.every(n => /^[a-z]/.test(n))) {
      patterns.push({
        type: 'convention',
        name: 'camelCase for functions',
        description: 'All functions use camelCase naming',
        examples: functionNames.slice(0, 5).map(n => ({ name: n })),
        confidence: 0.95
      })
    }

    return patterns
  }

  private async detectFileOrganization(workspace: string): Promise<DetectedPattern[]> {
    const files = await this.getAllFiles(workspace)
    const patterns: DetectedPattern[] = []

    // Check for common directory structures
    const hasSrcDir = files.some(f => f.startsWith('src/'))
    const hasTestDir = files.some(f => f.includes('__tests__/') || f.includes('test/'))
    const hasComponentsDir = files.some(f => f.includes('components/'))

    if (hasSrcDir) {
      patterns.push({
        type: 'architecture',
        name: 'src/ directory structure',
        description: 'Source code organized in src/ directory',
        examples: files.filter(f => f.startsWith('src/')).slice(0, 5),
        confidence: 0.9
      })
    }

    // Detect layered architecture
    const hasControllers = files.some(f => f.includes('controller'))
    const hasServices = files.some(f => f.includes('service'))
    const hasRepositories = files.some(f => f.includes('repository'))

    if (hasControllers && hasServices && hasRepositories) {
      patterns.push({
        type: 'architecture',
        name: 'Layered Architecture',
        description: 'Code organized in Controller-Service-Repository layers',
        examples: [
          ...files.filter(f => f.includes('controller')).slice(0, 2),
          ...files.filter(f => f.includes('service')).slice(0, 2),
          ...files.filter(f => f.includes('repository')).slice(0, 2),
        ],
        confidence: 0.85
      })
    }

    return patterns
  }

  private async detectErrorHandling(workspace: string): Promise<DetectedPattern[]> {
    // Analyze how errors are handled across the codebase
    // Look for try-catch patterns, error classes, etc.

    const patterns: DetectedPattern[] = []

    // Use semantic search to find error handling code
    const errorHandlingCode = await this.semanticSearch('error handling try catch')

    // Analyze patterns
    const usesTryCatch = errorHandlingCode.some(c => c.content.includes('try') && c.content.includes('catch'))
    const usesCustomErrors = errorHandlingCode.some(c => c.content.includes('extends Error'))

    if (usesCustomErrors) {
      patterns.push({
        type: 'convention',
        name: 'Custom Error Classes',
        description: 'Codebase uses custom error classes extending Error',
        examples: errorHandlingCode.filter(c => c.content.includes('extends Error')).slice(0, 3),
        confidence: 0.8
      })
    }

    return patterns
  }

  private async detectDesignPatterns(workspace: string): Promise<DetectedPattern[]> {
    const patterns: DetectedPattern[] = []

    // Singleton pattern detection
    const singletons = await this.findSingletons(workspace)
    if (singletons.length > 0) {
      patterns.push({
        type: 'design',
        name: 'Singleton Pattern',
        description: 'Classes using Singleton pattern',
        examples: singletons,
        confidence: 0.9
      })
    }

    // Factory pattern detection
    const factories = await this.findFactories(workspace)
    if (factories.length > 0) {
      patterns.push({
        type: 'design',
        name: 'Factory Pattern',
        description: 'Classes using Factory pattern',
        examples: factories,
        confidence: 0.85
      })
    }

    return patterns
  }

  private async findSingletons(workspace: string): Promise<CodeLocation[]> {
    // Look for getInstance() methods, private constructors
    const results = await this.semanticSearch('getInstance singleton pattern')
    return results.filter(r =>
      r.content.includes('getInstance') ||
      r.content.includes('private constructor')
    )
  }
}
```

**Store Patterns in Index:**

```typescript
interface EnhancedCodeSegment extends CodeSegment {
  patterns?: string[]  // e.g., ['Singleton', 'Factory']
  conventions?: string[]  // e.g., ['PascalCase', 'camelCase']
}
```

**Use Patterns in Search:**

```typescript
async function searchWithPatterns(query: string): Promise<SearchResult[]> {
  const results = await hybridSearch(query)

  // If query asks for a pattern, boost results that use that pattern
  if (query.toLowerCase().includes('singleton')) {
    results.forEach(r => {
      if (r.patterns?.includes('Singleton')) {
        r.score *= 1.5
      }
    })
  }

  return results.sort((a, b) => b.score - a.score)
}
```

**Benefits:**
- ✅ Help AI follow established patterns
- ✅ Onboarding: understand codebase quickly
- ✅ Consistency: new code matches existing style
- ✅ Documentation: auto-document patterns

---

## Medium-Value Additions

### 5. Cross-Repository Linking (MEDIUM PRIORITY) ⭐

**What:** Link code across multiple repositories in a monorepo or microservices architecture.

**When useful:**
- Monorepos with multiple packages
- Microservices that share libraries
- Multi-root workspaces in VSCode

**Implementation:**

```typescript
class CrossRepoLinker {
  async linkRepositories(workspaces: string[]): Promise<void> {
    // Build unified index across all workspaces
    for (const workspace of workspaces) {
      await this.indexWorkspace(workspace)
    }

    // Link shared dependencies
    await this.linkSharedDependencies(workspaces)
  }

  private async linkSharedDependencies(workspaces: string[]) {
    // Find packages that are used across workspaces
    for (const workspace of workspaces) {
      const packageJson = await this.readPackageJson(workspace)
      const dependencies = packageJson.dependencies || {}

      for (const [dep, version] of Object.entries(dependencies)) {
        // Check if this dependency is another workspace
        const depWorkspace = workspaces.find(w =>
          this.getPackageName(w) === dep
        )

        if (depWorkspace) {
          // Create cross-repo link in Neo4j
          await this.createCrossRepoLink(workspace, depWorkspace, dep)
        }
      }
    }
  }
}
```

**Neo4j Schema:**
```cypher
// Link workspaces
CREATE (ws1:Workspace {path: $workspace1})
CREATE (ws2:Workspace {path: $workspace2})
CREATE (ws1)-[:DEPENDS_ON {package: $packageName}]->(ws2)

// Query: Find all workspaces that depend on a package
MATCH (ws:Workspace)-[:DEPENDS_ON {package: $packageName}]->(target:Workspace)
RETURN ws.path
```

**Benefits:**
- ✅ Understand dependencies across repos
- ✅ Find usages in other repos
- ✅ Impact analysis across services

---

tion Traces

**What:** Capture actual runtime call patterns, execution traces.

**Why not:**
- Requires running the code
- Not needed for static code understanding
- Too complex for Roo's use case
- Better suited for profiling tools

### ❌ Distributed Indexing

**What:** Scale indexing across multiple machines.

**Why not:**
- Roo is for single workspaces
- Even large codebases (1M+ lines) can be indexed on single machine
- Adds unnecessary complexity

### ❌ Multiple Database Systems

**What:** Use PostgreSQL + Redis + Neo4j + Qdrant.

**Why not:**
- Too complex to manage
- Qdrant + Neo4j is sufficient
- Redis caching can be done in-memory
- Keep it simple!

---

## Recommended Priority Order

### Phase 1: Core Improvements (Do First)
1. ✅ **System Prompt Enhancements** (from WORLD_CLASS_INDEX.md)
2. ✅ **BM25 Keyword Search** (this document)
3. ✅ **Neo4j Integration** (from NEO4J_INTEGRATION_PLAN.md)

### Phase 2: High-Value Additions
4. ✅ **LSP Integration** (this document)
5. ✅ **Enhanced Metadata** (f### 6. Specialized Embedding Models (LOW PRIORITY) ⭐

**What:** Use different embedding models for different types of content.

**Models:**
- **Code:** CodeBERT, GraphCodeBERT, StarCoder embeddings
- **Documentation:** General-purpose models (OpenAI, Cohere)
- **Tests:** Specialized test embeddings

**Why:**
- Code-specific models understand syntax better
- Documentation models understand natural language better
- Could improve retrieval quality

**But:**
- ❌ Adds complexity (multiple models to manage)
- ❌ Adds cost (multiple API calls)
- ❌ Adds latency (multiple embeddings to generate)
- ❌ Current single model might be good enough

**Recommendation:** Start with single model, add specialized models only if retrieval quality is insufficient.

---

## Not Recommended (Too Complex / Not Needed)

### ❌ Runtime Execurom WORLD_CLASS_INDEX.md)
6. ✅ **Hybrid Ranking** (from WORLD_CLASS_INDEX.md)

### Phase 3: Medium-Value Additions
7. ✅ **Test-to-Code Mapping** (this document)
8. ✅ **Pattern Detection** (this document)
9. ✅ **Query Intelligence** (from WORLD_CLASS_INDEX.md)

### Phase 4: Optional Enhancements
10. ⚠️ **Cross-Repo Linking** (if needed)
11. ⚠️ **Specialized Embeddings** (if quality insufficient)

---

## Summary

**From Claude's suggestions, we're adding:**

1. **BM25 Keyword Search** ⭐⭐⭐ - Complements vector search perfectly
2. **LSP Integration** ⭐⭐⭐ - Leverage VSCode's existing infrastructure
3. **Test-to-Code Mapping** ⭐⭐ - Link tests to code they test
4. **Pattern Detection** ⭐⭐ - Detect and follow codebase patterns

**We're skipping:**
- Runtime analysis (too complex)
- Distributed indexing (not needed)
- Multiple databases (keep it simple)
- Specialized embeddings (start simple)

**Combined with our previous plans:**
- System prompt improvements
- Neo4j graph database
- Enhanced metadata
- Hybrid ranking
- Query intelligence

**Result:** A comprehensive, world-class codebase index that's practical and achievable! 🚀


