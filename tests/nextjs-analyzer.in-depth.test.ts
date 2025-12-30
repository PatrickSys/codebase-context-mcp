import { describe, expect, it } from "vitest";
import path from "path";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { NextJsAnalyzer } from "../src/analyzers/nextjs/index.js";

describe("NextJsAnalyzer (in-depth)", () => {
  it("canAnalyze detects Next imports even outside app/pages paths", () => {
    const analyzer = new NextJsAnalyzer();
    expect(analyzer.canAnalyze("/tmp/file.tsx", `import Link from "next/link";`)).toBe(true);
    expect(analyzer.canAnalyze("/tmp/file.tsx", `import { headers } from "next/headers";`)).toBe(true);
    expect(analyzer.canAnalyze("/tmp/file.tsx", `import React from "react";`)).toBe(false);
  });

  it("computes App Router route paths and ignores route groups/parallel segments", async () => {
    const analyzer = new NextJsAnalyzer();
    const filePath = path.join(process.cwd(), "app", "(marketing)", "@modal", "settings", "page.tsx");

    const code = `
export default function Page() { return <div />; }
`;

    const result = await analyzer.analyze(filePath, code);
    expect(result.metadata?.nextjs?.router).toBe("app");
    expect(result.metadata?.nextjs?.kind).toBe("page");
    expect(result.metadata?.nextjs?.routePath).toBe("/settings");
  });

  it("computes App Router dynamic route paths from folders", async () => {
    const analyzer = new NextJsAnalyzer();
    const filePath = path.join(process.cwd(), "app", "blog", "[id]", "page.tsx");

    const code = `
export default function Page() { return <div />; }
`;

    const result = await analyzer.analyze(filePath, code);
    expect(result.metadata?.nextjs?.router).toBe("app");
    expect(result.metadata?.nextjs?.routePath).toBe("/blog/[id]");
  });

  it("computes Pages Router index and API route paths", async () => {
    const analyzer = new NextJsAnalyzer();

    const pagesIndexPath = path.join(process.cwd(), "pages", "blog", "index.tsx");
    const apiPath = path.join(process.cwd(), "pages", "api", "health.ts");

    const code = `export default function Page() { return null; }`;

    const pagesIndex = await analyzer.analyze(pagesIndexPath, code);
    expect(pagesIndex.metadata?.nextjs?.router).toBe("pages");
    expect(pagesIndex.metadata?.nextjs?.kind).toBe("page");
    expect(pagesIndex.metadata?.nextjs?.routePath).toBe("/blog");

    const api = await analyzer.analyze(apiPath, code);
    expect(api.metadata?.nextjs?.router).toBe("pages");
    expect(api.metadata?.nextjs?.kind).toBe("api");
    expect(api.metadata?.nextjs?.routePath).toBe("/api/health");
  });

  it("requires \"use client\" as a top-of-file directive", async () => {
    const analyzer = new NextJsAnalyzer();
    const filePath = path.join(process.cwd(), "app", "settings", "page.tsx");

    const topOfFile = `
  "use client";
export default function Page() { return <div />; }
`;
    const notTopOfFile = `
import React from "react";
"use client";
export default function Page() { return <div />; }
`;

    const ok = await analyzer.analyze(filePath, topOfFile);
    expect(ok.metadata?.nextjs?.isClientComponent).toBe(true);

    const notOk = await analyzer.analyze(filePath, notTopOfFile);
    expect(notOk.metadata?.nextjs?.isClientComponent).toBe(false);
  });

  it("detects metadata exports (metadata / generateMetadata)", async () => {
    const analyzer = new NextJsAnalyzer();
    const filePath = path.join(process.cwd(), "app", "settings", "layout.tsx");

    const code = `
export const metadata = { title: "Settings" };
export async function generateMetadata() { return { title: "Settings 2" }; }
export default function Layout({ children }: { children: React.ReactNode }) { return <>{children}</>; }
`;

    const result = await analyzer.analyze(filePath, code);
    expect(result.metadata?.nextjs?.router).toBe("app");
    expect(result.metadata?.nextjs?.kind).toBe("layout");
    expect(result.metadata?.nextjs?.hasMetadata).toBe(true);
  });

  it("detectCodebaseMetadata infers router variant and loads index statistics", async () => {
    const analyzer = new NextJsAnalyzer();

    const tmpRoot = path.join(process.cwd(), "tests", ".tmp", `nextjs-${randomUUID()}`);
    await mkdir(tmpRoot, { recursive: true });

    try {
      await writeFile(
        path.join(tmpRoot, "package.json"),
        JSON.stringify(
          {
            name: "tmp-next",
            dependencies: {
              next: "^14.1.0",
              react: "^18.2.0",
              "react-dom": "^18.2.0",
              tailwindcss: "^3.4.0",
              zustand: "^4.5.0",
              vitest: "^1.3.0",
            },
          },
          null,
          2
        ),
        "utf-8"
      );

      await mkdir(path.join(tmpRoot, "app"), { recursive: true });
      await mkdir(path.join(tmpRoot, "pages"), { recursive: true });

      await writeFile(
        path.join(tmpRoot, ".codebase-index.json"),
        JSON.stringify(
          [
            { filePath: "app/page.tsx", startLine: 1, endLine: 10, componentType: "page", layer: "presentation" },
            { filePath: "pages/api/health.ts", startLine: 1, endLine: 5, componentType: "api", layer: "infrastructure" },
          ],
          null,
          2
        ),
        "utf-8"
      );

      const metadata = await analyzer.detectCodebaseMetadata(tmpRoot);
      expect(metadata.framework.type).toBe("nextjs");
      expect(metadata.framework.variant).toBe("hybrid");
      expect(metadata.framework.version).toBe("14.1.0");
      expect(metadata.framework.uiLibraries).toContain("Tailwind");
      expect(metadata.framework.stateManagement).toContain("zustand");
      expect(metadata.framework.testingFrameworks).toContain("Vitest");

      expect(metadata.statistics.totalFiles).toBe(2);
      expect(metadata.statistics.totalLines).toBe(15);
      expect(metadata.statistics.totalComponents).toBe(2);
      expect(metadata.statistics.componentsByType["page"]).toBe(1);
      expect(metadata.statistics.componentsByType["api"]).toBe(1);
    } finally {
      await rm(tmpRoot, { recursive: true, force: true });
    }
  });
});

