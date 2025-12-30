import { describe, expect, it } from "vitest";
import path from "path";
import { ReactAnalyzer } from "../src/analyzers/react/index.js";

describe("ReactAnalyzer", () => {
  it("detects function components, custom hooks, and context usage", async () => {
    const analyzer = new ReactAnalyzer();
    const filePath = path.join(process.cwd(), "src", "components", "MyWidget.tsx");

    const code = `
import React, { createContext, useContext, useEffect, useMemo } from "react";

export const ThemeContext = createContext("light");

export function useTheme() {
  return useContext(ThemeContext);
}

export function MyWidget() {
  const theme = useTheme();
  useEffect(() => {}, []);
  const v = useMemo(() => theme, [theme]);
  return <div>{v}</div>;
}
`;

    const result = await analyzer.analyze(filePath, code);

    expect(result.framework).toBe("react");
    expect(result.components.some((c) => c.componentType === "component" && c.name === "MyWidget")).toBe(true);
    expect(result.components.some((c) => c.componentType === "hook" && c.name === "useTheme")).toBe(true);

    const patterns = (result.metadata?.detectedPatterns || []) as Array<{ category: string; name: string }>;
    expect(patterns.some((p) => p.category === "stateManagement" && p.name === "React Context")).toBe(true);
    expect(patterns.some((p) => p.category === "reactivity" && p.name === "Memoization")).toBe(true);
  });
});

