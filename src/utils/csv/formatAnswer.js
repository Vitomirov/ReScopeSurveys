import { COMPANION_SEP, MULTI_SEP } from './constants'
import { formatPhoneAnswer } from '../format/phoneSurveyFormat.js'

/** Format one question's answer into a cell string for response export. */
export function formatAnswer(question, responses, companions) {
  const qId    = question.id
  const answer = responses[qId]
  const cmp    = companions?.[qId] || {}

  switch (question.questionType) {

    case 'single_select':
    case 'dropdown': {
      if (!answer) return ''
      const opt = question.options?.find(o => o.id === answer)
      if (!opt) return ''
      return cmp[answer] ? `${opt.text}${COMPANION_SEP}${cmp[answer]}` : opt.text
    }

    case 'multi_select': {
      if (!Array.isArray(answer) || !answer.length) return ''
      return answer
        .map(id => {
          const opt = question.options?.find(o => o.id === id)
          if (!opt) return null
          return cmp[id] ? `${opt.text}${COMPANION_SEP}${cmp[id]}` : opt.text
        })
        .filter(Boolean)
        .join(MULTI_SEP)
    }

    case 'open_text': return answer ?? ''
    case 'date':      return answer ?? ''
    case 'phone':     return formatPhoneAnswer(answer)
    case 'slider':    return answer != null ? String(answer) : ''

    case 'constant_sum': {
      const cfg  = question.constantSumConfig
      const vals = answer || {}
      if (!cfg?.items?.length) return ''
      return cfg.items
        .map(item => `${item.label}:${vals[item.id] ?? 0}`)
        .join(MULTI_SEP)
    }

    case 'matrix': {
      const cfg  = question.matrixConfig
      const vals = answer || {}
      if (!cfg?.rows?.length) return ''
      return cfg.rows
        .map(row => {
          const sel = vals[row.id]
          if (!sel) return `${row.text}:-`
          if (cfg.subType === 'single') {
            const col = cfg.columns?.find(c => c.id === sel)
            return `${row.text}:${col?.text ?? sel}`
          }
          const cols = (Array.isArray(sel) ? sel : [])
            .map(cId => cfg.columns?.find(c => c.id === cId)?.text ?? cId)
            .join(',')
          return `${row.text}:${cols || '-'}`
        })
        .join(MULTI_SEP)
    }

    case 'bipolar_matrix': {
      const cfg  = question.bipolarConfig
      const vals = answer || {}
      if (!cfg?.rows?.length) return ''
      return cfg.rows
        .map(row => {
          const rv     = vals[row.id] || {}
          const left   = rv.left
          const right  = rv.right
          const center = rv.center

          const resolveLeft  = (id) => cfg.leftColumns?.find(c => c.id === id)?.text ?? id
          const resolveRight = (id) => cfg.rightColumns?.find(c => c.id === id)?.text ?? id

          const leftStr = !left ? '-'
            : Array.isArray(left) ? left.map(resolveLeft).join(',')
            : resolveLeft(left)

          const rightStr = !right ? '-'
            : Array.isArray(right) ? right.map(resolveRight).join(',')
            : resolveRight(right)

          const centerStr = cfg.showCenter && center
            ? `,C:${cfg.centerLabel || 'Neutral'}`
            : ''

          return `${row.text}:L=${leftStr},R=${rightStr}${centerStr}`
        })
        .join(MULTI_SEP)
    }

    case 'maxdiff': {
      const cfg  = question.maxDiffConfig
      const vals = answer || {}
      const keys = Object.keys(vals).sort((a, b) => +a - +b)
      if (!keys.length) return ''
      return keys
        .map(ti => {
          const t     = vals[ti] || {}
          const best  = cfg.items?.find(i => i.id === t.best)?.text  ?? '-'
          const worst = cfg.items?.find(i => i.id === t.worst)?.text ?? '-'
          return `T${+ti + 1}:Best=${best},Worst=${worst}`
        })
        .join(MULTI_SEP)
    }

    case 'card_sort': {
      const cfg        = question.cardSortConfig
      const assignment = answer?.assignment || {}
      if (!cfg?.cards?.length) return ''
      return cfg.cards
        .map(card => {
          const catId = Object.keys(assignment).find(k =>
            Array.isArray(assignment[k]) && assignment[k].includes(card.id)
          )
          const catLabel = !catId || catId === 'uncategorized'
            ? 'Unsorted'
            : cfg.categories?.find(c => c.id === catId)?.label ?? catId
          return `${card.text}->${catLabel}`
        })
        .join(MULTI_SEP)
    }

    case 'nps': {
      if (answer === null || answer === undefined) return ''
      const n   = parseInt(answer)
      const seg = n <= 6 ? 'Detractor' : n <= 8 ? 'Passive' : 'Promoter'
      return `${n}${COMPANION_SEP}${seg}`
    }

    case 'star_rating':
      return answer != null ? String(answer) : ''

    case 'ranking': {
      const cfg   = question.rankingConfig
      const items = cfg?.items || []
      const order = Array.isArray(answer) ? answer : []
      if (!order.length) return ''
      return order
        .map((id, idx) => {
          const item = items.find(i => i.id === id)
          return item ? `${idx + 1}.${item.text}` : null
        })
        .filter(Boolean)
        .join(MULTI_SEP)
    }

    case 'image_choice_single': {
      if (!answer) return ''
      const cfg = question.imageChoiceConfig
      const opt = cfg?.imageOptions?.find(o => o.id === answer)
      return opt?.text || ''
    }

    case 'image_choice_multi': {
      const cfg  = question.imageChoiceConfig
      const opts = cfg?.imageOptions || []
      const sel  = Array.isArray(answer) ? answer : []
      return sel.map(id => opts.find(o => o.id === id)?.text || id).filter(Boolean).join(MULTI_SEP)
    }

    case 'textbox_list': {
      const cfg  = question.textboxListConfig
      const vals = answer || {}
      if (!cfg?.rows?.length) return ''
      return cfg.rows
        .filter(r => vals[r.id]?.trim())
        .map(r => `${r.label}: ${vals[r.id]}`)
        .join(MULTI_SEP)
    }

    case 'semantic_diff': {
      const cfg  = question.semanticDiffConfig
      const vals = answer || {}
      if (!cfg?.rows?.length) return ''
      return cfg.rows
        .map(r => {
          const v = vals[r.id] ?? cfg.defaultValue
          return v != null ? `${r.leftLabel}↔${r.rightLabel}: ${v}` : null
        })
        .filter(Boolean)
        .join(MULTI_SEP)
    }

    case 'cascade': {
      const cfg = question.cascadeConfig
      if (!answer?.l1) return ''
      const parts = []
      const l1 = cfg.items.find(i => i.id === answer.l1)
      if (l1) parts.push(`${cfg.levelLabels[0]}: ${l1.label}`)
      if (answer.l2) {
        const l2 = cfg.items.find(i => i.id === answer.l2)
        if (l2) parts.push(`${cfg.levelLabels[1]}: ${l2.label}`)
      }
      if (answer.l3) {
        const l3 = cfg.items.find(i => i.id === answer.l3)
        if (l3) parts.push(`${cfg.levelLabels[2]}: ${l3.label}`)
      }
      return parts.join(MULTI_SEP)
    }

    default: return ''
  }
}
