import { beforeEach, describe, expect, it } from "vitest"
import { hasActiveResearchRerun, useResearchStore, type ResearchTask } from "./research-store"

beforeEach(() => {
  useResearchStore.setState({ tasks: [], panelOpen: false, maxConcurrent: 3 })
})

describe("research store batch queue", () => {
  it("adds a large batch in one state update with review metadata intact", () => {
    let updates = 0
    const unsubscribe = useResearchStore.subscribe(() => { updates += 1 })

    const ids = useResearchStore.getState().addTasks(Array.from({ length: 100 }, (_, index) => ({
      topic: `Topic ${index}`,
      searchQueries: [`query ${index}`],
      sourceReviewId: `review-${index}`,
      rerunOfTaskId: index === 99 ? "research-original" : undefined,
    })))
    unsubscribe()

    expect(ids).toHaveLength(100)
    expect(updates).toBe(1)
    expect(useResearchStore.getState().tasks[99]).toMatchObject({
      topic: "Topic 99",
      searchQueries: ["query 99"],
      sourceReviewId: "review-99",
      rerunOfTaskId: "research-original",
      status: "queued",
    })
    expect(useResearchStore.getState().panelOpen).toBe(true)
  })

  it("does not update state for an empty batch", () => {
    expect(useResearchStore.getState().addTasks([])).toEqual([])
    expect(useResearchStore.getState().tasks).toEqual([])
  })
})

describe("research rerun lineage", () => {
  const task = (id: string, status: ResearchTask["status"], rerunOfTaskId?: string) => ({
    id,
    topic: id,
    status,
    rerunOfTaskId,
    webResults: [],
    synthesis: "",
    savedPath: null,
    error: null,
    createdAt: 1,
  }) satisfies ResearchTask

  it("blocks concurrent reruns started from any task in the same lineage", () => {
    const tasks = [
      task("original", "done"),
      task("rerun-1", "done", "original"),
      task("rerun-2", "searching", "rerun-1"),
    ]
    expect(hasActiveResearchRerun(tasks, "original")).toBe(true)
    expect(hasActiveResearchRerun(tasks, "rerun-1")).toBe(true)
  })

  it("does not block a different lineage or a completed rerun", () => {
    const tasks = [task("original", "done"), task("rerun", "done", "original")]
    expect(hasActiveResearchRerun(tasks, "original")).toBe(false)
    expect(hasActiveResearchRerun([...tasks, task("other", "queued")], "original")).toBe(false)
  })
})
