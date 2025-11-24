# Codebase Context MCP - Architecture

## System Overview

```mermaid
graph TB
    subgraph "MCP Server (index.ts)"
        MCP[MCP Server]
        Tools[MCP Tools]
        AutoIndex[Auto-Indexing on Startup]
    end

    subgraph "Core Engine"
        Indexer[Indexer]
        Searcher[Hybrid Searcher]
        Registry[Analyzer Registry]
    end

    subgraph "Analyzers (Framework-Agnostic)"
        Angular[Angular Analyzer]
        Generic[Generic Analyzer]
        Future[Future: React, Vue...]
    end

    subgraph "Storage & Embeddings"
        Transformers[Transformers.js<br/>bge-small-en-v1.5]
        LanceDB[(LanceDB<br/>Vector Store)]
        FuseJS[(Fuse.js<br/>Keyword Index)]
    end

    subgraph "AI Agent (Cursor/Claude)"
        Agent[AI Agent]
        Read[Read Tool]
    end

    Agent -->|search_codebase| Tools
    Tools --> Searcher
    Agent -->|If needs full code| Read

    MCP --> AutoIndex
    AutoIndex --> Indexer
    Indexer --> Registry
    Registry --> Angular
    Registry --> Generic

    Indexer -->|Generate embeddings| Transformers
    Indexer -->|Store vectors| LanceDB
    Indexer -->|Store chunks| FuseJS

    Searcher -->|Semantic search| LanceDB
    Searcher -->|Keyword search| FuseJS
    Searcher -->|Generate summaries| Registry
    Searcher -->|Word-limited snippets| Agent

    style MCP fill:#e1f5ff
    style Agent fill:#fff4e1
    style Angular fill:#dd0031
    style Generic fill:#gray
```

## Indexing Flow

```mermaid
sequenceDiagram
    participant Startup
    participant Indexer
    participant Analyzer
    participant Chunker
    participant Embeddings
    participant Storage

    Startup->>Indexer: Auto-index on startup
    Indexer->>Indexer: Scan files (glob patterns)

    loop For each file
        Indexer->>Analyzer: Detect framework
        Analyzer->>Analyzer: Parse AST
        Analyzer->>Chunker: Extract components
        Chunker->>Indexer: Return CodeChunks
    end

    Indexer->>Embeddings: Generate embeddings (batch)
    Embeddings->>Indexer: Return vectors

    Indexer->>Storage: Store in LanceDB
    Indexer->>Storage: Store in Fuse.js (JSON)

    Storage-->>Startup: Index ready
```

## Search Flow (New: Summary + Snippet)

```mermaid
sequenceDiagram
    participant Agent as AI Agent
    participant MCP as MCP Tool
    participant Searcher
    participant LanceDB
    participant Fuse
    participant Analyzer
    participant Agent2 as AI Agent

    Agent->>MCP: search_codebase("auth guards")
    MCP->>Searcher: search(query, limit=10)

    par Hybrid Search
        Searcher->>LanceDB: Semantic search (embeddings)
        LanceDB-->>Searcher: Vector results (70% weight)
    and
        Searcher->>Fuse: Keyword search
        Fuse-->>Searcher: Keyword results (30% weight)
    end

    Searcher->>Searcher: RRF score combination
    Searcher->>Searcher: Sort by score, take top N

    loop For each result
        Searcher->>Analyzer: summarize(chunk)
        Analyzer-->>Searcher: Summary (1-2 sentences)
        Searcher->>Searcher: Generate snippet (max 500 words)
    end

    Searcher-->>MCP: SearchResult[]<br/>{summary, snippet, filePath:lines}
    MCP-->>Agent2: JSON response

    Note over Agent2: Agent reads summary<br/>Applies pattern inline<br/>NO file writing!

    alt Needs full code
        Agent2->>Agent2: Use Read tool with filePath
    end
```

## Data Transformation Pipeline

```mermaid
flowchart LR
    subgraph Input
        File[Source File]
    end

    subgraph Analysis
        AST[Parse AST]
        Detect[Detect Components]
        Chunk[Create Chunks]
    end

    subgraph Enrichment
        Meta[Extract Metadata]
        Deps[Find Dependencies]
        Layer[Detect Layer]
    end

    subgraph Indexing
        Embed[Generate Embedding<br/>384-dim vector]
        Store1[(LanceDB)]
        Store2[(Fuse.js)]
    end

    subgraph Search
        Query[User Query]
        Hybrid[Hybrid Search]
        RRF[RRF Scoring]
    end

    subgraph Output
        Sum[Generate Summary<br/>Framework-aware]
        Snip[Generate Snippet<br/>500 words max]
        Result[SearchResult]
    end

    File --> AST --> Detect --> Chunk
    Chunk --> Meta --> Deps --> Layer
    Layer --> Embed --> Store1
    Layer --> Store2

    Query --> Hybrid --> RRF
    RRF --> Sum --> Snip --> Result

    Store1 -.-> Hybrid
    Store2 -.-> Hybrid

    style File fill:#e1f5ff
    style Result fill:#e8f5e9
    style Hybrid fill:#fff3e0
```

## Key Design Decisions

### 1. Auto-Indexing (Not Agent-Triggered)

```mermaid
flowchart TD
    Start[MCP Server Starts] --> Check{Index exists?}
    Check -->|No| Index[Start auto-indexing]
    Check -->|Yes| Ready[Mark as ready]
    Index --> Background[Index in background]
    Background --> Ready
    Ready --> Listen[Listen for agent requests]

    Listen --> Search[Agent calls search_codebase]
    Search --> Results[Return results immediately]

    style Start fill:#e1f5ff
    style Ready fill:#e8f5e9
    style Search fill:#fff3e0
```

**Why:**
- No latency waiting for agent
- Agent doesn't manage infrastructure
- Simpler mental model

### 2. Summarization Pipeline (Framework-Agnostic)

```mermaid
flowchart LR
    Chunk[CodeChunk] --> Check{Has framework?}
    Check -->|Yes| GetAnalyzer[Get framework analyzer]
    Check -->|No| Generic[Use generic analyzer]

    GetAnalyzer --> HasSum{Has summarize()?}
    HasSum -->|Yes| AngSum[Angular/React/Vue<br/>specific summary]
    HasSum -->|No| Generic

    AngSum --> Summary
    Generic --> Summary[Summary String]

    Summary --> Agent[To AI Agent]

    style Chunk fill:#e1f5ff
    style Summary fill:#e8f5e9
    style AngSum fill:#dd0031
    style Generic fill:#gray
```

**Example Outputs:**
- **Angular:** "Angular CanActivate guard 'RoleGuard' (selector: app-role) with ngOnInit, 2 inputs."
- **Generic:** "TypeScript class 'UserService' in user.service.ts."

### 3. Word Limits (Not Line Limits)

```mermaid
flowchart TD
    Content[Full Content] --> Split[Split by whitespace]
    Split --> Count{Words > 500?}
    Count -->|No| Return[Return full content]
    Count -->|Yes| Take[Take first 500 words]
    Take --> Append[Append truncation notice]
    Append --> Return2[Return truncated snippet]

    Return --> Agent
    Return2 --> Agent[To AI Agent]

    style Content fill:#e1f5ff
    style Agent fill:#fff4e1
```

**Why Words not Lines:**
- Lines vary wildly (1 word vs 200 words)
- Words are intuitive and consistent
- 500 words ≈ 1-2 screenfuls of code

## Old vs New Response Format

### ❌ Old (87KB dumps)

```json
{
  "results": [
    {
      "content": "... 2000 lines of code ...",
      "filePath": "src/guards/role.guard.ts",
      "score": 0.92
    }
  ]
}
```

**Problems:**
- Agent overwhelmed with data
- Writes to files instead of using inline
- Can't quickly understand what code does

### ✅ New (Concise summaries)

```json
{
  "results": [
    {
      "summary": "Angular CanActivate guard 'RoleGuard' protecting routes with role checks.",
      "snippet": "export class RoleGuard implements CanActivate {\n  constructor(private auth: AuthService) {}\n  canActivate() {\n    return this.auth.hasRole('admin');\n  }\n}",
      "filePath": "src/guards/role.guard.ts:15-45",
      "score": 0.92,
      "componentType": "guard",
      "layer": "core"
    }
  ],
  "hint": "Use Read tool with filePath for full code if needed"
}
```

**Benefits:**
- Agent reads summary first
- Sees pattern in snippet
- Applies inline immediately
- Only reads full file if needed

## Component Interaction Matrix

| Component | Reads From | Writes To | Key Responsibility |
|-----------|------------|-----------|-------------------|
| **MCP Server** | Agent requests | Agent responses | Tool orchestration, auto-indexing trigger |
| **Indexer** | File system | LanceDB, Fuse.js | Parse files → chunks → embeddings |
| **Analyzer Registry** | Analyzer plugins | Indexer | Route files to correct analyzer |
| **Angular Analyzer** | TypeScript AST | CodeChunks | Angular-specific parsing & summarization |
| **Generic Analyzer** | Code patterns | CodeChunks | Fallback for any language |
| **Searcher** | LanceDB, Fuse.js | SearchResults | Hybrid search + summarization |
| **Transformers.js** | Text chunks | Embeddings (384-dim) | Local embedding generation |
| **LanceDB** | Embeddings | Vector search results | Semantic similarity search |
| **Fuse.js** | JSON chunks | Keyword results | Fast keyword matching |

## File Structure

```
codebase-context-mcp-v2/
├── src/
│   ├── index.ts                 # MCP Server (auto-indexing, tools)
│   ├── core/
│   │   ├── indexer.ts           # File scanning → chunks → embeddings
│   │   ├── search.ts            # Hybrid search + summarization
│   │   └── analyzer-registry.ts # Analyzer plugin management
│   ├── analyzers/
│   │   ├── angular/index.ts     # Angular-specific logic + summarize()
│   │   └── generic/index.ts     # Generic fallback + summarize()
│   ├── embeddings/
│   │   └── transformers.ts      # Transformers.js provider
│   ├── storage/
│   │   └── lancedb.ts           # LanceDB vector storage
│   ├── types/index.ts           # Core interfaces (NEW: SearchResult)
│   └── utils/
│       ├── chunking.ts          # AST-aware code chunking
│       └── language-detection.ts
├── docs/
│   └── ARCHITECTURE.md          # This file
└── SPEC.md                      # High-level specification
```

## Success Metrics

| Metric | Target | Current Status |
|--------|--------|----------------|
| **Index Time** | < 3 min for 5K files | ✅ 75s for 614 files |
| **Search Latency** | < 500ms | ⏳ To measure |
| **Result Size** | < 5KB per result | ✅ ~500 words max |
| **Agent Behavior** | Uses inline, no file writes | 🎯 Testing needed |
| **Precision@5** | > 80% relevant | 🎯 Testing needed |
| **Memory Usage** | < 2GB during indexing | ✅ ~500MB |

## Next Steps

1. **Test with Cursor** - Verify agent doesn't write files
2. **Measure quality** - Are summaries helpful? Are snippets adequate?
3. **File watching** - Auto re-index on file changes
4. **Cache summaries** - Don't regenerate on every search
5. **More analyzers** - React, Vue, Python support
