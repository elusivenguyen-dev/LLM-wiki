import { describe, expect, it } from "vitest"

import { filterRawSourceTree, isSensitiveConfigSourceFile } from "./source-filter"
import type { FileNode } from "@/types/wiki"

describe("source-filter", () => {
  it("removes raw source cache noise without dropping user dotfolders", () => {
    const tree: FileNode[] = [
      {
        name: ".cache",
        path: "/project/raw/sources/.cache",
        is_dir: true,
        children: [
          { name: "source.pdf.txt", path: "/project/raw/sources/.cache/source.pdf.txt", is_dir: false },
        ],
      },
      { name: ".DS_Store", path: "/project/raw/sources/.DS_Store", is_dir: false },
      {
        name: ".claude",
        path: "/project/raw/sources/.claude",
        is_dir: true,
        children: [
          { name: "notes.md", path: "/project/raw/sources/.claude/notes.md", is_dir: false },
          { name: "settings.json", path: "/project/raw/sources/.claude/settings.json", is_dir: false },
        ],
      },
      {
        name: "empty-after-filter",
        path: "/project/raw/sources/empty-after-filter",
        is_dir: true,
        children: [
          { name: ".DS_Store", path: "/project/raw/sources/empty-after-filter/.DS_Store", is_dir: false },
        ],
      },
    ]

    expect(filterRawSourceTree(tree)).toEqual([
      {
        name: ".claude",
        path: "/project/raw/sources/.claude",
        is_dir: true,
        children: [
          { name: "notes.md", path: "/project/raw/sources/.claude/notes.md", is_dir: false },
        ],
      },
    ])
  })

  it("identifies config-like files that should not be imported from hidden tool folders", () => {
    expect(isSensitiveConfigSourceFile("/external/.claude/settings.json")).toBe(true)
    expect(isSensitiveConfigSourceFile("/external/.codex/config.yaml")).toBe(true)
    expect(isSensitiveConfigSourceFile("/external/.codex/config.toml")).toBe(true)
    expect(isSensitiveConfigSourceFile("/external/.cursor/rules.yml")).toBe(true)
    expect(isSensitiveConfigSourceFile("/external/.gemini/config.xml")).toBe(true)
    expect(isSensitiveConfigSourceFile("/external/.mcp/.env")).toBe(true)
    expect(isSensitiveConfigSourceFile("/external/.mcp/servers.json")).toBe(true)
    expect(isSensitiveConfigSourceFile("/external/.CLAUDE/Settings.JSON")).toBe(true)
    expect(isSensitiveConfigSourceFile("/external/data.json")).toBe(false)
    expect(isSensitiveConfigSourceFile("/external/.claude/research.md")).toBe(false)
  })
})
