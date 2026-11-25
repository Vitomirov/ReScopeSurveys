import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react'
import { X, Users } from 'lucide-react'
import { useApi } from '@/config/api'
import { getUsers } from '@/utils/data/authStore'
import { fetchUsers } from '@/api/platform/platform'
import { fetchBillingOverview } from '@/api/platform/billing'
import { AUTH_PROFILE } from '@/constants/auth/authCopy'
import { InlineLoader } from '@/components/ui'

const TeamUserManager = lazy(() =>
  import('./TeamUserManager.jsx').then(m => ({ default: m.TeamUserManager })),
)

export function TeamMembersModal({ session, onClose }) {
  const [users, setUsers] = useState(() => (useApi ? [] : getUsers()))
  const [seatUsage, setSeatUsage] = useState(null)
  const [loading, setLoading] = useState(useApi)

  const load = useCallback(async () => {
    if (!useApi) {
      setUsers(getUsers())
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [u, billing] = await Promise.all([
        fetchUsers(),
        fetchBillingOverview().catch(() => null),
      ])
      setUsers(u)
      if (billing?.usage && billing?.subscription) {
        setSeatUsage({
          used: billing.usage.users,
          total: billing.subscription.seats,
        })
      }
    } catch (err) {
      console.error('Failed to load team members', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const resolvedSeatUsage = useMemo(() => {
    if (seatUsage) return seatUsage
    if (!useApi) return { used: users.length, total: users.length }
    return null
  }, [seatUsage, users.length])

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-ink-100 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
            <Users size={16} className="text-brand-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-ink-800">{AUTH_PROFILE.teamMembers}</h2>
            <p className="text-xs text-ink-400">{AUTH_PROFILE.teamHint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-ink-400 hover:text-ink-700 hover:bg-ink-100 rounded-lg transition-all"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <InlineLoader label="Loading team members…" />
          ) : (
            <Suspense fallback={<InlineLoader label="Loading team members…" />}>
              <TeamUserManager
                users={users}
                setUsers={setUsers}
                session={session}
                seatUsage={resolvedSeatUsage}
                hideHeader
              />
            </Suspense>
          )}
        </div>

        <div className="px-5 pb-5 flex justify-end shrink-0 border-t border-ink-100 pt-4">
          <button type="button" onClick={onClose} className="btn-primary px-6">Done</button>
        </div>
      </div>
    </div>
  )
}

export default TeamMembersModal
