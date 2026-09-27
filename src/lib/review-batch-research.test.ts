import { describe, expect, it } from "vitest"
import type { ReviewItem } from "@/stores/review-store"
import { reviewResearchTopic, selectedResearchReviews } from "./review-batch-research"

function review(id: string, type: ReviewItem["type"], resolved = false): ReviewItem {
  return {
    id,
    type,
    title: `Topic ${id}`,
    description: "Description",
    options: [],
    resolved,
    createdAt: 1,
  }
}

describe("selectedResearchReviews", () => {
  it("keeps selected researchable pending reviews and skips active tasks", () => {
    const items = [
      review("a", "suggestion"),
      review("b", "missing-page"),
      review("c", "confirm"),
      review("d", "suggestion", true),
    ]

    expect(selectedResearchReviews(
      items,
      new Set(["a", "b", "c", "d"]),
      [{ sourceReviewId: "b", status: "searching" }],
    ).map((item) => item.id)).toEqual(["a"])
  })

  it("uses the description only when the title is empty", () => {
    expect(reviewResearchTopic({
      ...review("a", "suggestion"),
      title: " ",
      description: "First line\nSecond line",
    })).toBe("First line")
  })
})
