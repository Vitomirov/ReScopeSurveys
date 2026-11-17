/** Question display numbers — no UI imports (safe for the API image). */

/** Map question id → 1-based display number (single O(n) pass). */
export function buildQuestionNumberById(items) {
  const map = {}
  let n = 0
  for (const item of items || []) {
    if (item.itemType === 'question') {
      n++
      map[item.id] = n
    }
  }
  return map
}
