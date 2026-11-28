import { AlertTriangle, Check } from 'lucide-react'
import { getItemImportIssues, markItemImportReviewed } from '@/utils/survey/importReview'

export function ImportQuestionReview({ item, dispatch, issues: issuesProp }) {
  const issues = issuesProp ?? getItemImportIssues(item)
  if (!issues.length) return null

  const hasAction = issues.some(i => i.severity === 'action')

  return (
    <div
      className={`mx-3 sm:mx-4 mb-3 rounded-lg border px-3 py-2.5 ${
        hasAction
          ? 'border-amber-300 bg-amber-50'
          : 'border-violet-200 bg-violet-50'
      }`}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex gap-2 items-start">
        <AlertTriangle
          size={15}
          className={`shrink-0 mt-0.5 ${hasAction ? 'text-amber-600' : 'text-violet-600'}`}
          aria-hidden
        />
        <div className="flex-1 min-w-0 space-y-2">
          {issues.map(issue => (
            <div key={issue.code}>
              <p className={`text-xs font-semibold ${hasAction ? 'text-amber-950' : 'text-violet-950'}`}>
                {issue.title}
              </p>
              <p className={`text-xs mt-0.5 leading-snug ${hasAction ? 'text-amber-900/85' : 'text-violet-900/85'}`}>
                {issue.detail}
              </p>
            </div>
          ))}
          {issues.some(i => i.dismissible) && (
            <button
              type="button"
              className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-violet-800 hover:text-violet-950 underline-offset-2 hover:underline"
              onClick={() => {
                dispatch({
                  type: 'UPDATE_ITEM',
                  id: item.id,
                  patch: { importMeta: markItemImportReviewed(item.importMeta) },
                })
              }}
            >
              <Check size={12} aria-hidden />
              Mark reviewed
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
