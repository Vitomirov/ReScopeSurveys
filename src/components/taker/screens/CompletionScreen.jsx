import { Check } from 'lucide-react'
import { DEFAULT_SCREEN_MESSAGES } from '@/constants/survey/surveyDefaults'

export function CompletionScreen({ settings }) {
  const title = settings?.completeTitle || DEFAULT_SCREEN_MESSAGES.completeTitle

  return (
    <div className="flex-1 flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4 sm:mb-6">
          <Check size={32} className="text-emerald-500 sm:hidden" />
          <Check size={36} className="text-emerald-500 hidden sm:block" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-ink-800 mb-3">{title}</h2>
      </div>
    </div>
  )
}
