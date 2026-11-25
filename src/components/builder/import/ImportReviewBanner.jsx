import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

export function ImportReviewBanner({ survey, itemWarnings = [] }) {
  const fromMeta = Array.isArray(survey?.importMeta?.warnings) ? survey.importMeta.warnings : []
  const merged = [...fromMeta, ...itemWarnings]
  const seen = new Set()
  const warnings = merged.filter(w => {
    if (!w?.message) return false
    const key = `${w.code || ''}:${w.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const [dismissed, setDismissed] = useState(false)

  if (dismissed || warnings.length === 0) return null

  const partialCount = itemWarnings.length

  return (
    <div
      className="shrink-0 border-b border-amber-200/80 bg-amber-50/95 px-4 py-3"
      role="status"
      aria-live="polite"
    >
      <div className="max-w-5xl mx-auto flex gap-3 items-start">
        <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" aria-hidden />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-900">
            Import review — check before publishing
          </p>
          <p className="text-xs text-amber-800/90 mt-0.5">
            {survey?.status === 'pending_review'
              ? 'This survey is in review. Set status to Draft or Live when ready.'
              : 'Imported content may need editor changes.'}
            {partialCount > 0 && ` ${partialCount} question(s) flagged as partial setup.`}
          </p>
          <ul className="mt-2 space-y-1 text-xs text-amber-900 list-disc pl-4 max-h-32 overflow-y-auto">
            {warnings.map((w, i) => (
              <li key={`${w.code}-${i}`}>
                {w.message}
              </li>
            ))}
          </ul>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-100 transition-colors shrink-0"
          aria-label="Dismiss import review notice"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}