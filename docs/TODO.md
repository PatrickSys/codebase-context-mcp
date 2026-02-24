Good. Here's the full picture — everything's been done in code, just not committed yet. Here's exactly what you
need to do, in order:

---

Step 1 — Build the dist (2 min)

cd /c/Users/bitaz/Repos/codebase-context
npm run build

This compiles the TypeScript changes (formatters, debug gating, %% fix) into dist/.

---

Step 2 — Take 2 screenshots (5 min each)

Run these against your angular-spotify codebase. The 2>/dev/null keeps output clean.

Screenshot A — pattern adoption (the money shot):
CODEBASE_ROOT=/c/Users/bitaz/Repos/angular-spotify node dist/index.js patterns 2>/dev/null
Shows: Constructor injection 84% ↓ Declining, inject() function 16% Stable, golden files, etc.

Screenshot B — decision card (edit-readiness proof):
CODEBASE_ROOT=/c/Users/bitaz/Repos/angular-spotify node dist/index.js search --query "how does auth work"  
 --intent edit 2>/dev/null
Shows: Ready to edit: YES/NO, patterns to follow/avoid, caller coverage, whatWouldHelp.

Save both to docs/assets/ as patterns-output.png and decision-card.png (or whatever names you like).

---

Step 3 — Uncomment the image in README (1 min)

Once screenshots exist, open README.md and find this block around line 21:

  <!-- Uncomment when docs/assets/preflight-example.png exists:
  ![Preflight example](./docs/assets/preflight-example.png)
  _Decision card showing caller coverage..._
  -->

Update the filename to match your actual screenshot and uncomment it.

---

Step 4 — Commit and publish (2 min)

cd /c/Users/bitaz/Repos/codebase-context
git add CHANGELOG.md README.md docs/capabilities.md package.json src/

# Do NOT add docs/MARKETING-AND-VISUALS.md or docs/assets/ — keep those local

git commit -m "docs: launch prep — CLI formatters, README rewrite, CHANGELOG cleanup"
npm version patch # bumps to 1.7.1
npm publish

---

Step 5 — Post (the actual launch)

From docs/MARKETING-AND-VISUALS.md, everything is ready to paste:

When: Thursday 6-9pm ET
Where: r/ClaudeAI
Title to use: Title A — "My AI writes correct code. Just not our code..."
────────────────────────────────────────
When: Same day or next
Where: r/cursor
Title to use: Short version, emphasize .cursor/mcp.json
────────────────────────────────────────
When: Same day or next
Where: r/CodingWithAI
Title to use: r/ClaudeAI copy, remove CLAUDE.md assumption
────────────────────────────────────────
When: 24-48hrs after ClaudeAI
Where: Show HN
Title to use: "Show HN: codebase-context – Gives AI agents pattern evidence..."
────────────────────────────────────────
When: Same day as HN
Where: r/LocalLLaMA
Title to use: Lead with offline/Tree-sitter/local embeddings
────────────────────────────────────────
When: Only if ClaudeAI >100 upvotes
Where: r/programming
Title to use: Lead with tech (RRF, Tree-sitter, cross-encoder)

---

Step 6 — Registry submissions (60 min, once, passive forever)

The 6 registries are in docs/MARKETING-AND-VISUALS.md. Submit to these in parallel with posting:

- https://modelcontextprotocol.io/registry/quickstart — highest value
- https://github.com/punkpeye/awesome-mcp-servers — PR to add entry
- https://smithery.ai/submit
- https://glama.ai/mcp/servers/submit
- mcpservers.org
- Gemini CLI extensions

---

The only thing that requires you right now: Build, take 2 screenshots, update the image path in README, then  
 commit + publish. The post copy is already written and waiting in docs/MARKETING-AND-VISUALS.md.
