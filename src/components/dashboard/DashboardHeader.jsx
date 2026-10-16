import { useState, useRef, useEffect } from 'react'
import {
  Plus, Users, User, BarChart3,
} from 'lucide-react'
import {
  AppShell,
  APP_SHELL_GRID,
  APP_HEADER_PANE,
  APP_HEADER_ACTIONS,
  APP_HEADER_USER_CLUSTER,
} from '@/components/shared/layout/AppBuilderShell.jsx'
import { AppBackSlot } from '@/components/shared/layout/AppLeadingZone.jsx'
import { AppLogo } from '@/components/shared/branding/AppLogo.jsx'
import { HeaderLogoutButton } from '@/components/shared/layout/HeaderLogoutButton.jsx'
import { AUTH_PROFILE, AUTH_TEAM } from '@/constants/authCopy'
import { roleLabel, canManagePlatform } from '@/utils/platform/permissions'
import { panelStartUrl } from '@/utils/panelLink'
import { prefetchBuilder } from '@/utils/routing/routePrefetch'
import { UserAvatar } from './UserAvatar.jsx'
import { NotificationBell } from './NotificationBell.jsx'

function UserMenu({
  session,
  onOpenAccount,
  onOpenTeamMembers,
  onOpenTeamActivity,
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  if (!session) return null

  const isAdmin = canManagePlatform(session)

  const menuItem = (label, Icon, onClick) => (
    <button
      type="button"
      onClick={() => { setOpen(false); onClick?.() }}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 rounded-lg transition-colors text-left"
    >
      <Icon size={15} className="text-ink-400 shrink-0" />
      {label}
    </button>
  )

  const accountLabel = session.name || session.username

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`flex items-center justify-center w-10 h-10 rounded-full transition-all focus-ring ${
          open
            ? 'ring-2 ring-brand-500/40 ring-offset-2 bg-brand-50/60'
            : 'hover:bg-ink-50 hover:ring-2 hover:ring-ink-200/80'
        }`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu, ${accountLabel}`}
        title={accountLabel}
      >
        <UserAvatar user={session} size="sm" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] w-64 bg-white border border-ink-200 rounded-2xl shadow-xl shadow-ink-900/10 p-2 z-50"
        >
          <div className="flex items-center gap-3 px-2 py-2.5 mb-1">
            <UserAvatar user={session} size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink-800 truncate">
                {session.name || session.username}
              </p>
              <p className="text-xs text-ink-400 truncate">@{session.username}</p>
              {session.organizationName && (
                <p className="text-xs text-ink-500 truncate mt-0.5">{session.organizationName}</p>
              )}
            </div>
          </div>
          <div className="px-2 pb-2">
            <span className="inline-flex text-[10px] font-bold uppercase tracking-wider text-brand-700 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded-full">
              {roleLabel(session.role)}
            </span>
          </div>

          <div className="border-t border-ink-100 my-1.5 pt-1.5 space-y-0.5">
            {menuItem(AUTH_PROFILE.myAccount, User, onOpenAccount)}
            {isAdmin && menuItem(AUTH_PROFILE.teamMembers, Users, onOpenTeamMembers)}
            {isAdmin && menuItem(AUTH_TEAM.teamActivity, BarChart3, onOpenTeamActivity)}
          </div>
        </div>
      )}
    </div>
  )
}

export function DashboardHeader({
  session,
  onNewSurvey,
  onGoHome,
  onLogout,
  onOpenAccount,
  onOpenTeamMembers,
  onOpenTeamActivity,
  notifications,
}) {
  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-ink-200/80 sticky top-0 z-30 safe-top">
      <AppShell>
        <div className={`${APP_SHELL_GRID} items-center min-h-[4.25rem] py-3`}>
          <AppBackSlot />

          <div className={APP_HEADER_PANE}>
            <AppLogo onClick={onGoHome} size="md" className="shrink-0 min-w-0" />

            <div className={APP_HEADER_ACTIONS}>
              {session?.canUseBuilder !== false && (
                <button
                  type="button"
                  onClick={onNewSurvey}
                  onMouseEnter={prefetchBuilder}
                  onFocus={prefetchBuilder}
                  aria-label="New survey"
                  className="btn-primary inline-flex items-center gap-1.5 h-9 sm:h-10 rounded-xl px-2.5 sm:px-4 text-sm font-semibold shrink-0 shadow-sm shadow-brand-600/10 hover:shadow-md hover:shadow-brand-600/15"
                >
                  <Plus size={16} className="shrink-0" aria-hidden />
                  <span className="sm:hidden">New</span>
                  <span className="hidden sm:inline">New survey</span>
                </button>
              )}
              {session?.panelEnabled && panelStartUrl() && (
                <a
                  href={panelStartUrl()}
                  className="inline-flex items-center h-9 sm:h-10 rounded-xl px-2.5 sm:px-4 text-sm font-semibold border border-ink-200 text-ink-700 hover:bg-ink-50"
                >
                  Panel
                </a>
              )}

              <div className={APP_HEADER_USER_CLUSTER}>
                {session && (
                  <NotificationBell
                    payload={notifications?.payload}
                    loading={notifications?.loading}
                    error={notifications?.error}
                    onRetry={notifications?.onRetry}
                    onOpen={notifications?.onOpen}
                    onSelect={notifications?.onSelect}
                  />
                )}
                <UserMenu
                  session={session}
                  onOpenAccount={onOpenAccount}
                  onOpenTeamMembers={onOpenTeamMembers}
                  onOpenTeamActivity={onOpenTeamActivity}
                />
                <HeaderLogoutButton onLogout={onLogout} className="-mr-1 sm:mr-0" />
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    </header>
  )
}

export default DashboardHeader
