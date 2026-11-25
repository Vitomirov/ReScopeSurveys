import { LogOut } from 'lucide-react'
import { AUTH_COPY } from '@/constants/auth/authCopy'

export function HeaderLogoutButton({ onLogout, className = '' }) {
  if (!onLogout) return null

  return (
    <button
      type="button"
      onClick={onLogout}
      title={AUTH_COPY.signOut}
      className={`inline-flex items-center justify-center gap-2 text-sm font-medium text-ink-600 hover:text-rose-600 hover:bg-rose-50 px-2.5 sm:px-3 py-2 min-h-[44px] min-w-[44px] rounded-lg transition-colors shrink-0 focus-ring ${className}`}
    >
      <LogOut size={16} className="text-ink-400 shrink-0" />
      <span className="hidden sm:inline">{AUTH_COPY.signOut}</span>
    </button>
  )
}
