import { normalizePath } from "@/lib/path-utils"

export interface SourceLinkedPage {
  sources: readonly string[]
}

export function normalizeSourceIdentity(source: string): string {
  return normalizePath(source)
    .replace(/^\.\//, "")
    .replace(/^raw\/sources\//i, "")
    .toLowerCase()
}

export function listPageSourceIdentities<T extends SourceLinkedPage>(pages: readonly T[]): string[] {
  const identities = new Map<string, string>()
  for (const page of pages) {
    for (const source of page.sources) {
      const trimmed = source.trim()
      const key = normalizeSourceIdentity(trimmed)
      if (key && !identities.has(key)) identities.set(key, trimmed)
    }
  }
  return [...identities.values()].sort((a, b) => a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base",
  }))
}

export function filterPagesBySource<T extends SourceLinkedPage>(
  pages: readonly T[],
  selectedSource: string | null,
): T[] {
  if (!selectedSource) return [...pages]
  const selectedIdentity = normalizeSourceIdentity(selectedSource)
  return pages.filter((page) =>
    page.sources.some((source) => normalizeSourceIdentity(source) === selectedIdentity),
  )
}
