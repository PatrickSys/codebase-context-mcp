import { describe, expect, it } from "vitest";
import path from "path";
import { NextJsAnalyzer } from "../src/analyzers/nextjs/index.js";

describe("NextJsAnalyzer", () => {
  it("detects App Router page routing and \"use client\"", async () => {
    const analyzer = new NextJsAnalyzer();
    const filePath = path.join(process.cwd(), "app", "settings", "page.tsx");

    const code = `
"use client";
export const metadata = { title: "Settings" };
export default function Page() { return <div />; }
`;

    const result = await analyzer.analyze(filePath, code);
    expect(result.framework).toBe("nextjs");
    expect(result.metadata?.nextjs?.router).toBe("app");
    expect(result.metadata?.nextjs?.routePath).toBe("/settings");
    expect(result.metadata?.nextjs?.isClientComponent).toBe(true);
    expect(result.metadata?.nextjs?.hasMetadata).toBe(true);
  });

  it("computes Pages Router dynamic route paths from filenames", async () => {
    const analyzer = new NextJsAnalyzer();
    const filePath = path.join(process.cwd(), "pages", "blog", "[id].tsx");

    const code = `
export default function BlogPost() { return null; }
`;

    const result = await analyzer.analyze(filePath, code);
    expect(result.metadata?.nextjs?.router).toBe("pages");
    expect(result.metadata?.nextjs?.routePath).toBe("/blog/[id]");
  });

  it("does not treat _app/_document/_error as routes in Pages Router", async () => {
    const analyzer = new NextJsAnalyzer();
    const filePath = path.join(process.cwd(), "pages", "_app.tsx");

    const code = `
export default function App() { return null; }
`;

    const result = await analyzer.analyze(filePath, code);
    expect(result.metadata?.nextjs?.router).toBe("pages");
    expect(result.metadata?.nextjs?.routePath).toBe(null);
    expect(result.metadata?.nextjs?.kind).toBe("unknown");
  });
});
