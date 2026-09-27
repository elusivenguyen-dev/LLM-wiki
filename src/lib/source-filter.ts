import type { FileNode } from "@/types/wiki"
import { normalizePath } from "@/lib/path-utils"

const HIDDEN_SOURCE_ENTRY_NAMES = new Set([".cache", ".DS_Store"])
const SENSITIVE_CONFIG_EXTENSIONS = new Set(["env", "json", "toml", "yaml", "yml", "xml"])
const SENSITIVE_CONFIG_DIR_NAMES = new Set([
  ".claude",
  ".codex",
  ".cursor",
  ".gemini",
  ".mcp",
])

export function isHiddenRawSourceEntryName(name: string): boolean {
  return HIDDEN_SOURCE_ENTRY_NAMES.has(name)
}

export function filterRawSourceTree(nodes: FileNode[]): FileNode[] {
  return nodes
    .filter((node) =>
      !isHiddenRawSourceEntryName(node.name) &&
      (node.is_dir || !isSensitiveConfigSourceFile(node.path))
    )
    .map((node) => {
      if (!node.is_dir) return node
      return { ...node, children: filterRawSourceTree(node.children ?? []) }
    })
    .filter((node) => !node.is_dir || (node.children && node.children.length > 0))
}

export function isSensitiveConfigSourceFile(path: string): boolean {
  const parts = normalizePath(path).split("/").filter(Boolean)
  const name = parts[parts.length - 1] ?? ""
  const ext = name.includes(".") ? name.split(".").pop()?.toLowerCase() : ""
  return Boolean(
    ext &&
      SENSITIVE_CONFIG_EXTENSIONS.has(ext) &&
      parts.some((part) => SENSITIVE_CONFIG_DIR_NAMES.has(part.toLowerCase())),
  )
}
