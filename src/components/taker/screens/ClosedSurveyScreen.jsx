import { DEFAULT_SCREEN_MESSAGES } from '@/constants/survey/surveyDefaults'

export function ClosedSurveyScreen({ settings }) {
  const title   = settings?.closedTitle   || DEFAULT_SCREEN_MESSAGES.closedTitle
  const message = settings?.closedMessage || DEFAULT_SCREEN_MESSAGES.closedMessage
  return (
    <div className="min-h-screen bg-ink-50 flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-ink-100 flex items-center justify-center mx-auto mb-4 sm:mb-6">
          <span className="text-3xl sm:text-4xl">🔒</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-ink-800 mb-3">{title}</h2>
        <p className="text-ink-500 leading-relaxed">{message}</p>
      </div>
    </div>
  )
}
