# Quick Start Guide

Get up and running with Codebase Context MCP in 5 minutes!

## Prerequisites

- Node.js >= 20.0.0 and < 24.0.0
- An OpenAI API key (for embeddings)
- Claude Code, Cursor, or another MCP-compatible tool

## Installation

### Option 1: From Source (Development)

```bash
# Clone or copy the project
cd codebase-context-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Test it
node dist/index.js
```

### Option 2: Using NPX (Once Published)

```bash
npx @codebase-context/mcp
```

## Configuration

### For Claude Code

```bash
claude mcp add codebase-context \
  -e OPENAI_API_KEY=sk-your-api-key \
  -e STORAGE_PATH=./codebase-index \
  -- node /path/to/codebase-context-mcp/dist/index.js
```

### For Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "codebase-context": {
      "command": "node",
      "args": ["/path/to/codebase-context-mcp/dist/index.js"],
      "env": {
        "OPENAI_API_KEY": "sk-your-api-key",
        "STORAGE_PATH": "./codebase-index"
      }
    }
  }
}
```

## First Use

### 1. Index Your Codebase

In Claude Code or your MCP client:

```
Index this codebase
```

The system will:
- Scan all files
- Detect Angular (or other frameworks)
- Analyze components, services, etc.
- Extract metadata
- Create searchable chunks

### 2. Check Analyzer Info

```
What analyzers are registered?
```

You should see:
- **Angular Analyzer** (priority: 100)
- **Generic Analyzer** (priority: 10)

### 3. Get Codebase Metadata

```
Tell me about this codebase
```

For Angular projects, you'll see:
- Angular version
- State management (NgRx, Signals, etc.)
- UI libraries (Material, etc.)
- Architecture type
- Component statistics

### 4. Search Your Code

```
Find all Angular services in the business layer

Show me components that use NgRx

Find authentication-related code

Where is HttpClient used?
```

## Project Configuration

Create `.codebase-context.json` in your project:

```json
{
  "analyzers": {
    "angular": {
      "enabled": true,
      "priority": 100
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
    "**/*.spec.ts"
  ],
  "styleGuides": {
    "autoDetect": true,
    "paths": ["STYLE_GUIDE.md", "docs/style-guide.md"]
  }
}
```

## Example Queries

### Angular-Specific

```
1. "Find all standalone components"
2. "Show me services in the data layer"
3. "Which components use lifecycle hooks?"
4. "Find NgRx store implementations"
5. "Show me components with high complexity"
6. "Where is HttpClient injected?"
7. "Find all route guards"
8. "Show interceptor implementations"
```

### Generic

```
1. "Find authentication logic"
2. "Show API endpoints"
3. "Find error handling code"
4. "Where is logging implemented?"
5. "Show configuration files"
```

### Style Guide

```
1. "What's the naming convention for services?"
2. "How should I structure a feature module?"
3. "What are the component best practices?"
4. "Show me the testing guidelines"
```

## Verify It's Working

### Check Indexing

```typescript
// In your MCP client
use_mcp_tool('codebase-context', 'get_indexing_status', {
  path: '/path/to/your/project'
});

// Should return:
{
  "status": "complete",
  "filesProcessed": 340,
  "chunksCreated": 1523
}
```

### Check Metadata

```typescript
use_mcp_tool('codebase-context', 'get_codebase_metadata', {
  path: '/path/to/your/project'
});

// Should return detailed Angular metadata
```

## Troubleshooting

### "No analyzers found"

Make sure you built the project:
```bash
npm run build
```

### "Cannot find module"

Check your Node.js version:
```bash
node --version  # Should be >= 20 and < 24
```

### "Indexing fails"

Check file permissions and paths:
```bash
# Make sure the path exists and is readable
ls /path/to/your/project
```

### "Search returns no results"

**Note**: Search is not yet implemented in Phase 1. This is expected.
- Indexing works ✅
- Metadata detection works ✅
- Search will be implemented in Phase 2 🚧

## Current Status

### ✅ Working
- File scanning
- Angular component detection
- Service, directive, pipe, module detection
- Layer detection
- State management detection
- Metadata extraction
- Indexing statistics

### 🚧 In Progress (Phase 2)
- Embedding generation
- Vector storage
- Semantic search
- Style guide parsing

### 📋 Planned (Phase 3+)
- Incremental indexing
- Template/style parsing
- Code quality metrics
- Anti-pattern detection

## Next Steps

1. **Read the full README** - Learn about all features
2. **Check the AI Agent Guide** - Understand how AI should use it
3. **Explore examples** - See real usage patterns
4. **Read the TODO** - See what's coming next
5. **Contribute** - Help build Phase 2!

## Getting Help

- Check `docs/AI_AGENT_GUIDE.md` for detailed usage
- Review `docs/ARCHITECTURE_COMPARISON.md` to understand the design
- See `TODO.md` for what's implemented and what's not
- Open issues on GitHub (once published)

## Example Session

```
You: Index this Angular codebase
AI: [indexes project]
    Indexed 340 files, 1523 chunks
    Found 67 components, 45 services
    Detected NgRx state management
    
You: What analyzers are available?
AI: Angular Analyzer (priority: 100)
    Generic Analyzer (priority: 10)
    
You: Tell me about the architecture
AI: This is an Angular 18 project using:
    - Standalone components
    - NgRx for state management
    - Angular Material for UI
    - Feature-based architecture
    - 79 presentation layer components
    - 45 business layer services
    
You: Find authentication services
AI: [Note: Search not implemented yet]
    Once Phase 2 is complete, this will return
    all services related to authentication
```

## What Makes This Different?

Unlike generic code search tools, Codebase Context:

1. **Understands Angular** - Components, services, decorators, DI
2. **Knows Architecture** - Layers, patterns, structure
3. **Detects Patterns** - State management, routing, guards
4. **Integrates Styles** - Project-specific best practices
5. **Provides Context** - Rich metadata for AI agents

Ready to explore your codebase with AI? Let's go! 🚀
