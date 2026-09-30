import { UserX, Zap } from 'lucide-react'

import { DEFAULT_SCREEN_MESSAGES } from '@/constants/surveyDefaults'

export function TerminationScreen({ settings, terminatedBy, isPublic = false }) {
  const title   = settings?.terminateTitle   || DEFAULT_SCREEN_MESSAGES.terminateTitle
  const message = settings?.terminateMessage || DEFAULT_SCREEN_MESSAGES.terminateMessage
  return (
    <div className="flex-1 flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-sm">
          {terminatedBy?.blockTitle ? <Zap size={32} className="text-rose-500 sm:hidden" /> : <UserX size={32} className="text-rose-500 sm:hidden" />}
          {terminatedBy?.blockTitle ? <Zap size={36} className="text-rose-500 hidden sm:block" /> : <UserX size={36} className="text-rose-500 hidden sm:block" />}
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-ink-800 mb-3">{title}</h2>
        <p className="text-ink-500 mb-4 leading-relaxed">{message}</p>
        {terminatedBy?.blockTitle && (
          <p className="text-xs text-rose-500 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-4">
            Triggered by: <strong>{terminatedBy.blockTitle}</strong>
          </p>
        )}
        {!isPublic && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl mb-6">
            <p className="text-xs text-amber-700 font-medium">👁 Preview mode — this is the screen-out page respondents will see</p>
          </div>
        )}
      </div>
    </div>
  )
}
