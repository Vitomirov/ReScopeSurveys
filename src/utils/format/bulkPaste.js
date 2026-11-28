/**
 * Split clipboard text into list items for bulk-add.
 * Prefer newlines; if a single line, also split on commas / semicolons / tabs / pipes.
 */
export function splitBulkPasteValues(text) {
  const lines = String(text ?? '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
  if (lines.length > 1) return lines
  if (lines.length === 1) {
    const parts = lines[0].split(/[,;\t|]/).map(s => s.trim()).filter(Boolean)
    if (parts.length > 1) return parts
  }
  return lines
}
