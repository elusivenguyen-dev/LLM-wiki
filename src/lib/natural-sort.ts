const NATURAL_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
})

export function naturalCompare(a: string, b: string): number {
  const natural = NATURAL_COLLATOR.compare(a, b)
  if (natural !== 0) return natural
  if (a === b) return 0
  return a < b ? -1 : 1
}
