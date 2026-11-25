import { useState } from 'react'
import { resetPassword } from '@/api/auth/account'
import { updateSession } from '@/utils/data/authStore'
import { nav } from '@/utils/routing/appRoute'
import { AUTH_ACCOUNT, AUTH_VALIDATION } from '@/constants/auth/authCopy'
import { AccountPageShell, FormNotice, PasswordField, SubmitButton } from '@/components/auth/shared/AuthFormParts.jsx'

export function ResetPasswordPage({ token, onLogin, onGoHome }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError(AUTH_VALIDATION.passwordMinLength); return }
    if (password !== confirm) { setError(AUTH_VALIDATION.passwordsMismatch); return }
    setLoading(true)
    try {
      const { session } = await resetPassword({ token, password })
      updateSession(session)
      onLogin(session)
    } catch (err) {
      setError(err.body?.code === 'INVALID_TOKEN' ? AUTH_ACCOUNT.resetInvalid : err.message)
    } finally {
      setLoading(false)
    }
  }

  const invalidLink = !token
  const requestNew = (
    <p className="text-sm text-ink-500 mt-5">
      <button type="button" onClick={() => nav('forgot-password')} className="font-semibold text-brand-600 hover:text-brand-700">
        {AUTH_ACCOUNT.forgotTitle}
      </button>
    </p>
  )

  return (
    <AccountPageShell
      title={AUTH_ACCOUNT.resetTitle}
      subtitle={invalidLink ? null : AUTH_ACCOUNT.resetSubtitle}
      onGoHome={onGoHome}
      footer={invalidLink || error === AUTH_ACCOUNT.resetInvalid ? requestNew : undefined}
    >
      {invalidLink ? (
        <FormNotice>{AUTH_ACCOUNT.resetInvalid}</FormNotice>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <PasswordField label={AUTH_ACCOUNT.newPassword} value={password} onChange={setPassword} autoFocus />
          <PasswordField label={AUTH_ACCOUNT.confirmPassword} value={confirm} onChange={setConfirm} placeholder="Re-enter password" />
          <FormNotice>{error}</FormNotice>
          <SubmitButton loading={loading}>{AUTH_ACCOUNT.resetButton}</SubmitButton>
        </form>
      )}
    </AccountPageShell>
  )
}

export default ResetPasswordPage
