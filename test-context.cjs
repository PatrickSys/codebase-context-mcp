// Quick test to see what the context resource generates
const fs = require('fs').promises;
const path = require('path');

async function generateCodebaseContext() {
  const ROOT_PATH = 'C:\\Users\\patrick.colom\\Repos\\SSP_Portal';
  const intelligencePath = path.join(ROOT_PATH, ".codebase-intelligence.json");

  try {
    const content = await fs.readFile(intelligencePath, "utf-8");
    const intelligence = JSON.parse(content);

    const lines = [];
    lines.push("# Codebase Intelligence");
    lines.push("");
    lines.push(
      "⚠️  CRITICAL: This is what YOUR codebase actually uses, not generic recommendations."
    );
    lines.push(
      "These are FACTS from analyzing your code, not best practices from the internet."
    );
    lines.push("");

    // Library usage - sorted by count
    const libraryEntries = Object.entries(intelligence.libraryUsage || {})
      .map(([lib, data]) => ({
        lib,
        count: data.count,
        category: data.category,
      }))
      .sort((a, b) => b.count - a.count);

    if (libraryEntries.length > 0) {
      lines.push("## Libraries Actually Used");
      lines.push("");

      const byCategory = {};
      for (const entry of libraryEntries) {
        const cat = entry.category || "other";
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(entry);
      }

      // UI libraries first
      if (byCategory.ui?.length) {
        lines.push("### UI Components (What THIS Codebase Uses)");
        for (const { lib, count } of byCategory.ui.slice(0, 5)) {
          lines.push(`- **${lib}** (${count} uses) → USE THIS, not generic alternatives`);
        }
        lines.push("");
      }

      // Custom/internal libraries
      if (byCategory.custom?.length) {
        lines.push("### Custom/Internal Libraries");
        for (const { lib, count } of byCategory.custom.slice(0, 5)) {
          lines.push(
            `- **${lib}** (${count} uses) - Internal library, import from here`
          );
        }
        lines.push("");
      }

      // State management
      if (byCategory.state?.length) {
        lines.push("### State Management");
        for (const { lib, count } of byCategory.state.slice(0, 3)) {
          lines.push(`- **${lib}** (${count} uses)`);
        }
        lines.push("");
      }

      // Framework
      const topFramework = byCategory.framework?.[0];
      if (topFramework && topFramework.count > 50) {
        lines.push(
          `**Framework:** ${topFramework.lib} (heavily used - ${topFramework.count}+ imports)`
        );
        lines.push("");
      }
    }

    // Pattern consensus
    if (intelligence.patterns && Object.keys(intelligence.patterns).length > 0) {
      lines.push("## YOUR Codebase's Actual Patterns (Not Generic Best Practices)");
      lines.push("");
      lines.push("These patterns were detected by analyzing your actual code.");
      lines.push("This is what YOUR team does in practice, not what tutorials recommend.");
      lines.push("");

      for (const [category, data] of Object.entries(intelligence.patterns)) {
        const patternData = data;
        const primary = patternData.primary;

        if (!primary) continue;

        const percentage = parseInt(primary.frequency);
        const categoryName = category
          .replace(/([A-Z])/g, " $1")
          .trim()
          .replace(/^./, (str) => str.toUpperCase());

        if (percentage === 100) {
          lines.push(`### ${categoryName}: **${primary.name}** (${primary.frequency} - unanimous)`);
          lines.push(`   → Your codebase is 100% consistent - ALWAYS use ${primary.name}`);
        } else if (percentage >= 80) {
          lines.push(`### ${categoryName}: **${primary.name}** (${primary.frequency} - strong consensus)`);
          lines.push(`   → Your team strongly prefers ${primary.name}`);
          if (patternData.alternatives?.length) {
            const alt = patternData.alternatives[0];
            lines.push(`   → Minority pattern: ${alt.name} (${alt.frequency}) - avoid for new code`);
          }
        } else if (percentage >= 60) {
          lines.push(`### ${categoryName}: **${primary.name}** (${primary.frequency} - majority)`);
          lines.push(`   → Most code uses ${primary.name}, but not unanimous`);
          if (patternData.alternatives?.length) {
            lines.push(
              `   → Alternative exists: ${patternData.alternatives[0].name} (${patternData.alternatives[0].frequency})`
            );
          }
        } else {
          // Split decision
          lines.push(`### ${categoryName}: ⚠️ NO TEAM CONSENSUS`);
          lines.push(`   Your codebase is split between multiple approaches:`);
          lines.push(`   - ${primary.name} (${primary.frequency})`);
          if (patternData.alternatives?.length) {
            for (const alt of patternData.alternatives.slice(0, 2)) {
              lines.push(`   - ${alt.name} (${alt.frequency})`);
            }
          }
          lines.push(`   → ASK the team which approach to use for new features`);
        }
        lines.push("");
      }
    }

    lines.push("---");
    lines.push(
      `Generated: ${intelligence.generatedAt || new Date().toISOString()}`
    );

    return lines.join("\n");
  } catch (error) {
    return (
      "# Codebase Intelligence\n\n" +
      "Intelligence data not yet generated. Run indexing first.\n" +
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

generateCodebaseContext().then(context => {
  console.log(context);
});
