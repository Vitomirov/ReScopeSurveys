import { randomUUID } from 'node:crypto'

export function collectCodes(items) {
  const codes = new Set()
  const errors = []

  for (const item of items) {
    if (codes.has(item.code)) {
      errors.push({ code: 'DUPLICATE_CODE', message: `Duplicate item code: ${item.code}` })
    }
    codes.add(item.code)
    if (item.options) {
      for (const opt of item.options) {
        if (codes.has(opt.code)) {
          errors.push({ code: 'DUPLICATE_CODE', message: `Duplicate option code: ${opt.code}` })
        }
        codes.add(opt.code)
      }
    }
    for (const label of [...(item.matrixRows || []), ...(item.matrixColumns || [])]) {
      if (!label?.code) continue
      if (codes.has(label.code)) {
        errors.push({ code: 'DUPLICATE_CODE', message: `Duplicate matrix code: ${label.code}` })
      }
      codes.add(label.code)
    }
  }

  return { codes, errors }
}

/** Pass 1–2: map import codes to fresh UUIDs (append may pass existingIdMap to avoid collision). */
export function mapCodesToIds(items, { existingCodes = new Set() } = {}) {
  const codeToId = new Map()
  const errors = []

  for (const item of items) {
    if (existingCodes.has(item.code) && !codeToId.has(item.code)) {
      // Append remap: always assign new id for conflicting code
    }
    if (!codeToId.has(item.code)) {
      codeToId.set(item.code, randomUUID())
    }
    if (item.options) {
      for (const opt of item.options) {
        if (!codeToId.has(opt.code)) {
          codeToId.set(opt.code, randomUUID())
        }
      }
    }
    for (const label of [...(item.matrixRows || []), ...(item.matrixColumns || [])]) {
      if (label?.code && !codeToId.has(label.code)) {
        codeToId.set(label.code, randomUUID())
      }
    }
  }

  return { codeToId, errors }
}

export function existingItemCodes(items) {
  const set = new Set()
  for (const item of items || []) {
    // Runtime items use uuid ids, not codes — append uses remap only within import batch
    if (item?.id) set.add(item.id)
  }
  return set
}