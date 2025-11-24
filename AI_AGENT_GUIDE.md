# AI Agent Usage Guide for Codebase Context MCP

This guide explains how AI agents should interact with the Codebase Context MCP to get the most value from Angular codebases (and other frameworks).

## Quick Start for AI Agents

### 1. Index the Codebase

```typescript
// First, index the codebase
await use_mcp_tool('codebase-context', 'index_codebase', {
  path: '/path/to/angular/project',
  force: false
});

// Response:
{
  "status": "success",
  "stats": {
    "totalFiles": 342,
    "indexedFiles": 340,
    "totalChunks": 1523,
    "componentsByType": {
      "component": 67,
      "service": 45,
      "directive": 12,
      "pipe": 8,
      "module": 15,
      "guard": 6,
      "interceptor": 3
    },
    "componentsByLayer": {
      "presentation": 79,
      "business": 45,
      "data": 18,
      "state": 12,
      "core": 9,
      "shared": 23
    }
  }
}
```

### 2. Get Codebase Metadata

```typescript
// Understand the codebase structure
await use_mcp_tool('codebase-context', 'get_codebase_metadata', {
  path: '/path/to/angular/project'
});

// Response:
{
  "framework": {
    "name": "Angular",
    "version": "18.2.0",
    "type": "angular",
    "variant": "standalone",
    "stateManagement": ["ngrx", "signals"],
    "uiLibraries": ["Angular Material"],
    "testingFrameworks": ["Jasmine", "Karma"]
  },
  "architecture": {
    "type": "feature-based",
    "patterns": ["MVVM", "Repository", "Facade"]
  },
  "dependencies": [/* ... */]
}
```

### 3. Semantic Search

```typescript
// Find specific components or patterns
await use_mcp_tool('codebase-context', 'search_codebase', {
  query: 'components that handle user authentication',
  limit: 5,
  filters: {
    componentType: 'component',
    layer: 'presentation'
  }
});
```

## Angular-Specific Queries

### Finding Components by Type

```typescript
// Find all services
query: "find all Angular services"
filters: { componentType: "service" }

// Find all guards
query: "show me all route guards"
filters: { componentType: "guard" }

// Find all interceptors
query: "find HTTP interceptors"
filters: { componentType: "interceptor" }

// Find all pipes
query: "show transform pipes"
filters: { componentType: "pipe" }
```

### Finding by Architectural Layer

```typescript
// Presentation layer (UI components)
query: "find all UI components"
filters: { layer: "presentation" }

// Business logic
query: "show business logic services"
filters: { layer: "business" }

// Data access layer
query: "find data access services"
filters: { layer: "data" }

// State management
query: "show state management code"
filters: { layer: "state" }

// Core services
query: "find core services and guards"
filters: { layer: "core" }

// Shared utilities
query: "show shared components and utilities"
filters: { layer: "shared" }
```

### Finding by State Management Pattern

```typescript
// NgRx
query: "find components using NgRx store"
// System detects: statePattern: "ngrx"

// Signals
query: "show components with Angular Signals"
// System detects: statePattern: "signals"

// Akita
query: "find Akita store implementations"
// System detects: statePattern: "akita"

// RxJS-based state
query: "show RxJS state management"
// System detects: statePattern: "rxjs-state"
```

### Finding by Features

```typescript
// Lifecycle hooks
query: "find components with ngOnDestroy"
filters: { tags: ["lifecycle:ngOnDestroy"] }

// Standalone components
query: "show standalone components"
filters: { tags: ["standalone"] }

// Components with tests
query: "find tested components"
filters: { tags: ["tested"] }

// High complexity
query: "show complex components"
filters: { tags: ["high-complexity"] }
```

### Finding Dependencies

```typescript
// HTTP usage
query: "which components use HttpClient?"

// Router usage
query: "find components with routing"

// Forms usage
query: "show components with reactive forms"

// Material components
query: "find components using Angular Material"
```

## Common AI Agent Workflows

### Workflow 1: Understanding a New Codebase

```typescript
// Step 1: Get metadata
const metadata = await get_codebase_metadata(path);

// Step 2: Identify key patterns
console.log(`Framework: ${metadata.framework.name} ${metadata.framework.version}`);
console.log(`State Management: ${metadata.framework.stateManagement.join(', ')}`);
console.log(`Architecture: ${metadata.architecture.type}`);

// Step 3: Find entry points
const modules = await search_codebase({
  query: "find root module or main component",
  filters: { componentType: "module" }
});

// Step 4: Explore layers
const presentation = await search_codebase({
  query: "presentation layer components",
  filters: { layer: "presentation" }
});
```

### Workflow 2: Finding Similar Implementations

```typescript
// User asks: "How do we implement authentication?"

// Step 1: Find auth-related code
const authCode = await search_codebase({
  query: "authentication login signup guards",
  limit: 10
});

// Step 2: Find related patterns
const authServices = await search_codebase({
  query: "authentication services",
  filters: { layer: "business", componentType: "service" }
});

const authGuards = await search_codebase({
  query: "authentication guards",
  filters: { componentType: "guard" }
});

// Step 3: Find state management for auth
const authState = await search_codebase({
  query: "authentication state user session",
  filters: { layer: "state" }
});
```

### Workflow 3: Refactoring Guidance

```typescript
// User asks: "How should I refactor this component?"

// Step 1: Find similar components
const similar = await search_codebase({
  query: "components similar to UserProfileComponent",
  limit: 5
});

// Step 2: Check style guide
const styleGuide = await get_style_guide({
  query: "component structure patterns",
  category: "structure"
});

// Step 3: Find best practices examples
const examples = await search_codebase({
  query: "well-structured components with lifecycle hooks",
  filters: { tags: ["low-complexity", "tested"] }
});
```

### Workflow 4: Adding New Features

```typescript
// User asks: "How do I add a new feature module?"

// Step 1: Find existing feature modules
const features = await search_codebase({
  query: "feature modules",
  filters: { componentType: "module", layer: "feature" }
});

// Step 2: Check architecture patterns
const metadata = await get_codebase_metadata(path);
console.log(`Patterns: ${metadata.architecture.patterns.join(', ')}`);

// Step 3: Get style guide
const guide = await get_style_guide({
  query: "feature module structure",
  category: "structure"
});

// Step 4: Find routing examples
const routing = await search_codebase({
  query: "feature routing lazy loading",
  limit: 3
});
```

## Query Best Practices for AI Agents

### Use Specific Angular Terminology

❌ Bad: "find files that do things with data"
✅ Good: "find services in the data layer that use HttpClient"

❌ Bad: "show UI stuff"
✅ Good: "find presentation layer components"

### Combine Multiple Filters

```typescript
// Instead of multiple queries, use filters
await search_codebase({
  query: "user management",
  filters: {
    componentType: "component",
    layer: "presentation",
    tags: ["tested", "low-complexity"]
  }
});
```

### Leverage Framework Knowledge

```typescript
// The system understands Angular patterns
query: "find components with OnPush change detection"
// System can detect this pattern

query: "show services with providedIn: 'root'"
// System extracts decorator metadata

query: "find components with async pipes"
// System analyzes template usage
```

### Use Layer-Based Thinking

When helping users, think in terms of layers:

- **Presentation** queries for UI-related questions
- **Business** queries for logic and workflows
- **Data** queries for API and database access
- **State** queries for state management
- **Core** queries for app-wide services
- **Shared** queries for reusable utilities

## Response Interpretation

### Understanding Search Results

```typescript
{
  "id": "a1b2c3d4",
  "content": "// Component code...",
  "filePath": "/src/app/features/user/profile.component.ts",
  "componentType": "component",
  "layer": "presentation",
  "framework": "angular",
  "score": 0.92,
  "metadata": {
    "componentName": "UserProfileComponent",
    "isStandalone": true,
    "inputs": ["userId"],
    "outputs": ["profileUpdated"],
    "lifecycle": ["ngOnInit", "ngOnDestroy"],
    "dependencies": ["UserService", "Store"],
    "statePattern": "ngrx",
    "complexity": 8
  }
}
```

AI agents should:
1. **Mention the score** (0.92 = highly relevant)
2. **Highlight the layer** (presentation = UI code)
3. **Explain dependencies** (uses UserService and NgRx)
4. **Note patterns** (standalone component, uses lifecycle hooks)
5. **Assess complexity** (8 = moderate complexity)

### Using Metadata for Context

```typescript
// Good AI response:
"I found a UserProfileComponent in the presentation layer. 
It's a standalone component (Angular 18+ pattern) that accepts 
a userId input and emits profileUpdated events. It uses NgRx 
for state management and has moderate complexity (8). The 
component implements ngOnInit and ngOnDestroy lifecycle hooks."
```

## Style Guide Integration

### Querying Style Guides

```typescript
// General queries
await get_style_guide({ query: "how to name components" });
await get_style_guide({ query: "service patterns" });
await get_style_guide({ query: "testing guidelines" });

// Category-specific
await get_style_guide({ 
  query: "naming conventions", 
  category: "naming" 
});

await get_style_guide({ 
  query: "component structure", 
  category: "structure" 
});
```

### Incorporating Style Guide Responses

AI agents should:
1. **Quote relevant rules** from the style guide
2. **Show good/bad examples** from the style guide
3. **Apply rules to the current context**

Example:
```
According to the project's style guide:

Rule: Components should use PascalCase with "Component" suffix

Good Example:
export class UserProfileComponent { }

Bad Example:
export class userProfile { }

For your new feature, you should name it: FeatureNameComponent
```

## Error Handling

### Codebase Not Indexed

```typescript
const status = await get_indexing_status(path);
if (status === 'not_indexed') {
  // Suggest indexing first
  await index_codebase({ path });
}
```

### No Results Found

```typescript
const results = await search_codebase({ query: "very specific thing" });
if (results.length === 0) {
  // Try broader query
  const broader = await search_codebase({ 
    query: "related broader topic" 
  });
}
```

### Framework Detection

```typescript
const metadata = await get_codebase_metadata(path);
if (metadata.framework?.name === 'Angular') {
  // Use Angular-specific queries
} else {
  // Fall back to generic queries
}
```

## Advanced Patterns

### Combining Multiple Sources

```typescript
// Get both code and style guide
const code = await search_codebase({ 
  query: "authentication implementation" 
});

const guide = await get_style_guide({ 
  query: "authentication patterns" 
});

// Synthesize both in response
// "Here's how authentication is implemented (from code)
//  and here's how it should be done according to the 
//  style guide..."
```

### Progressive Refinement

```typescript
// Start broad
let results = await search_codebase({ 
  query: "user management" 
});

// If too many results, refine
if (results.length > 10) {
  results = await search_codebase({
    query: "user management services",
    filters: { layer: "business" }
  });
}

// If still too many, refine more
if (results.length > 5) {
  results = await search_codebase({
    query: "user CRUD operations",
    filters: { 
      layer: "business",
      tags: ["tested"] 
    }
  });
}
```

### Context Building

```typescript
// Build comprehensive context for complex questions
const context = {
  metadata: await get_codebase_metadata(path),
  relevantCode: await search_codebase({ query }),
  styleGuide: await get_style_guide({ query }),
  similarPatterns: await search_codebase({ 
    query: "similar implementations",
    limit: 3 
  })
};

// Use all context to provide comprehensive answer
```

## Performance Tips

1. **Cache metadata**: Call `get_codebase_metadata` once per session
2. **Use filters**: Narrow searches with filters before making queries
3. **Limit results**: Use appropriate `limit` values (5-10 for most queries)
4. **Batch queries**: If you need multiple perspectives, make multiple calls
5. **Check status**: Use `get_indexing_status` before searching

## Summary

This MCP is designed to give AI agents **deep understanding** of codebases, especially Angular projects. By:

- Understanding framework-specific patterns
- Identifying architectural layers
- Detecting state management approaches
- Integrating style guides
- Providing semantic search

AI agents can give much more informed, context-aware assistance to developers.

The key is to **ask the right questions** using Angular terminology and architectural thinking.
