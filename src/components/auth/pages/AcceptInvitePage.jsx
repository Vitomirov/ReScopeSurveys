import { useEffect, useState } from 'react'
import { acceptInvite, previewInvite } from '@/api/auth/account'
import { updateSession } from '@/utils/data/authStore'
import { AUTH_ACCOUNT, AUTH_VALIDATION } from '@/constants/auth/authCopy'
import { InlineLoader } from '@/components/ui'
import { AccountPageShell, Field, FormNotice, PasswordField, SubmitButton } from '@/components/auth/shared/AuthFormParts.jsx'

export function AcceptInvitePage({ token, onLogin, onGoHome }) {
  const [invite, setInvite] = useState(null)
  const [checking, setChecking] = useState(Boolean(token))
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState(token ? '' : AUTH_ACCOUNT.inviteInvalid)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!token) return
    let alive = true
    previewInvite(token)
      .then(data => { if (alive) setInvite(data.invite) })
      .catch(() => { if (alive) setError(AUTH_ACCOUNT.inviteInvalid) })
      .finally(() => { if (alive) setChecking(false) })
    return () => { alive = false }
  }, [token])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!name.trim()) { setError(AUTH_VALIDATION.nameRequired); return }
    if (password.length < 8) { setError(AUTH_VALIDATION.passwordMinLength); return }
    if (password !== confirm) { setError(AUTH_VALIDATION.passwordsMismatch); return }
    setLoading(true)
    try {
      const { session } = await acceptInvite({ token, name: name.trim(), password })
      updateSession(session)
      onLogin(session)
    } catch (err) {
      setError(err.body?.code === 'INVALID_TOKEN' ? AUTH_ACCOUNT.inviteInvalid : err.message)
    } finally {
      setLoading(false)
    }
  }

  const subtitle = invite ? AUTH_ACCOUNT.inviteJoining(invite.organizationName) : AUTH_ACCOUNT.inviteSubtitle

  return (
    <AccountPageShell title={AUTH_ACCOUNT.inviteTitle} subtitle={subtitle} onGoHome={onGoHome}>
      {checking ? (
        <InlineLoader label={AUTH_ACCOUNT.inviteLoading} />
      ) : !invite ? (
        <FormNotice>{error}</FormNotice>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <Field label="Email">
            <input type="email" value={invite.email} readOnly className="input-base bg-ink-50 text-ink-500 cursor-not-allowed" />
          </Field>
          <Field label="Your full name">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              autoComplete="name"
              placeholder="Jane Smith"
              className="input-base"
            />
          </Field>
          <PasswordField label="Password" value={password} onChange={setPassword} />
          <PasswordField label={AUTH_ACCOUNT.confirmPassword} value={confirm} onChange={setConfirm} placeholder="Re-enter password" />
          <FormNotice>{error}</FormNotice>
          <SubmitButton loading={loading}>{AUTH_ACCOUNT.inviteButton}</SubmitButton>
        </form>
      )}
    </AccountPageShell>
  )
}

export default AcceptInvitePage
