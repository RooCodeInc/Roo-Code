# Neo4j Integration Plan - Local & Cloud Support

## Overview

Add Neo4j graph database support with the same flexibility as Qdrant: **local or cloud, optional and modular**.

---

## 1. Neo4j Deployment Options

### Local Neo4j
**Option A: Neo4j Desktop**
- Free desktop application
- Includes Neo4j Browser for visualization
- Easy setup for development
- Default: `bolt://localhost:7687`

**Option B: Docker**
```bash
docker run \
  --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  neo4j:latest
```

### Cloud Neo4j (Neo4j Aura)
**Neo4j AuraDB Free Tier:**
- ✅ Always free (not a trial!)
- ✅ Fully managed cloud database
- ✅ 200k nodes + 400k relationships
- ✅ Perfect for small-to-medium codebases
- ✅ Automatic backups
- 🔗 URL format: `neo4j+s://<instance-id>.databases.neo4j.io`

**Comparison to Qdrant Cloud:**
| Feature | Qdrant Cloud Free | Neo4j Aura Free |
|---------|------------------|-----------------|
| Storage | 1GB | 200k nodes |
| Always Free | ✅ | ✅ |
| Managed | ✅ | ✅ |
| Good for Code | ✅ | ✅ |

---

## 2. Modular Architecture (Optional Neo4j)

### Configuration Matrix

Users can choose any combination:

| Qdrant | Neo4j | Search Capabilities |
|--------|-------|-------------------|
| ✅ | ❌ | Semantic search only (current) |
| ❌ | ✅ | Structural search only (new) |
| ✅ | ✅ | Hybrid search (best!) |

### Implementation Strategy

**Service Factory Pattern:**
```typescript
class ServiceFactory {
  createSearchServices(config: CodeIndexConfig): SearchServices {
    const services: SearchServices = {}
    
    // Qdrant (optional)
    if (config.qdrantEnabled && config.qdrantUrl) {
      services.vectorStore = new QdrantVectorStore(config.qdrantUrl, config.qdrantApiKey)
      services.semanticSearch = new SemanticSearchService(services.vectorStore)
    }
    
    // Neo4j (optional)
    if (config.neo4jEnabled && config.neo4jUrl) {
      services.graphStore = new Neo4jGraphStore(config.neo4jUrl, config.neo4jAuth)
      services.structuralSearch = new StructuralSearchService(services.graphStore)
    }
    
    // Hybrid search (if both enabled)
    if (services.semanticSearch && services.structuralSearch) {
      services.hybridSearch = new HybridSearchService(
        services.semanticSearch,
        services.structuralSearch
      )
    }
    
    return services
  }
}
```

**Search Service Routing:**
```typescript
class SearchService {
  async searchIndex(query: string, path?: string): Promise<SearchResult[]> {
    // Determine available search strategies
    const hasQdrant = !!this.semanticSearch
    const hasNeo4j = !!this.structuralSearch
    
    if (!hasQdrant && !hasNeo4j) {
      throw new Error('No search backend configured')
    }
    
    // Route based on availability and query type
    if (hasQdrant && hasNeo4j) {
      // Hybrid search available
      return this.hybridSearch.search(query, path)
    } else if (hasQdrant) {
      // Semantic only
      return this.semanticSearch.search(query, path)
    } else {
      // Structural only
      return this.structuralSearch.search(query, path)
    }
  }
}
```

### Configuration Settings

```typescript
interface CodeIndexConfig {
  // Existing Qdrant settings
  qdrantEnabled?: boolean
  qdrantUrl?: string
  qdrantApiKey?: string
  
  // New Neo4j settings
  neo4jEnabled?: boolean
  neo4jUrl?: string              // bolt://localhost:7687 or neo4j+s://xxx.databases.neo4j.io
  neo4jUsername?: string         // default: neo4j
  neo4jPassword?: string         // stored in secrets
  neo4jDatabase?: string         // default: neo4j
  
  // Existing embedder settings
  embedderProvider?: EmbedderProvider
  // ... rest of config
}
```

**VSCode Settings UI:**
```json
{
  "roo.codebaseIndex.qdrant.enabled": true,
  "roo.codebaseIndex.qdrant.url": "http://localhost:6333",
  
  "roo.codebaseIndex.neo4j.enabled": true,
  "roo.codebaseIndex.neo4j.url": "bolt://localhost:7687",
  "roo.codebaseIndex.neo4j.username": "neo4j",
  "roo.codebaseIndex.neo4j.database": "neo4j"
}
```

**Secrets (VSCode Secret Storage):**
- `codeIndexQdrantApiKey` (existing)
- `codeIndexNeo4jPassword` (new)

---

## 3. Graphiti Analysis

### What is Graphiti?

**Graphiti** (by Zep AI) is a Python library that:
- Builds temporal knowledge graphs using LLMs
- Extracts entities and relationships from unstructured text
- Stores in Neo4j
- Provides hybrid retrieval (embeddings + BM25 + graph traversal)

### Should We Use Graphiti for Code Indexing?

**❌ NO - Not Recommended for Core Code Indexing**

**Reasons:**

1. **We Have Structured Data (AST)**
   - Tree-sitter gives us perfect structured extraction
   - No need for LLM to "guess" relationships
   - AST is 100% accurate, LLM extraction is probabilistic

2. **Cost & Latency**
   - Graphiti requires LLM calls for every file
   - Adds significant cost (API calls)
   - Slower indexing (LLM inference time)

3. **Accuracy**
   - AST-based extraction: 100% accurate
   - LLM-based extraction: ~90-95% accurate (hallucinations possible)

4. **Complexity**
   - Additional dependency (Python library, would need bridge)
   - More moving parts
   - Harder to debug

5. **Code-Specific Needs**
   - Graphiti designed for general knowledge graphs
   - Code has specific patterns (imports, calls, inheritance)
   - Better to build code-specific graph schema

### When Graphiti COULD Be Useful

**✅ Potential Use Cases (Future Enhancements):**

1. **Documentation Indexing**
   - Extract concepts from README, docs, comments
   - Build semantic relationships between documentation topics
   - Link docs to code via LLM understanding

2. **Architectural Knowledge**
   - Extract design patterns from code + comments
   - Build higher-level architectural graph
   - Track design decisions over time

3. **Cross-Cutting Concerns**
   - Security patterns
   - Error handling strategies
   - Performance optimizations

**Recommendation:** Start without Graphiti, add later if needed for documentation/architectural indexing.

---

## 4. Recommended Implementation Approach

### Phase 1: Direct Neo4j Integration (No Graphiti)

**Build graph from AST:**
```typescript
class CodeGraphBuilder {
  async buildGraph(filePath: string, ast: TreeSitterNode): Promise<GraphData> {
    const nodes: GraphNode[] = []
    const edges: GraphEdge[] = []
    
    // Extract symbols from AST
    const symbols = this.extractSymbols(ast)
    
    for (const symbol of symbols) {
      // Create node
      nodes.push({
        type: symbol.type,  // 'function', 'class', 'variable'
        name: symbol.name,
        filePath: filePath,
        startLine: symbol.startLine,
        endLine: symbol.endLine
      })
      
      // Extract relationships
      if (symbol.type === 'function') {
        // Find function calls
        const calls = this.extractCalls(symbol.node)
        edges.push(...calls.map(call => ({
          from: symbol.name,
          to: call.target,
          type: 'CALLS'
        })))
      }
      
      if (symbol.type === 'class') {
        // Find inheritance
        const extends = this.extractExtends(symbol.node)
        if (extends) {
          edges.push({
            from: symbol.name,
            to: extends,
            type: 'EXTENDS'
          })
        }
      }
    }
    
    return { nodes, edges }
  }
}
```

### Phase 2: Optional Graphiti for Docs (Future)

If we want to add documentation understanding later:
```typescript
class DocumentationIndexer {
  async indexDocumentation(docs: string[]): Promise<void> {
    // Use Graphiti for unstructured docs
    // Link to code graph via file references
  }
}
```

---

## 5. Configuration Examples

### Example 1: Qdrant Only (Current Behavior)
```json
{
  "qdrantEnabled": true,
  "qdrantUrl": "http://localhost:6333",
  "neo4jEnabled": false
}
```
**Result:** Semantic search only

### Example 2: Neo4j Only (Structural Search)
```json
{
  "qdrantEnabled": false,
  "neo4jEnabled": true,
  "neo4jUrl": "bolt://localhost:7687"
}
```
**Result:** Structural search only (no embeddings needed!)

### Example 3: Both (Hybrid - Recommended)
```json
{
  "qdrantEnabled": true,
  "qdrantUrl": "https://my-cluster.qdrant.io",
  "neo4jEnabled": true,
  "neo4jUrl": "neo4j+s://xxxxx.databases.neo4j.io"
}
```
**Result:** Best of both worlds!

---

## Summary

✅ **Neo4j Local + Cloud:** Use Neo4j Aura Free (always free, 200k nodes)  
✅ **Optional & Modular:** Users can enable Qdrant, Neo4j, or both  
❌ **Skip Graphiti:** Build graph directly from AST (faster, cheaper, more accurate)  
✅ **Same Tool Interface:** `codebase_search` works regardless of backend  

**Next Steps:**
1. Add `neo4j-driver` dependency
2. Implement `Neo4jGraphStore` class
3. Update configuration to support Neo4j settings
4. Build graph from tree-sitter AST
5. Test with local Neo4j, then Aura Free


