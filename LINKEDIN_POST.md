# LinkedIn Post

I got tired of manually pointing Claude Code to files.

When I ask "find the authentication logic", it does a grep search. If my guard is called `SessionGuard` and my service is `IdentityService`, it doesn't find them. Cursor has semantic search, but it's cloud-based and doesn't work with Claude.

So I built an MCP server that fixes this.

It indexes your codebase locally using embeddings (Transformers.js + LanceDB), then exposes semantic search to any MCP client - Claude Code, Gemini CLI, Cursor, whatever you use.

For Angular projects, it goes further. It actually understands what a guard is, what layer a service belongs to, whether you're using signals or the old decorator syntax. It's not just matching text - it knows your architecture.

What I use it for daily:
→ "Find where we handle auth errors" - finds guards, interceptors, error services
→ "Show me data layer services" - returns HttpClient wrappers, not UI components  
→ "Where do we use signals?" - finds computed(), effect(), the new input() syntax

It runs 100% locally. No API keys, no cloud, your code stays on your machine.

This is v1.0. Angular-only for now, but the plugin system makes adding React/Vue straightforward. Open source (MIT), contributions welcome.

GitHub: https://github.com/PatrickSys/codebase-context-mcp

If you're using Claude Code on large codebases and getting frustrated with grep-based search, give it a try.

---

# Alternative (shorter version)

Built an MCP server because Claude Code can't find code by meaning - only by keywords.

Ask "find auth guards" → it greps for "auth" and "guard" as text
With this → it understands you want route guards handling authentication

It's semantic search that runs locally (no API keys), understands Angular architecture (components, services, layers), and works with any MCP client.

I use it daily on a 600+ file Angular monorepo. Makes the AI actually useful for navigating unfamiliar code.

v1.0 out now. MIT licensed.

https://github.com/PatrickSys/codebase-context-mcp

---

# Notes

- Add a screenshot or GIF showing a search result if possible
- Best posted Tuesday-Thursday morning
- Respond to comments quickly in the first 2 hours
