import { describe, expect, it } from "vitest"

import { naturalCompare } from "./natural-sort"

describe("naturalCompare", () => {
  it("sorts numbered filenames in human numeric order", () => {
    const names = ["100.md", "11.md", "1.md", "10.md", "file10.md", "2.md", "file2.md"]

    expect([...names].sort(naturalCompare)).toEqual([
      "1.md",
      "2.md",
      "10.md",
      "11.md",
      "100.md",
      "file2.md",
      "file10.md",
    ])
  })

  it("uses a deterministic fallback for natural ties", () => {
    const names = ["cafe.md", "Café.md", "1.md", "01.md"]

    expect([...names].sort(naturalCompare)).toEqual([
      "01.md",
      "1.md",
      "Café.md",
      "cafe.md",
    ])
  })

  it("sorts case-insensitively before applying the fallback", () => {
    const names = ["Beta.md", "alpha.md", "10.md", "2.md"]

    expect([...names].sort(naturalCompare)).toEqual([
      "2.md",
      "10.md",
      "alpha.md",
      "Beta.md",
    ])
  })
})
