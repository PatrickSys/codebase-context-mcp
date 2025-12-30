import { describe, expect, it } from "vitest";
import path from "path";
import { ReactAnalyzer } from "../src/analyzers/react/index.js";

describe("ReactAnalyzer (in-depth)", () => {
  it("canAnalyze uses content heuristics for non-JSX extensions", () => {
    const analyzer = new ReactAnalyzer();

    expect(analyzer.canAnalyze("/tmp/file.ts")).toBe(false);
    expect(analyzer.canAnalyze("/tmp/file.ts", `import React from "react";`)).toBe(true);
    expect(analyzer.canAnalyze("/tmp/file.js", `const React = require("react");`)).toBe(true);
    expect(analyzer.canAnalyze("/tmp/file.js", `React.createElement("div");`)).toBe(true);
    expect(analyzer.canAnalyze("/tmp/file.ts", `const el = <div />;`)).toBe(true);
  });

  it("detects multiple component styles, hooks, and library signals", async () => {
    const analyzer = new ReactAnalyzer();
    const filePath = path.join(process.cwd(), "src", "components", "DeepWidget.tsx");

    const code = `
import React, { Component, Suspense, createContext, useContext, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { configureStore } from "@reduxjs/toolkit";
import "tailwindcss";

export const ThemeContext = createContext("light");

export function use2FA() {
  const [x] = useState(0);
  return x;
}

export function NotAComponent() {
  return null;
}

export const ArrowWidget = () => {
  const theme = useContext(ThemeContext);
  const v = useMemo(() => theme, [theme]);
  return (
    <Suspense fallback={null}>
      <span>{v}</span>
    </Suspense>
  );
};

export class LegacyWidget extends Component {
  render() {
    return <div />;
  }
}

export function UsesLibs() {
  useForm();
  z.string();
  useQuery({ queryKey: ["k"], queryFn: async () => 1 });
  configureStore({ reducer: {} });
  return <div />;
}
`;

    const result = await analyzer.analyze(filePath, code);

    expect(result.framework).toBe("react");
    expect(result.components.some((c) => c.componentType === "hook" && c.name === "use2FA")).toBe(true);
    expect(result.components.some((c) => c.componentType === "component" && c.name === "ArrowWidget")).toBe(true);
    expect(result.components.some((c) => c.componentType === "component" && c.name === "LegacyWidget")).toBe(true);
    expect(result.components.some((c) => c.name === "NotAComponent")).toBe(false);

    const patterns = (result.metadata?.detectedPatterns || []) as Array<{ category: string; name: string }>;
    expect(patterns.some((p) => p.category === "stateManagement" && p.name === "React Context")).toBe(true);
    expect(patterns.some((p) => p.category === "reactivity" && p.name === "Suspense")).toBe(true);
    expect(patterns.some((p) => p.category === "reactivity" && p.name === "Memoization")).toBe(true);
    expect(patterns.some((p) => p.category === "reactHooks" && p.name === "Custom hooks")).toBe(true);
    expect(patterns.some((p) => p.category === "reactHooks" && p.name === "Built-in hooks")).toBe(true);

    expect(patterns.some((p) => p.category === "forms" && p.name === "react-hook-form")).toBe(true);
    expect(patterns.some((p) => p.category === "validation" && p.name === "zod")).toBe(true);
    expect(patterns.some((p) => p.category === "data" && p.name === "tanstack-query")).toBe(true);
    expect(patterns.some((p) => p.category === "stateManagement" && p.name === "redux-toolkit")).toBe(true);
    expect(patterns.some((p) => p.category === "styling" && p.name === "tailwind")).toBe(true);

    const byName = new Map(result.dependencies.map((d) => [d.name, d.category] as const));
    expect(byName.get("react")).toBe("framework");
    expect(byName.get("@reduxjs/toolkit")).toBe("state");
    expect(byName.get("@tanstack/react-query")).toBe("http");
    expect(byName.get("zod")).toBe("other");
    expect(byName.get("react-hook-form")).toBe("other");
    expect(byName.get("tailwindcss")).toBe("ui");
  });
});

