import { describe, expect, it } from "vitest"
import {
  filterPagesBySource,
  listPageSourceIdentities,
  normalizeSourceIdentity,
} from "./knowledge-source-filter"

const pages = [
  { title: "A", sources: ["BookA.pdf"] },
  { title: "Shared", sources: ["BookA.pdf", "folder/BookB.pdf"] },
  { title: "B", sources: ["raw/sources/folder/BookB.pdf"] },
  { title: "Manual", sources: [] },
]

describe("knowledge source filtering", () => {
  it("normalizes stored and project-relative source identities", () => {
    expect(normalizeSourceIdentity("raw\\sources\\Folder\\Book.pdf")).toBe("folder/book.pdf")
  })

  it("lists unique source identities in natural order", () => {
    expect(listPageSourceIdentities([
      ...pages,
      { title: "Duplicate", sources: ["booka.PDF"] },
      { title: "Later", sources: ["Book10.pdf", "Book2.pdf"] },
    ])).toEqual(["Book2.pdf", "Book10.pdf", "BookA.pdf", "folder/BookB.pdf"])
  })

  it("shows only pages linked to the selected source", () => {
    expect(filterPagesBySource(pages, "folder/bookb.PDF").map((page) => page.title)).toEqual([
      "Shared",
      "B",
    ])
    expect(filterPagesBySource(pages, null)).toEqual(pages)
  })
})
