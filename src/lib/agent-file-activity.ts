import type { ChatAgentFileChange } from "@/lib/chat-agent-types"

const MAX_DIFF_LINES = 240
const MAX_DIFF_CHARS = 48_000

function splitLines(value: string): string[] {
  if (value.length === 0) return []
  return value.replace(/\r\n/g, "\n").split("\n")
}

/**
 * Build a bounded, display-oriented diff without retaining duplicate full file
 * bodies in persisted chat history. Agent writes commonly replace a complete
 * generated file or append one chunk, so a common-prefix/common-suffix hunk is
 * both deterministic and substantially cheaper than an unbounded LCS matrix.
 */
export function summarizeAgentFileChange(input: {
  id: string
  path: string
  tool: string
  beforeContent: string | null
  afterContent: string
  timestamp?: number
}): ChatAgentFileChange {
  const before = splitLines(input.beforeContent ?? "")
  const after = splitLines(input.afterContent)
  let prefix = 0
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) {
    prefix += 1
  }
  let suffix = 0
  while (
    suffix < before.length - prefix
    && suffix < after.length - prefix
    && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1
  }

  const removed = before.slice(prefix, before.length - suffix)
  const added = after.slice(prefix, after.length - suffix)
  const diffLines = [
    `@@ -${prefix + 1},${removed.length} +${prefix + 1},${added.length} @@`,
    ...removed.map((line) => `-${line}`),
    ...added.map((line) => `+${line}`),
  ]
  let diff = diffLines.slice(0, MAX_DIFF_LINES).join("\n")
  if (diffLines.length > MAX_DIFF_LINES) diff += "\n… diff truncated"
  if (diff.length > MAX_DIFF_CHARS) diff = `${diff.slice(0, MAX_DIFF_CHARS)}\n… diff truncated`

  return {
    id: input.id,
    path: input.path,
    tool: input.tool,
    operation: input.beforeContent === null ? "created" : "modified",
    additions: added.length,
    deletions: removed.length,
    diff,
    timestamp: input.timestamp ?? Date.now(),
    // Runtime-only rollback snapshot. persist.ts strips this field before disk
    // serialization; after restart the audit row remains but Undo is disabled.
    beforeContent: input.beforeContent,
    afterContent: input.afterContent,
  }
}

export function mergeAgentFileChange(
  previous: ChatAgentFileChange | undefined,
  next: ChatAgentFileChange,
): ChatAgentFileChange {
  if (!previous) return next
  return {
    ...next,
    id: previous.id,
    operation: previous.operation,
    beforeContent: previous.beforeContent,
    afterContent: next.afterContent,
  }
}

export interface AgentFileChangeGroup {
  path: string
  edits: ChatAgentFileChange[]
  additions: number
  deletions: number
}

/** Preserve first-seen file and edit order so the activity timeline matches
 * execution order while aggregating per-file totals for quick review. */
export function groupAgentFileChanges(
  changes: readonly ChatAgentFileChange[],
): AgentFileChangeGroup[] {
  const byPath = new Map<string, ChatAgentFileChange[]>()
  for (const change of changes) {
    const edits = byPath.get(change.path) ?? []
    edits.push(change)
    byPath.set(change.path, edits)
  }
  return [...byPath.entries()].map(([path, edits]) => ({
    path,
    edits,
    additions: edits.reduce((sum, edit) => sum + edit.additions, 0),
    deletions: edits.reduce((sum, edit) => sum + edit.deletions, 0),
  }))
}
