import { COMPANION_SEP, MULTI_SEP } from './constants'

export function fpSampleValue(key) {
  const samples = {
    ip: '203.0.113.42', city: 'London', region: 'England', country: 'United Kingdom',
    countryCode: 'GB', isp: 'Example Broadband Ltd', latitude: '51.5074', longitude: '-0.1278',
    browserName: 'Chrome', browserVersion: '126.0.0.0', os: 'Windows 10/11', deviceType: 'Desktop',
    screenW: '1920', screenH: '1080', colorDepth: '24', viewportW: '1903', viewportH: '953',
    timezone: 'Europe/London', language: 'en-GB', cpuCores: '8', deviceMemGB: '8',
    touchPoints: '0', connType: '4g', connDownlink: '10', canvasHash: 'a1b2c3d4',
    webglRenderer: 'ANGLE (Intel, Intel(R) UHD Graphics)', webglVendor: 'Google Inc.',
    cookiesEnabled: 'true', doNotTrack: 'unset', fpCollectedAt: new Date().toISOString(),
  }
  return samples[key] ?? ''
}

/** Example cell value for CSV template export. */
export function sampleValue(q) {
  switch (q.questionType) {
    case 'single_select':
    case 'dropdown': {
      const opt = q.options?.[0]
      return opt
        ? (opt.openText?.enabled ? `${opt.text}${COMPANION_SEP}Additional detail here` : opt.text)
        : 'Option A'
    }
    case 'multi_select': {
      const opts = q.options?.slice(0, 2) || []
      return opts.length
        ? opts.map(o => o.openText?.enabled ? `${o.text}${COMPANION_SEP}Detail` : o.text).join(MULTI_SEP)
        : `Option A${MULTI_SEP}Option B`
    }
    case 'open_text':      return 'Sample text response'
    case 'date':           return '2025-06-25'
    case 'phone':          return '+447700900123'
    case 'slider': {
      const cfg = q.sliderConfig
      return String(cfg?.defaultValue ?? cfg?.min ?? 1)
    }
    case 'constant_sum': {
      const cfg   = q.constantSumConfig
      const items = cfg?.items || []
      const share = items.length ? Math.floor((cfg.targetSum || 100) / items.length) : 0
      return items.map(i => `${i.label}:${share}`).join(MULTI_SEP)
    }
    case 'matrix': {
      const cfg = q.matrixConfig
      return (cfg?.rows || []).slice(0, 2)
        .map(r => `${r.text}:${cfg?.columns?.[0]?.text || 'Column 1'}`)
        .join(MULTI_SEP)
    }
    case 'bipolar_matrix': {
      const cfg = q.bipolarConfig
      return (cfg?.rows || []).slice(0, 2)
        .map(r => `${r.text}:L=${cfg?.leftColumns?.[0]?.text || 'Left'},R=${cfg?.rightColumns?.[0]?.text || 'Right'}`)
        .join(MULTI_SEP)
    }
    case 'maxdiff':
      return `T1:Best=Item 1,Worst=Item 3${MULTI_SEP}T2:Best=Item 2,Worst=Item 1`
    case 'card_sort': {
      const cfg = q.cardSortConfig
      return (cfg?.cards || []).slice(0, 3)
        .map(c => `${c.text}->${cfg?.categories?.[0]?.label || 'Category A'}`)
        .join(MULTI_SEP)
    }
    case 'nps':         return `8${COMPANION_SEP}Passive`
    case 'star_rating': return '4'
    case 'ranking': {
      const cfg = q.rankingConfig
      return (cfg?.items || []).slice(0, 3)
        .map((item, i) => `${i + 1}.${item.text}`)
        .join(MULTI_SEP)
    }
    case 'image_choice_single': {
      const cfg = q.imageChoiceConfig
      return cfg?.imageOptions?.[0]?.text || 'Option 1'
    }
    case 'image_choice_multi': {
      const cfg = q.imageChoiceConfig
      return (cfg?.imageOptions || []).slice(0, 2).map(o => o.text).join(MULTI_SEP)
    }
    case 'textbox_list': {
      const cfg = q.textboxListConfig
      return (cfg?.rows || []).slice(0, 2).map(r => `${r.label}: Sample answer`).join(MULTI_SEP)
    }
    case 'semantic_diff': {
      const cfg = q.semanticDiffConfig
      return (cfg?.rows || []).slice(0, 2)
        .map(r => `${r.leftLabel}↔${r.rightLabel}: ${Math.ceil((cfg?.points || 7) / 2)}`)
        .join(MULTI_SEP)
    }
    case 'cascade': {
      const cfg = q.cascadeConfig
      return `${cfg?.levelLabels?.[0] || 'L1'}: Option A|${cfg?.levelLabels?.[1] || 'L2'}: Sub-option|${cfg?.levelLabels?.[2] || 'L3'}: Detail`
    }
    default: return ''
  }
}
