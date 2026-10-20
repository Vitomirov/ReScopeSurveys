import { useState, useRef, useEffect } from 'react'
import { Camera, Eye, EyeOff, Lock } from 'lucide-react'
import { useApi } from '@/config/api'
import { updateProfile as updateProfileApi } from '@/api/auth/profile'
import { updateProfileLocal } from '@/utils/data/authStore'
import { AUTH_PROFILE, AUTH_VALIDATION } from '@/constants/authCopy'
import { useToast } from '@/components/ui'
import { UserAvatar } from './UserAvatar.jsx'
import { TotpSettings } from './TotpSettings.jsx'

const MAX_AVATAR_BYTES = 512 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const max = 256
      let { width, height } = img
      if (width > max || height > max) {
        const scale = max / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      const base64 = dataUrl.split(',')[1]
      const bytes = base64 ? Math.ceil((base64.length * 3) / 4) : 0
      if (bytes > MAX_AVATAR_BYTES) {
        reject(new Error('Profile image must be 512 KB or smaller.'))
        return
      }
      resolve(dataUrl)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image.'))
    }
    img.src = url
  })
}

export function ProfileSettingsPanel({ session, profile, onSessionUpdate, onProfileSaved }) {
  const { toast } = useToast()
  const fileRef = useRef(null)
  const [saving, setSaving] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [form, setForm] = useState({
    name: profile?.name || session?.name || '',
    username: profile?.username || session?.username || '',
    avatarUrl: profile?.avatarUrl || session?.avatarUrl || null,
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')

  useEffect(() => {
    if (!profile && !session) return
    setForm(f => ({
      ...f,
      name: profile?.name || session?.name || '',
      username: profile?.username || session?.username || '',
      avatarUrl: profile?.avatarUrl ?? session?.avatarUrl ?? null,
    }))
  }, [profile, session])

  const email = profile?.email || session?.email || ''

  const previewUser = {
    name: form.name,
    username: form.username,
    avatarUrl: form.avatarUrl,
  }

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Use a JPEG, PNG, or WebP image.')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError('Profile image must be 512 KB or smaller.')
      return
    }
    try {
      const dataUrl = await resizeImage(file)
      setForm(f => ({ ...f, avatarUrl: dataUrl }))
      setError('')
    } catch (err) {
      setError(err.message || 'Could not process image.')
    } finally {
      e.target.value = ''
    }
  }

  const handleSave = async () => {
    setError('')
    if (!form.name.trim()) {
      setError('Display name is required.')
      return
    }
    if (!form.username.trim()) {
      setError('Username is required.')
      return
    }

    const changingPassword = Boolean(form.newPassword || form.currentPassword || form.confirmPassword)
    if (changingPassword) {
      if (!form.currentPassword) {
        setError('Enter your current password to set a new one.')
        return
      }
      if (form.newPassword.length < 8) {
        setError(AUTH_VALIDATION.passwordMinLength)
        return
      }
      if (form.newPassword !== form.confirmPassword) {
        setError(AUTH_VALIDATION.passwordsMismatch)
        return
      }
    }

    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        username: form.username.trim(),
        avatarUrl: form.avatarUrl,
      }
      if (changingPassword) {
        body.currentPassword = form.currentPassword
        body.newPassword = form.newPassword
      }

      if (useApi) {
        const data = await updateProfileApi(body)
        onSessionUpdate?.(data.session)
        onProfileSaved?.(data.user)
      } else {
        const result = updateProfileLocal(session.userId, body)
        if (!result.ok) {
          setError(result.error)
          return
        }
        onSessionUpdate?.(result.session)
        onProfileSaved?.(result.user)
      }
      toast({ message: AUTH_PROFILE.profileSaved, type: 'success' })
      setForm(f => ({
        ...f,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }))
    } catch (err) {
      setError(err.message || 'Failed to save profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    <section className="rounded-xl border border-ink-100 bg-white p-4 sm:p-5">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-ink-800">{AUTH_PROFILE.myProfile}</h3>
        <p className="text-xs text-ink-400 mt-1 leading-relaxed">{AUTH_PROFILE.myProfileHint}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
        <div className="flex flex-col items-center sm:items-start gap-2">
          <UserAvatar user={previewUser} size="lg" />
          <input ref={fileRef} type="file" accept={ACCEPTED_TYPES.join(',')} className="hidden" onChange={handlePhoto} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 px-2.5 py-1.5 rounded-lg border border-brand-200 hover:bg-brand-50 transition-all"
            >
              <Camera size={13} /> {AUTH_PROFILE.uploadPhoto}
            </button>
            {form.avatarUrl && (
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, avatarUrl: null }))}
                className="text-xs font-medium text-ink-500 hover:text-ink-700 px-2.5 py-1.5 rounded-lg border border-ink-200 hover:bg-ink-50 transition-all"
              >
                {AUTH_PROFILE.removePhoto}
              </button>
            )}
          </div>
          <p className="text-[11px] text-ink-400 text-center sm:text-left">{AUTH_PROFILE.photoHint}</p>
        </div>

        <div className="flex-1 space-y-3 min-w-0">
          <div>
            <label className="text-xs text-ink-500 mb-1 block">{AUTH_PROFILE.displayName}</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="input-base py-1.5 text-sm w-full"
              autoComplete="name"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-ink-500 mb-1 block">{AUTH_PROFILE.username}</label>
              <input
                type="text"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                className="input-base py-1.5 text-sm w-full"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="text-xs text-ink-500 mb-1 block">{AUTH_PROFILE.email}</label>
              <input
                type="text"
                value={email}
                readOnly
                className="input-base py-1.5 text-sm w-full bg-ink-50 text-ink-500 cursor-not-allowed"
              />
              <p className="text-[11px] text-ink-400 mt-1">{AUTH_PROFILE.emailHint}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 pt-4 border-t border-ink-100">
        <div className="flex items-center gap-2 mb-3">
          <Lock size={14} className="text-ink-400" />
          <p className="text-xs font-semibold text-ink-600">{AUTH_PROFILE.changePassword}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-ink-500 mb-1 block">{AUTH_PROFILE.currentPassword}</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={form.currentPassword}
                onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))}
                autoComplete="current-password"
                className="input-base py-1.5 text-sm w-full pr-8"
              />
              <button type="button" onClick={() => setShowPass(v => !v)} className="absolute right-2 top-2 text-ink-400 hover:text-ink-600">
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-ink-500 mb-1 block">{AUTH_PROFILE.newPassword}</label>
            <input
              type={showPass ? 'text' : 'password'}
              value={form.newPassword}
              onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))}
              autoComplete="new-password"
              className="input-base py-1.5 text-sm w-full"
            />
          </div>
          <div>
            <label className="text-xs text-ink-500 mb-1 block">{AUTH_PROFILE.confirmPassword}</label>
            <input
              type={showPass ? 'text' : 'password'}
              value={form.confirmPassword}
              onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
              autoComplete="new-password"
              className="input-base py-1.5 text-sm w-full"
            />
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-rose-600 mt-3">{error}</p>}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="btn-primary text-sm px-5 py-2 disabled:opacity-50"
        >
          {saving ? 'Saving…' : AUTH_PROFILE.saveProfile}
        </button>
      </div>
    </section>
    {useApi ? <TotpSettings /> : null}
    </>
  )
}

export default ProfileSettingsPanel
