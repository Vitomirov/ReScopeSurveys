import { ExternalLink, Download } from 'lucide-react'
import { DEFAULT_SCREEN_MESSAGES } from '@/constants/survey/surveyDefaults'
import { openExternalRedirect } from '@/utils/survey/engines/externalRedirectEngine'

export function ExternalRedirectScreen({
  settings,
  redirectUrl,
  onReset,
  onDownload,
  isPublic = false,
}) {
  const title   = settings?.redirectTitle   || DEFAULT_SCREEN_MESSAGES.redirectTitle
  const message = settings?.redirectMessage || DEFAULT_SCREEN_MESSAGES.redirectMessage

  return (
    <div className="flex-1 flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4 sm:mb-6">
          <ExternalLink size={32} className="text-emerald-600 sm:hidden" />
          <ExternalLink size={36} className="text-emerald-600 hidden sm:block" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-ink-800 mb-3">{title}</h2>
        <p className="text-ink-500 mb-4 leading-relaxed">{message}</p>
        {redirectUrl && (
          <button
            type="button"
            onClick={() => openExternalRedirect(redirectUrl)}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium mb-4 inline-flex items-center gap-1.5"
          >
            <ExternalLink size={14} /> Open link again
          </button>
        )}
        {!isPublic && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl mb-6">
            <p className="text-xs text-amber-700 font-medium">👁 Preview mode — survey ends here after an external redirect</p>
          </div>
        )}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2 sm:gap-3">
          {!isPublic && (
            <button onClick={onReset} className="btn-ghost border border-ink-200 justify-center">
              ← Restart
            </button>
          )}
          <button onClick={onDownload} className="btn-primary flex items-center gap-2 justify-center">
            <Download size={14} /> Download CSV
          </button>
        </div>
      </div>
    </div>
  )
}
