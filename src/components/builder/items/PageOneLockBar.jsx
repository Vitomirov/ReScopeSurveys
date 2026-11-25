import { memo } from 'react'
import { FileText, ChevronDown, Clock } from 'lucide-react'
import { NavigationLockEditor } from '@/components/shared'
import { resolveNavigationLockSeconds } from '@/constants/survey/navigationLock'

export const PAGE_ONE_LOCK_ID = '__page_one_lock__'

export const PageOneLockBar = memo(function PageOneLockBar({
  survey, dispatch, isActive, onActivate,
}) {
  const lockEnabled = resolveNavigationLockSeconds(survey.settings?.pageOneNavigationLock) > 0
    || (
      !resolveNavigationLockSeconds(survey.settings?.navigationLockAllPages)
      && resolveNavigationLockSeconds(survey.settings?.navigationLock) > 0
    )
  const pageOneLock = survey.settings?.pageOneNavigationLock ?? survey.settings?.navigationLock

  return (
    <div className="mb-1">
      <div className="flex items-center gap-3 py-1">
        <div className="w-[15px] shrink-0" />
        <div className="flex-1 border-t-2 border-dashed border-ink-200" />
        <button
          type="button"
          onClick={() => onActivate(PAGE_ONE_LOCK_ID)}
          title="Page 1 settings: timed navigation lock"
          className={`flex items-center gap-2 px-3 py-1.5 bg-white border rounded-full shadow-sm transition-all ${
            isActive ? 'border-violet-400 ring-2 ring-violet-100' : 'border-ink-200'
          }`}
        >
          <FileText size={12} className="text-ink-400" />
          <span className="text-xs font-semibold text-ink-500 uppercase tracking-wider">
            Page 1
          </span>
          {lockEnabled && (
            <>
              <div className="w-px h-3 bg-ink-200" />
              <span className="flex items-center gap-0.5 text-xs font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">
                <Clock size={9} /> {pageOneLock?.seconds ?? 0}s lock
              </span>
            </>
          )}
          <ChevronDown size={12} className={`text-ink-300 transition-transform ${isActive ? 'rotate-180' : ''}`} />
        </button>
        <div className="flex-1 border-t-2 border-dashed border-ink-200" />
        <div className="w-[29px] shrink-0" />
      </div>

      {!isActive && (
        <p className="text-center text-xs text-ink-400 mt-0.5 mb-1 px-8">
          Click to set timed navigation lock for page 1 only (when all-pages lock is off)
        </p>
      )}

      {isActive && (
        <div className="ml-8 mr-8 mb-2 mt-1">
          <NavigationLockEditor
            lock={pageOneLock}
            onChange={navigationLock => dispatch({
              type: 'SET_SURVEY_SETTING',
              key: 'pageOneNavigationLock',
              value: navigationLock,
            })}
            pageLabel="Page 1 only"
          />
        </div>
      )}
    </div>
  )
})
