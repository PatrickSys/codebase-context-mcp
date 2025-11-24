# Codebase Context MCP

**Universal Model Context Protocol server with semantic codebase search**  
**Angular-first, framework-agnostic design**

A modular, plugin-based MCP server that indexes your codebase and provides intelligent semantic search for AI agents. Built with Angular as the first-class citizen, but designed to support any framework through a plugin architecture.

## 🎯 Key Features

- **🧩 Modular Plugin Architecture**: Framework-specific analyzers can be plugged in
- **🅰️ Angular-First**: Comprehensive Angular support with deep framework understanding
- **🔍 Semantic Search**: Find code by meaning, not just keywords
- **📊 Architectural Awareness**: Understands layers, patterns, and dependencies
- **📚 Style Guide Integration**: Smartly configurable .md files for code style and conventions
- **⚡ Incremental Indexing**: Only re-index changed files
- **🎨 Framework Detection**: Automatically detects Angular, React, Vue, or falls back to generic analysis
- **🏗️ Layer Detection**: Identifies presentation, business, data, state, core, shared layers
- **📦 Dependency Mapping**: Tracks which libraries and frameworks are used where
- **🔄 State Management Detection**: Identifies NgRx, Akita, Elf, Signals, RxJS state patterns

## 🏛️ Architecture

### Plugin System

The system is built around a **FrameworkAnalyzer** interface that all analyzers must implement:

```typescript
interface FrameworkAnalyzer {
  name: string;
  version: string;
  supportedExtensions: string[];
  priority: number;
  
  canAnalyze(filePath: string, content?: string): boolean;
  analyze(filePath: string, content: string): Promise<AnalysisResult>;
  detectCodebaseMetadata(rootPath: string): Promise<CodebaseMetadata>;
}
```

### Analyzers (Priority Order)

1. **AngularAnalyzer** (priority: 100) - Angular components, services, modules, directives, pipes, guards, interceptors
2. **ReactAnalyzer** (priority: 90) - React components, hooks, context [TODO]
3. **VueAnalyzer** (priority: 90) - Vue components, composables, stores [TODO]
4. **GenericAnalyzer** (priority: 10) - Fallback for any code

The system automatically selects the best analyzer based on file content and priority.

### Components

```
src/
├── core/                 # Core indexing engine
│   ├── indexer.ts       # Main indexing orchestrator
│   ├── search.ts        # Semantic search engine
│   └── analyzer-registry.ts # Plugin registry
├── analyzers/           # Framework-specific analyzers
│   ├── angular/         # Angular analyzer (COMPLETE)
│   ├── react/           # React analyzer (TODO)
│   ├── vue/             # Vue analyzer (TODO)
│   └── generic/         # Generic fallback (COMPLETE)
├── embeddings/          # Embedding providers
│   ├── openai.ts        # OpenAI embeddings
│   ├── voyage.ts        # Voyage embeddings
│   └── ollama.ts        # Local Ollama embeddings
├── storage/             # Vector database adapters
│   ├── lancedb.ts       # LanceDB (local, embedded)
│   ├── milvus.ts        # Milvus/Zilliz Cloud
│   └── chromadb.ts      # ChromaDB
├── config/              # Configuration management
├── utils/               # Utilities
│   ├── chunking.ts      # Smart code chunking
│   ├── language-detection.ts # Language detection
│   └── parsers.ts       # Code parsers
├── types/               # TypeScript types
│   └── index.ts         # Core type definitions
└── index.ts             # MCP server entry point
```

## 🅰️ Angular Support (Priority #1)

### What the Angular Analyzer Detects

#### Component Types
- ✅ **Components** - Full decorator metadata, inputs, outputs, lifecycle hooks
- ✅ **Services** - Injectable services with DI analysis
- ✅ **Directives** - Structural and attribute directives
- ✅ **Pipes** - Transform pipes with pure/impure detection
- ✅ **Modules** - NgModule declarations, imports, exports, providers
- ✅ **Guards** - Route guards (CanActivate, CanDeactivate, etc.)
- ✅ **Interceptors** - HTTP interceptors
- ✅ **Resolvers** - Route resolvers
- ✅ **Validators** - Form validators

#### Architectural Layers
- **Presentation** - Components, directives, pipes, views
- **Business** - Business logic services
- **Data** - HTTP services, repositories, data access
- **State** - State management (NgRx, Akita, Elf, Signals)
- **Core** - Guards, interceptors, app-wide services
- **Shared** - Shared utilities, components
- **Feature** - Feature modules and components

#### State Management Patterns
- **NgRx** - Store, actions, reducers, selectors, effects
- **Akita** - Stores, queries
- **Elf** - Stores with entities
- **Signals** - Angular Signals (signal, computed, effect)
- **RxJS State** - BehaviorSubject, ReplaySubject patterns
- **Service State** - Service-based state management

#### Dependencies & Libraries
- **Framework** - @angular/* packages
- **State** - State management libraries
- **UI** - Angular Material, PrimeNG, ng-bootstrap
- **Routing** - Router configuration
- **HTTP** - HttpClient services
- **Testing** - Jasmine, Karma, Jest

#### Code Quality Metrics
- Lines of code
- Cyclomatic complexity
- Maintainability index (TODO)
- Test coverage detection
- Anti-pattern detection (TODO)

### Example: Angular Component Analysis

```typescript
// Input: user-profile.component.ts
@Component({
  selector: 'app-user-profile',
  standalone: true,
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.scss']
})
export class UserProfileComponent implements OnInit, OnDestroy {
  @Input() userId!: string;
  @Output() profileUpdated = new EventEmitter<User>();
  
  constructor(
    private userService: UserService,
    private store: Store<AppState>
  ) {}
  
  ngOnInit() { /* ... */ }
  ngOnDestroy() { /* ... */ }
}

// Analyzer Output:
{
  name: "UserProfileComponent",
  type: "component",
  layer: "presentation",
  framework: "angular",
  decorators: ["Component"],
  inputs: ["userId"],
  outputs: ["profileUpdated"],
  lifecycle: ["ngOnInit", "ngOnDestroy"],
  dependencies: ["UserService", "Store"],
  isStandalone: true,
  statePattern: "ngrx"
}
```

## 📚 Style Guide Integration

The system intelligently parses and indexes style guides and documentation:

### Supported Formats
- **Markdown** (.md, .mdx) - Most common for style guides
- **README files** - Automatically detected and indexed
- **CONTRIBUTING.md** - Contribution guidelines
- **ARCHITECTURE.md** - Architecture documentation
- **Custom documentation** - Any .md file in docs/ folders

### Style Guide Features
- **Automatic Detection**: Finds style guides in common locations
- **Rule Extraction**: Parses rules with examples and anti-patterns
- **Categorization**: Groups rules by category (naming, structure, patterns)
- **Searchable**: Style guide content is semantically searchable
- **Context Injection**: AI agents can query "what's the style guide for components?"

### Example Style Guide Structure

```markdown
# Angular Style Guide

## Component Naming

**Rule**: Component classes should use PascalCase with "Component" suffix.

**Good Example**:
```typescript
export class UserProfileComponent { }
```

**Bad Example**:
```typescript
export class userProfile { } // Wrong case, missing suffix
```

**Category**: naming
**Severity**: error
```

The analyzer extracts:
- Rule title: "Component Naming"
- Description
- Code examples (good and bad)
- Category and severity
- Searchable by AI: "How should I name components?"

## 🚀 Installation

```bash
# Install the package
npm install -g @codebase-context/mcp

# Or use with npx
npx @codebase-context/mcp
```

## ⚙️ Configuration

### Option 1: Using Claude Code CLI

```bash
claude mcp add codebase-context \
  -e OPENAI_API_KEY=sk-your-key \
  -e STORAGE_PATH=./codebase-index \
  -- npx @codebase-context/mcp
```

### Option 2: Configuration File

Create `.codebase-context.json` in your project root:

```json
{
  "analyzers": {
    "angular": {
      "enabled": true,
      "priority": 100,
      "options": {
        "detectStandalone": true,
        "parseTemplates": true,
        "parseStyles": true
      }
    },
    "generic": {
      "enabled": true,
      "priority": 10
    }
  },
  "include": [
    "src/**/*.ts",
    "src/**/*.html",
    "src/**/*.scss"
  ],
  "exclude": [
    "node_modules/**",
    "dist/**",
    "**/*.spec.ts",
    "**/*.test.ts"
  ],
  "respectGitignore": true,
  "parsing": {
    "maxFileSize": 1048576,
    "chunkSize": 100,
    "chunkOverlap": 10,
    "parseTests": false
  },
  "styleGuides": {
    "autoDetect": true,
    "paths": [
      "STYLE_GUIDE.md",
      "docs/style-guide.md",
      "ARCHITECTURE.md"
    ]
  },
  "documentation": {
    "autoDetect": true,
    "includeReadmes": true,
    "includeChangelogs": false
  },
  "embedding": {
    "provider": "openai",
    "model": "text-embedding-3-small",
    "batchSize": 100
  },
  "storage": {
    "provider": "lancedb",
    "path": "./codebase-index"
  }
}
```

## 🔧 Usage with MCP Clients

### Claude Code

```bash
# Index your codebase
claude> Index this codebase for semantic search

# Check status
claude> What's the indexing status?

# Search
claude> Find all Angular components that handle user authentication

claude> Show me how state management is implemented

claude> What's the style guide for naming services?

claude> Find all HTTP services in the data layer
```

### Cursor IDE

```json
{
  "mcpServers": {
    "codebase-context": {
      "command": "npx",
      "args": ["@codebase-context/mcp"],
      "env": {
        "OPENAI_API_KEY": "sk-your-key",
        "STORAGE_PATH": "./codebase-index"
      }
    }
  }
}
```

## 🛠️ MCP Tools

### `index_codebase`
Index a codebase for semantic search.

**Parameters**:
- `path` (string): Root path of the codebase
- `force` (boolean, optional): Force re-indexing

**Returns**: Indexing statistics

### `search_codebase`
Search the indexed codebase semantically.

**Parameters**:
- `query` (string): Natural language search query
- `limit` (number, optional): Max results (default: 10)
- `filters` (object, optional): Filter by framework, layer, component type, etc.

**Returns**: Array of search results with code chunks

### `get_indexing_status`
Get current indexing progress.

**Returns**: Indexing progress information

### `clear_index`
Clear the codebase index.

**Parameters**:
- `path` (string): Root path of the codebase to clear

### `get_codebase_metadata`
Get comprehensive codebase metadata.

**Parameters**:
- `path` (string): Root path of the codebase

**Returns**: Framework info, dependencies, architecture, statistics

### `get_style_guide`
Get style guide information.

**Parameters**:
- `query` (string): Query for specific style guide rules

**Returns**: Relevant style guide rules and examples

## 🎯 Example Queries

### Angular-Specific

```typescript
// Find components by layer
"Find all presentation layer components"
"Show me data access services"

// Find by state management
"Find components using NgRx store"
"Show me all services with Signals"

// Find by pattern
"Find standalone components"
"Show me components with lifecycle hooks"

// Find by dependency
"Which components inject HttpClient?"
"Find all services that use RxJS operators"

// Style guide queries
"How should I structure feature modules?"
"What's the naming convention for services?"
```

### Generic Queries

```typescript
"Find functions that handle authentication"
"Show me all API endpoints"
"Find complex functions (high cyclomatic complexity)"
"Show me untested code"
```

## 🔌 Adding New Framework Analyzers

Want to add React, Vue, or another framework? It's easy!

1. **Create analyzer class**:

```typescript
// src/analyzers/react/index.ts
import { FrameworkAnalyzer } from '../types/index.js';

export class ReactAnalyzer implements FrameworkAnalyzer {
  readonly name = 'react';
  readonly version = '1.0.0';
  readonly supportedExtensions = ['.jsx', '.tsx'];
  readonly priority = 90;
  
  canAnalyze(filePath: string, content?: string): boolean {
    // Detection logic
  }
  
  async analyze(filePath: string, content: string): Promise<AnalysisResult> {
    // Analysis logic
  }
  
  async detectCodebaseMetadata(rootPath: string): Promise<CodebaseMetadata> {
    // Metadata detection
  }
}
```

2. **Register analyzer**:

```typescript
// src/core/analyzer-registry.ts
import { ReactAnalyzer } from '../analyzers/react/index.js';

registry.register(new ReactAnalyzer());
```

3. **Enable in config**:

```json
{
  "analyzers": {
    "react": {
      "enabled": true,
      "priority": 90
    }
  }
}
```

## 🗺️ Roadmap

### Phase 1: Core (✅ Complete)
- [x] Plugin architecture
- [x] Generic analyzer
- [x] Angular analyzer
- [x] Smart chunking
- [x] Language detection
- [x] Type system

### Phase 2: Storage & Embedding (🚧 In Progress)
- [ ] LanceDB integration
- [ ] OpenAI embeddings
- [ ] Milvus/Zilliz Cloud support
- [ ] Voyage AI embeddings
- [ ] Local Ollama embeddings

### Phase 3: MCP Server (🚧 In Progress)
- [ ] MCP protocol implementation
- [ ] Index codebase tool
- [ ] Semantic search tool
- [ ] Style guide tool
- [ ] Metadata tool

### Phase 4: Additional Analyzers (📋 Planned)
- [ ] React analyzer
- [ ] Vue analyzer
- [ ] Svelte analyzer
- [ ] Python analyzer (Django, Flask)

### Phase 5: Advanced Features (📋 Planned)
- [ ] Incremental indexing with change detection
- [ ] Code quality metrics (maintainability index)
- [ ] Anti-pattern detection
- [ ] Dependency graph visualization
- [ ] Cross-file relationship tracking

## 🤝 Contributing

We welcome contributions! The plugin architecture makes it easy to:

1. Add new framework analyzers
2. Improve existing analyzers
3. Add new embedding providers
4. Add new storage backends
5. Enhance code quality metrics

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Inspired by [claude-context](https://github.com/zilliztech/claude-context) by Zilliz
- Built for the Model Context Protocol (MCP) by Anthropic
- Angular team for comprehensive framework design
- All the amazing framework communities

---

**Built with ❤️ for AI-powered development**
