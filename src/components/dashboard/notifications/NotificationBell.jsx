import { useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { formatBadgeCount } from '@/utils/notifications/responseNotifications'
import { NotificationPanel } from './NotificationPanel.jsx'

export function NotificationBell({
  payload,
  loading,
  error,
  onRetry,
  onOpen,
  onSelect,
  onMarkRead,
  onMarkAllRead,
}) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('all')
  const rootRef = useRef(null)
  const totalNew = payload?.totalNew ?? 0
  const badge = formatBadgeCount(totalNew)

  useEffect(() => {
    if (!open) return undefined
    const close = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = () => {
    setOpen(v => {
      const next = !v
      if (next) onOpen?.()
      return next
    })
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={toggle}
        className={`relative flex items-center justify-center w-10 h-10 rounded-full transition-all focus-ring ${
          open
            ? 'ring-2 ring-brand-500/40 ring-offset-2 bg-brand-50/60 text-brand-700'
            : 'text-ink-500 hover:text-ink-800 hover:bg-ink-50'
        }`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={totalNew > 0 ? `Notifications, ${totalNew} new` : 'Notifications'}
      >
        <Bell size={18} />
        {badge && (
          <span className="absolute top-1 right-1 min-w-[1.05rem] h-[1.05rem] px-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold leading-none flex items-center justify-center">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <NotificationPanel
          tab={tab}
          onTabChange={setTab}
          payload={payload}
          loading={loading}
          error={error}
          onRetry={onRetry}
          onSelect={(surveyId) => {
            setOpen(false)
            onSelect(surveyId)
          }}
          onMarkRead={onMarkRead}
          onMarkAllRead={onMarkAllRead}
        />
      )}
    </div>
  )
}

export default NotificationBell
