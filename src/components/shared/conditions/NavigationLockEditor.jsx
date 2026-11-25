import { Clock } from 'lucide-react'
import { Toggle } from '@/components/ui'
import {
  NAVIGATION_LOCK_DURATION_OPTIONS,
  DEFAULT_NAVIGATION_LOCK_SECONDS,
} from '@/constants/survey/navigationLock'

export function NavigationLockEditor({ lock, onChange, pageLabel, compact = false, allPages = false }) {
  const enabled = lock?.enabled || false
  const seconds = lock?.seconds ?? DEFAULT_NAVIGATION_LOCK_SECONDS

  const setLock = (patch) =>
    onChange({
      enabled: false,
      seconds: DEFAULT_NAVIGATION_LOCK_SECONDS,
      ...lock,
      ...patch,
    })

  return (
    <div className={compact ? 'space-y-2' : 'p-3 bg-ink-50 border border-ink-100 rounded-xl space-y-2.5'}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink-600 flex items-center gap-1.5">
            <Clock size={12} className="text-ink-400 shrink-0" />
            Force to stay on page
            {pageLabel ? <span className="font-normal text-ink-400">— {pageLabel}</span> : null}
          </p>
          {!compact && (
            <p className="text-xs text-ink-400 mt-0.5 leading-snug">
              {allPages
                ? 'Applies to every page in the survey. Per-page lock options are hidden while this is on.'
                : 'Keeps Next disabled until the timer expires so respondents read informational content.'}
            </p>
          )}
        </div>
        <Toggle checked={enabled} onChange={val => setLock({ enabled: val })} />
      </div>

      {enabled && (
        <div>
          <label className="text-xs text-ink-500 mb-1 block">Minimum time on page</label>
          <select
            value={seconds}
            onChange={e => setLock({ seconds: Number(e.target.value) })}
            className="input-base text-sm w-full sm:w-48"
          >
            {NAVIGATION_LOCK_DURATION_OPTIONS.map(option => (
              <option key={option} value={option}>{option} seconds</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
