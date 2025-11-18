# Enhanced Codebase Search - Design Document

## Overview

This document outlines how to enhance Roo Code's codebase indexing with Neo4j while **maintaining the single `codebase_search` tool interface**.

---

## Current Architecture

```
codebase_search tool
    ↓
CodeIndexManager.searchIndex(query, path)
    ↓
SearchService.searchIndex()
    ↓
Embedder.createEmbeddings(query) → vector
    ↓
QdrantVectorStore.search(vector) → results
    ↓
Return SearchResult[]
```

**Limitations:**
- Only semantic similarity search
- No code structure understanding
- No relationship queries
- No cross-file navigation

---

## Enhanced Architecture (Hybrid Search)

```
codebase_search tool (SAME INTERFACE!)
    ↓
CodeIndexManager.searchIndex(query, path)
    ↓
SearchService.searchIndex()
    ↓
QueryAnalyzer.analyzeQuery(query)
    ├── Query Type: Semantic → Route to Qdrant
    ├── Query Type: Structural → Route to Neo4j
    └── Query Type: Hybrid → Route to Both
    ↓
Execute Search Strategy
    ├── SemanticSearch (Qdrant)
    │   ├── Embedder.createEmbeddings(query)
    │   └── QdrantVectorStore.search(vector)
    ├── StructuralSearch (Neo4j)
    │   ├── CypherQueryBuilder.buildQuery(query)
    │   └── Neo4jGraphStore.query(cypher)
    └── HybridSearch (Both)
        ├── Execute both searches in parallel
        └── ResultMerger.merge(semanticResults, structuralResults)
    ↓
Return SearchResult[] (SAME FORMAT!)
```

---

## Key Design Principles

### 1. **Backward Compatibility**
- Tool interface unchanged: `codebase_search(query, path?)`
- Return type unchanged: `SearchResult[]`
- Existing queries continue to work

### 2. **Intelligent Query Routing**

**Query Patterns → Search Strategy:**

| Query Pattern | Strategy | Backend |
|--------------|----------|---------|
| "authentication implementation" | Semantic | Qdrant |
| "all callers of function X" | Structural | Neo4j |
| "files that import module Y" | Structural | Neo4j |
| "payment processing code" | Hybrid | Both |
| "how does login work?" | Hybrid | Both |
| "class hierarchy for User" | Structural | Neo4j |
| "error handling patterns" | Semantic | Qdrant |

**Query Analyzer Logic:**
```typescript
class QueryAnalyzer {
  analyzeQuery(query: string): SearchStrategy {
    // Structural keywords
    if (query.match(/\b(caller|callee|import|extend|implement|inherit|depend)\b/i)) {
      return 'structural'
    }
    
    // Explicit relationship queries
    if (query.match(/\b(all|show|list|find)\s+(files|classes|functions)\s+(that|which)\b/i)) {
      return 'structural'
    }
    
    // Semantic queries (default)
    if (query.match(/\b(how|why|what|where|implement|pattern|example)\b/i)) {
      return 'hybrid'  // Use both for best results
    }
    
    return 'semantic'  // Default to semantic
  }
}
```

### 3. **Result Merging**

**Merge Strategy:**
```typescript
class ResultMerger {
  merge(semanticResults: SearchResult[], structuralResults: SearchResult[]): SearchResult[] {
    // 1. Combine results
    const combined = [...semanticResults, ...structuralResults]
    
    // 2. Deduplicate by file path + line range
    const deduped = this.deduplicateByLocation(combined)
    
    // 3. Re-rank using hybrid scoring
    const ranked = this.hybridRank(deduped, {
      semanticWeight: 0.6,
      structuralWeight: 0.4,
      recencyBoost: 0.1,
      frequencyBoost: 0.1
    })
    
    // 4. Limit to max results
    return ranked.slice(0, maxResults)
  }
}
```

### 4. **Dual Indexing**

**Indexing Pipeline:**
```
File Change Detected
    ↓
Parser.parseFile()
    ├── Extract Code Segments (for Qdrant)
    │   ├── Generate embeddings
    │   └── Upsert to Qdrant
    └── Extract Symbols & Relationships (for Neo4j)
        ├── Build graph nodes/edges
        └── Upsert to Neo4j
```

**What to Index in Each:**

**Qdrant (Semantic):**
- Code segments (functions, classes, blocks)
- Embeddings for similarity search
- Metadata: file, lines, content

**Neo4j (Structural):**
- Nodes: Files, Symbols (functions, classes, variables)
- Edges: IMPORTS, CALLS, EXTENDS, IMPLEMENTS, DEFINES, REFERENCES
- Properties: name, type, location, visibility

---

## Implementation Plan

### Phase 1: Add Neo4j Infrastructure
- [ ] Add `neo4j-driver` dependency
- [ ] Create `Neo4jGraphStore` class (similar to `QdrantVectorStore`)
- [ ] Implement graph schema (nodes, relationships)
- [ ] Add Neo4j configuration to settings

### Phase 2: Enhance Parser
- [ ] Extend `CodeParser` to extract symbols
- [ ] Extract relationships (imports, calls, etc.)
- [ ] Build graph data structures

### Phase 3: Dual Indexing
- [ ] Update `Orchestrator` to index to both stores
- [ ] Update `Scanner` to upsert to both Qdrant and Neo4j
- [ ] Update `FileWatcher` to update both stores

### Phase 4: Hybrid Search
- [ ] Create `QueryAnalyzer` for query classification
- [ ] Create `StructuralSearchService` for Neo4j queries
- [ ] Create `ResultMerger` for combining results
- [ ] Update `SearchService` to route queries

### Phase 5: Testing & Optimization
- [ ] Test backward compatibility
- [ ] Benchmark search performance
- [ ] Tune ranking algorithms
- [ ] Add telemetry

---

## Example Queries

### Before (Semantic Only)
```
Query: "all files that import express"
Result: Files with "import express" in content (may miss indirect imports)
```

### After (Hybrid)
```
Query: "all files that import express"
Analysis: Structural query detected
Neo4j Query: MATCH (f:File)-[:IMPORTS]->(m:Module {name: 'express'}) RETURN f
Result: All files with direct import relationships (accurate!)
```

---

## Benefits

✅ **Single tool interface** - No breaking changes  
✅ **Intelligent routing** - Best backend for each query  
✅ **Richer results** - Semantic + structural understanding  
✅ **Better accuracy** - Graph queries for precise relationships  
✅ **Extensible** - Easy to add more search strategies  
✅ **Backward compatible** - Existing queries still work  

---

## Configuration

**New Settings:**
```json
{
  "codebaseIndexNeo4jEnabled": true,
  "codebaseIndexNeo4jUrl": "bolt://localhost:7687",
  "codebaseIndexNeo4jUsername": "neo4j",
  "codebaseIndexSearchStrategy": "hybrid"  // "semantic" | "structural" | "hybrid" | "auto"
}
```

**Secrets:**
- `codeIndexNeo4jPassword` - Neo4j password

---

## Next Steps

1. Review this design with team
2. Prototype `QueryAnalyzer` to validate routing logic
3. Design Neo4j schema in detail
4. Implement Phase 1 (infrastructure)
5. Iterate on hybrid ranking algorithm


