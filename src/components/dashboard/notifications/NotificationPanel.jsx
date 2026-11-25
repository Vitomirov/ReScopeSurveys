import { formatRelativeTime } from '@/utils/notifications/responseNotifications'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'surveys', label: 'Surveys' },
]

function NotificationRow({ title, subtitle, count = 0, onOpen, onMarkRead }) {
  return (
    <div className="w-full flex items-start gap-1 px-1.5 py-1.5 rounded-xl hover:bg-ink-50">
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 flex items-start gap-2.5 px-1.5 py-1 rounded-lg text-left focus-ring"
      >
        <span className="mt-1.5 w-2 h-2 rounded-full bg-brand-500 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink-800 truncate">{title}</span>
          {subtitle && (
            <span className="block text-xs text-ink-400 mt-0.5">{subtitle}</span>
          )}
        </span>
        {count > 0 && (
          <span className="shrink-0 text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-1.5 py-0.5 mt-0.5">
            {count} new
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={onMarkRead}
        className="shrink-0 mt-0.5 text-[11px] font-semibold text-ink-500 hover:text-brand-700 hover:bg-brand-50 px-2 py-1.5 rounded-lg focus-ring"
      >
        Mark read
      </button>
    </div>
  )
}

export function NotificationPanel({
  tab,
  onTabChange,
  payload,
  loading,
  error,
  onRetry,
  onSelect,
  onMarkRead,
  onMarkAllRead,
}) {
  const feed = payload?.feed || []
  const bySurvey = payload?.bySurvey || []
  const rows = tab === 'surveys' ? bySurvey : feed
  const empty = !loading && !error && rows.length === 0
  const canMarkAll = !loading && (payload?.totalNew ?? 0) > 0

  return (
    <div
      role="dialog"
      aria-label="Response notifications"
      className="absolute right-0 top-[calc(100%+8px)] w-[min(100vw-1.5rem,24rem)] bg-white border border-ink-200 rounded-2xl shadow-xl shadow-ink-900/10 z-50 overflow-hidden"
    >
      <div className="px-3 pt-3 pb-2 border-b border-ink-100">
        <div className="flex items-center justify-between gap-2 px-1 mb-2">
          <p className="text-sm font-bold text-ink-800">Notifications</p>
          {canMarkAll && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="text-xs font-semibold text-brand-700 hover:text-brand-800 px-2 py-1 rounded-lg hover:bg-brand-50 focus-ring"
            >
              Mark all as read
            </button>
          )}
        </div>
        <div role="tablist" aria-label="Notification views" className="flex p-1 bg-ink-50 rounded-xl">
          {TABS.map(({ id, label }) => {
            const selected = tab === id
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => onTabChange(id)}
                className={`flex-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                  selected
                    ? 'bg-white text-ink-800 shadow-sm border border-ink-200'
                    : 'text-ink-500 hover:text-ink-700'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="max-h-[min(24rem,70vh)] overflow-y-auto p-1.5">
        {loading && (
          <p className="text-sm text-ink-400 text-center py-8">Loading notifications…</p>
        )}
        {error && !loading && rows.length === 0 && (
          <div className="text-center py-8 px-4">
            <p className="text-sm text-ink-500 mb-2">Couldn’t load notifications.</p>
            <button
              type="button"
              onClick={onRetry}
              className="text-xs font-semibold text-brand-700 hover:text-brand-800 px-3 py-1.5 rounded-lg hover:bg-brand-50"
            >
              Retry
            </button>
          </div>
        )}
        {empty && (
          <p className="text-sm text-ink-400 text-center py-8 px-4">
            No unread notifications.
          </p>
        )}
        {!loading && tab === 'all' && feed.map(item => (
          <NotificationRow
            key={item.surveyId}
            title={item.message}
            subtitle={formatRelativeTime(item.latestAt)}
            onOpen={() => onSelect(item.surveyId)}
            onMarkRead={() => onMarkRead?.(item.surveyId)}
          />
        ))}
        {!loading && tab === 'surveys' && bySurvey.map(item => (
          <NotificationRow
            key={item.surveyId}
            title={item.title}
            subtitle={formatRelativeTime(item.latestAt)}
            count={item.newCount}
            onOpen={() => onSelect(item.surveyId)}
            onMarkRead={() => onMarkRead?.(item.surveyId)}
          />
        ))}
      </div>
    </div>
  )
}

export default NotificationPanel
