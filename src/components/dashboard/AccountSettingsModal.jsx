import { useState, useEffect, useCallback } from 'react'
import { X, User } from 'lucide-react'
import { useApi } from '@/config/api'
import { fetchMe } from '@/api/auth/profile'
import { AUTH_PROFILE } from '@/constants/auth/authCopy'
import { InlineLoader } from '@/components/ui'
import { ProfileSettingsPanel } from './ProfileSettingsPanel.jsx'

export function AccountSettingsModal({ session, onClose, onSessionUpdate }) {
  const [profile, setProfile] = useState(session)
  const [loading, setLoading] = useState(useApi)

  const loadProfile = useCallback(async () => {
    if (!useApi) {
      setProfile(session)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await fetchMe()
      setProfile(data.session)
    } catch {
      setProfile(session)
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => { loadProfile() }, [loadProfile])

  const handleProfileSaved = (user) => {
    setProfile(prev => ({ ...prev, ...user }))
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-ink-100 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
            <User size={16} className="text-brand-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-ink-800">{AUTH_PROFILE.myAccount}</h2>
            <p className="text-xs text-ink-400">{AUTH_PROFILE.myProfileHint}</p>
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
            <InlineLoader label="Loading profile…" />
          ) : (
            <ProfileSettingsPanel
              session={session}
              profile={profile}
              onSessionUpdate={onSessionUpdate}
              onProfileSaved={handleProfileSaved}
            />
          )}
        </div>

        <div className="px-5 pb-5 flex justify-end shrink-0">
          <button type="button" onClick={onClose} className="btn-primary px-6">Done</button>
        </div>
      </div>
    </div>
  )
}

export default AccountSettingsModal
