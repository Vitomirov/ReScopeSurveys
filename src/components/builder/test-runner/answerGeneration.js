// ═══════════════════════════════════════════════════════════════════════════
// ANSWER GENERATION
// Produces a response map for the entire question set for a given branch.
// ═══════════════════════════════════════════════════════════════════════════

function offsetISODate(iso, days) {
  if (!iso) return new Date().toISOString().split('T')[0]
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function dateTriggerValue(operator, textValue, textValue2) {
  const today = new Date().toISOString().split('T')[0]
  switch (operator) {
    case 'is_answered':
      return textValue || today
    case 'is_not_answered':
      return ''
    case 'before':
    case 'less_than':
      return offsetISODate(textValue, -1)
    case 'less_or_equal':
      return textValue || today
    case 'after':
    case 'greater_than':
      return offsetISODate(textValue, 1)
    case 'greater_or_equal':
      return textValue || today
    case 'equals':
      return textValue || today
    case 'not_equals':
      return offsetISODate(textValue, 1)
    case 'between':
      return textValue || textValue2 || today
    case 'contains':
      return textValue || today
    case 'younger_than_years': {
      const years = parseInt(textValue, 10) || 18
      const d = new Date()
      d.setFullYear(d.getFullYear() - years + 1)
      return d.toISOString().slice(0, 10)
    }
    case 'older_than_years': {
      const years = parseInt(textValue, 10) || 18
      const d = new Date()
      d.setFullYear(d.getFullYear() - years - 1)
      return d.toISOString().slice(0, 10)
    }
    default:
      return textValue || today
  }
}

function sliderTriggerValue(operator, textValue, textValue2, q) {
  const cfg = q?.sliderConfig || {}
  const min = cfg.min ?? 0
  const max = cfg.max ?? 10
  const threshold = parseFloat(textValue)
  const end = parseFloat(textValue2)
  const hasThreshold = Number.isFinite(threshold)

  switch (operator) {
    case 'is_answered':
      return hasThreshold ? threshold : min
    case 'is_not_answered':
      return null
    case 'equals':
      return hasThreshold ? threshold : min
    case 'not_equals':
      return hasThreshold ? (threshold === min ? min + 1 : min) : min + 1
    case 'less_than':
      return hasThreshold ? Math.max(min, threshold - 1) : min
    case 'less_or_equal':
      return hasThreshold ? threshold : min
    case 'greater_than':
      return hasThreshold ? Math.min(max, threshold + 1) : max
    case 'greater_or_equal':
      return hasThreshold ? threshold : max
    case 'between':
      return hasThreshold ? threshold : (Number.isFinite(end) ? end : min)
    default:
      return hasThreshold ? threshold : min
  }
}

function safeAnswer(q, items) {
  switch (q.questionType) {
    case 'single_select':
    case 'dropdown': {
      const safe = (q.options || []).find(o => !o.terminates)
      return safe?.id || q.options?.[0]?.id || null
    }
    case 'multi_select': {
      const safe = (q.options || []).filter(o => !o.terminates)
      return (safe.length ? [safe[0].id] : [q.options?.[0]?.id]).filter(Boolean)
    }
    case 'open_text':    return 'Test response'
    case 'date':         return new Date().toISOString().split('T')[0]
    case 'phone':        return { country: 'GB', number: '7700900123' }
    case 'slider': {
      const cfg = q.sliderConfig
      return cfg.defaultValue ?? cfg.min
    }
    case 'constant_sum': {
      const cfg  = q.constantSumConfig
      const n    = cfg.items.length
      const base = Math.floor(cfg.targetSum / n)
      const rem  = cfg.targetSum - base * n
      return Object.fromEntries(
        cfg.items.map((item, i) => [item.id, String(base + (i === 0 ? rem : 0))])
      )
    }
    case 'matrix': {
      const cfg = q.matrixConfig
      if (cfg.subType === 'single')
        return Object.fromEntries(cfg.rows.map(r => [r.id, cfg.columns[0]?.id]))
      return Object.fromEntries(cfg.rows.map(r => [r.id, [cfg.columns[0]?.id].filter(Boolean)]))
    }
    case 'bipolar_matrix': {
      const cfg = q.bipolarConfig
      return Object.fromEntries(cfg.rows.map(r => [r.id, {
        left:   cfg.leftColumns[0]?.id  || null,
        center: null,
        right:  cfg.rightColumns[0]?.id || null,
      }]))
    }
    case 'maxdiff': {
      const cfg   = q.maxDiffConfig
      const items = cfg.items || []
      if (items.length < 2) return {}
      const numTrials = cfg.trialsPerRespondent || Math.max(3, Math.ceil(2 * items.length / (cfg.itemsPerTrial || 4)))
      const ans = {}
      for (let t = 0; t < numTrials; t++) {
        const k     = Math.min(cfg.itemsPerTrial || 4, items.length)
        const slice = items.slice(t % items.length, t % items.length + k)
        ans[t] = { best: slice[0]?.id || null, worst: slice[slice.length - 1]?.id || null }
      }
      return ans
    }
    case 'card_sort': {
      const cfg = q.cardSortConfig
      return {
        assignment: {
          uncategorized: [],
          ...Object.fromEntries(cfg.categories.map((c, ci) => [
            c.id, ci === 0 ? cfg.cards.map(cd => cd.id) : [],
          ])),
        },
      }
    }
    default: return null
  }
}

function triggerAnswer(q, branch, items) {
  switch (branch.type) {
    case 'terminate-option': {
      if (q.questionType === 'multi_select') return [branch.triggerOptionId]
      return branch.triggerOptionId
    }
    case 'terminate-rule-any': {
      const rule = (q.terminationRules || []).find(r => r.id === branch.triggerRuleId)
      if (!rule) return safeAnswer(q, items)
      if (rule.ruleType === 'text') {
        switch (rule.textOperator) {
          case 'contains':
          case 'equals':     return rule.textValue
          case 'not_contains': return 'completely unrelated answer'
          case 'not_equals': return `not ${rule.textValue}`
          case 'greater_than': return String(parseFloat(rule.textValue) + 1)
          case 'less_than':    return String(parseFloat(rule.textValue) - 1)
          default: return rule.textValue
        }
      }
      if (rule.ruleType === 'date' || q.questionType === 'date') {
        return dateTriggerValue(rule.textOperator, rule.textValue, rule.textValue2)
      }
      if (rule.ruleType === 'slider' || q.questionType === 'slider') {
        return sliderTriggerValue(rule.textOperator, rule.textValue, rule.textValue2, q)
      }
      if (rule.matchMode === 'all') {
        if (q.questionType === 'multi_select') return rule.optionIds
        return rule.optionIds[0] || safeAnswer(q, items)
      }
      if (q.questionType === 'multi_select') return [rule.optionIds[0]]
      return rule.optionIds[0] || safeAnswer(q, items)
    }
    case 'terminate-rule-none': {
      const rules  = q.terminationRules || []
      const qualIds = new Set(rules.flatMap(r => r.optionIds || []))
      const nonQual = (q.options || []).find(o => !qualIds.has(o.id))
      if (q.questionType === 'multi_select')
        return nonQual ? [nonQual.id] : []
      return nonQual?.id || q.options?.[0]?.id || null
    }
    default: return safeAnswer(q, items)
  }
}

function blockTriggerAnswers(block, items) {
  const overrides = {}
  const conds = block.conditions || []

  const firstGroup = []
  for (const c of conds) {
    if (c.join === 'OR' && firstGroup.length > 0) break
    firstGroup.push(c)
  }

  firstGroup.forEach(cond => {
    const q = items.find(i => i.id === cond.questionId)
    if (!q) return
    const isSingle = ['single_select', 'dropdown'].includes(q.questionType)
    const isMulti  = q.questionType === 'multi_select'
    const isText   = q.questionType === 'open_text'
    const isDate   = q.questionType === 'date'
    const isSlider = q.questionType === 'slider'

    if (isSingle || isMulti) {
      if (cond.conditionType === 'any_of') {
        overrides[q.id] = isMulti ? [cond.optionIds[0]] : cond.optionIds[0]
      } else if (cond.conditionType === 'all_of') {
        overrides[q.id] = isMulti ? cond.optionIds : cond.optionIds[0]
      } else if (cond.conditionType === 'none_of') {
        const safe = q.options.find(o => !cond.optionIds.includes(o.id))
        overrides[q.id] = isMulti ? (safe ? [safe.id] : []) : safe?.id || null
      }
    } else if (isSlider) {
      overrides[q.id] = sliderTriggerValue(cond.textOperator, cond.textValue, cond.textValue2, q)
    } else if (isDate) {
      overrides[q.id] = dateTriggerValue(cond.textOperator, cond.textValue, cond.textValue2)
    } else if (isText) {
      switch (cond.textOperator) {
        case 'contains':
        case 'equals':       overrides[q.id] = cond.textValue; break
        case 'not_contains': overrides[q.id] = 'unrelated answer'; break
        case 'not_equals':   overrides[q.id] = `not ${cond.textValue}`; break
        case 'greater_than': overrides[q.id] = String(parseFloat(cond.textValue) + 1); break
        case 'less_than':    overrides[q.id] = String(parseFloat(cond.textValue) - 1); break
        default:             overrides[q.id] = cond.textValue
      }
    }
  })

  return overrides
}

export function buildResponses(items, branch) {
  const questions = items.filter(i => i.itemType === 'question')

  const blockOverrides = branch.type === 'terminate-block'
    ? blockTriggerAnswers(
        items.find(i => i.id === branch.triggerBlockId),
        items
      )
    : {}

  const responses = {}
  questions.forEach(q => {
    if (blockOverrides[q.id] !== undefined) {
      responses[q.id] = blockOverrides[q.id]
    } else if (branch.triggerQuestionId === q.id) {
      responses[q.id] = triggerAnswer(q, branch, items)
    } else {
      responses[q.id] = safeAnswer(q, items)
    }
  })
  return responses
}
