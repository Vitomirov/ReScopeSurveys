// ─── Answer Validation ──────────────────────────────────────────────────────
// Single source of truth for per-question answer validation in the taker.
// Returns an error string, or null when the answer is valid.

import { isValidPhoneNumber } from 'libphonenumber-js'

export function validateAnswer(question, answer) {
  if (question.required && (answer === null || answer === undefined || answer === '' ||
    (Array.isArray(answer) && answer.length === 0))) {
    return 'This question is required.'
  }

  if (question.questionType === 'phone' && answer && !isValidPhoneNumber(answer)) {
    return 'Please enter a valid phone number for the selected country.'
  }
  if (question.questionType === 'open_text' && answer) {
    const v = question.openTextConfig?.validation
    if (v?.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answer))
      return 'Please enter a valid email address (e.g. name@example.com).'
    if (v?.type === 'url') {
      try { new URL(answer) } catch { return 'Please enter a valid URL (e.g. https://example.com).' }
    }
    if (v?.type === 'number') {
      const n = parseFloat(answer)
      if (isNaN(n)) return 'Please enter a number.'
      if (v.numberMin != null && n < v.numberMin) return `Value must be at least ${v.numberMin}.`
      if (v.numberMax != null && n > v.numberMax) return `Value must be at most ${v.numberMax}.`
    }
    const cfg = question.openTextConfig
    if (cfg?.minLength && answer.length < cfg.minLength) return `Minimum ${cfg.minLength} characters required.`
    if (cfg?.maxLength && answer.length > cfg.maxLength) return `Maximum ${cfg.maxLength} characters allowed.`
  }
  if (question.questionType === 'multi_select' && Array.isArray(answer)) {
    if (question.minSelections && answer.length < question.minSelections)
      return `Please select at least ${question.minSelections} option(s).`
    if (question.maxSelections && answer.length > question.maxSelections)
      return `Please select no more than ${question.maxSelections} option(s).`
  }
  if (question.questionType === 'slider') {
    if (question.required && (answer === null || answer === undefined)) {
      return 'Please move the slider to record your answer.'
    }
  }
  if (question.questionType === 'constant_sum') {
    const cfg   = question.constantSumConfig
    const items = cfg?.items || []
    const vals  = answer || {}
    const empty = items.filter(i => vals[i.id] === '' || vals[i.id] === undefined || vals[i.id] === null)
    if (empty.length) return `Please fill in all ${items.length} fields.`
    const hasNeg = items.some(i => parseFloat(vals[i.id]) < 0)
    if (hasNeg) return 'Values cannot be negative.'
    const sum  = items.reduce((a, i) => a + (parseFloat(vals[i.id]) || 0), 0)
    const diff = Math.abs(sum - cfg.targetSum)
    if (diff > 0.01) {
      const unit = cfg.unit ? ' ' + cfg.unit : ''
      return `Values must total ${cfg.targetSum}${unit}. Current total: ${sum.toFixed(cfg.allowDecimals ? 1 : 0)}${unit}.`
    }
  }
  if (question.questionType === 'nps') {
    if (question.required && (answer === null || answer === undefined))
      return 'Please select a score from 0 to 10.'
  }
  if (question.questionType === 'star_rating') {
    if (question.required && (answer === null || answer === undefined))
      return 'Please select a rating.'
  }
  if (question.questionType === 'ranking') {
    const cfg    = question.rankingConfig
    const rankAll = cfg?.rankAll !== false
    const topN   = rankAll ? (cfg?.items?.length || 0) : (cfg?.topN || 3)
    const placed  = Array.isArray(answer) ? answer.length : 0
    if (question.required && placed < topN)
      return `Please rank all ${topN} item${topN !== 1 ? 's' : ''} (${placed} of ${topN} placed).`
  }
  if (question.questionType === 'textbox_list') {
    if (question.required) {
      const cfg   = question.textboxListConfig
      const vals  = answer || {}
      const empty = (cfg?.rows || []).filter(r => !vals[r.id]?.trim())
      if (empty.length === cfg?.rows?.length) return 'Please fill in at least one field.'
    }
  }
  if (question.questionType === 'semantic_diff') {
    if (question.required) {
      const cfg      = question.semanticDiffConfig
      const vals     = answer || {}
      const unanswered = (cfg?.rows || []).filter(r => vals[r.id] == null && cfg?.defaultValue == null)
      if (unanswered.length > 0)
        return `Please respond to all ${cfg?.rows?.length} scales (${unanswered.length} remaining).`
    }
  }
  if (question.questionType === 'cascade') {
    if (question.required) {
      if (!answer?.l1) return 'Please select an option from all dropdowns.'
    }
  }
  if (question.questionType === 'image_choice_single') {
    if (question.required && !answer) return 'Please select an image.'
  }
  if (question.questionType === 'matrix') {
    const cfg = question.matrixConfig
    if (question.required) {
      const vals = answer || {}
      const unanswered = (cfg?.rows || []).filter(row => {
        const sel = vals[row.id]
        if (sel === null || sel === undefined) return true
        if (Array.isArray(sel)) return sel.length === 0
        return false
      })
      if (unanswered.length > 0) {
        return `Please answer all rows (${unanswered.length} remaining).`
      }
    }
  }
  if (question.questionType === 'image_choice_multi') {
    if (question.required && (!Array.isArray(answer) || answer.length === 0))
      return 'Please select at least one image.'
  }
  return null
}
