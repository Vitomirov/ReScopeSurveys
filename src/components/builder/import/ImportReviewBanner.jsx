import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronRight, X } from 'lucide-react'
import {
  collectImportReviewEntries,
  orphanImportWarnings,
  summarizeImportReview,
} from '@/utils/survey/importReview'
import { scrollChildToTop } from '@/utils/dom/scrollChildToTop'

function jumpToItem(itemId, onJumpToItem) {
  onJumpToItem?.(itemId)
  const scrollTo = () => {
    const el = document.getElementById(`survey-item-${itemId}`)
    if (el) scrollChildToTop(null, el, 12)
  }
  // Activate expands the card; retry so scroll lands after layout.
  requestAnimationFrame(() => requestAnimationFrame(scrollTo))
  setTimeout(scrollTo, 50)
  setTimeout(scrollTo, 150)
  setTimeout(scrollTo, 320)
}

export function ImportReviewBanner({ survey, items = [], onJumpToItem }) {
  const entries = useMemo(() => collectImportReviewEntries(items), [items])
  const summary = useMemo(() => summarizeImportReview(entries), [entries])
  const otherNotes = useMemo(
    () => orphanImportWarnings(survey?.importMeta?.warnings, entries),
    [survey?.importMeta?.warnings, entries],
  )

  const hasImport = Boolean(survey?.importMeta?.importedAt)
  const pending = survey?.status === 'pending_review'
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null
  if (!hasImport && entries.length === 0) return null
  if (entries.length === 0 && otherNotes.length === 0 && !pending) return null

  const allClear = entries.length === 0 && otherNotes.length === 0
  const tone = allClear ? 'emerald' : summary.action > 0 ? 'amber' : 'violet'

  return (
    <div
      className={`shrink-0 border-b px-4 py-2.5 ${
        tone === 'emerald'
          ? 'border-emerald-200/80 bg-emerald-50/90'
          : tone === 'amber'
            ? 'border-amber-200/90 bg-amber-50/95'
            : 'border-violet-200/80 bg-violet-50/90'
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="max-w-5xl mx-auto flex gap-3 items-start">
        {allClear ? (
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" aria-hidden />
        ) : (
          <AlertTriangle
            size={18}
            className={`shrink-0 mt-0.5 ${tone === 'amber' ? 'text-amber-600' : 'text-violet-600'}`}
            aria-hidden
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className={`text-sm font-semibold ${
              tone === 'emerald' ? 'text-emerald-900' : tone === 'amber' ? 'text-amber-950' : 'text-violet-950'
            }`}>
              {allClear
                ? 'Import look-over complete'
                : summary.action > 0
                  ? `${summary.openItems} question${summary.openItems === 1 ? '' : 's'} need attention`
                  : `${summary.openItems} item${summary.openItems === 1 ? '' : 's'} to review`}
            </p>
            {pending && (
              <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border border-violet-200 bg-white/70 text-violet-800">
                Pending
              </span>
            )}
          </div>

          <p className={`text-xs mt-0.5 ${allClear ? 'text-emerald-800/90' : 'text-ink-600'}`}>
            {allClear
              ? pending
                ? 'No open import flags. Set status to Draft or Live when you are ready.'
                : 'Imported questions look ready. Spot-check wording and logic before publishing.'
              : summary.action > 0
                ? 'Jump to a flagged question below, fix it, then set Draft or Live.'
                : 'Open each flagged question, finish setup, then Mark reviewed.'}
          </p>

          {!allClear && entries.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {entries.map(entry => {
                const primary = entry.issues[0]
                const chipLabel = entry.questionNumber != null ? `Q${entry.questionNumber}` : 'Block'
                const needsAction = entry.issues.some(i => i.severity === 'action')
                return (
                  <button
                    key={entry.itemId}
                    type="button"
                    onClick={() => jumpToItem(entry.itemId, onJumpToItem)}
                    className={`inline-flex items-center gap-1 max-w-full text-xs font-medium px-2 py-1 rounded-lg border transition-colors ${
                      needsAction
                        ? 'border-amber-300 bg-white text-amber-950 hover:bg-amber-100'
                        : 'border-violet-200 bg-white text-violet-950 hover:bg-violet-100'
                    }`}
                    title={entry.label}
                  >
                    <span className="font-bold shrink-0">{chipLabel}</span>
                    <span className="truncate">{primary.title}</span>
                    <ChevronRight size={12} className="shrink-0 opacity-60" />
                  </button>
                )
              })}
            </div>
          )}

          {otherNotes.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-ink-700 list-disc pl-4 max-h-24 overflow-y-auto">
              {otherNotes.map((w, i) => (
                <li key={`other-${w.code || 'note'}-${i}`}>{w.message}</li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1.5 rounded-lg text-ink-500 hover:bg-black/5 transition-colors shrink-0"
          aria-label="Dismiss import review bar"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
