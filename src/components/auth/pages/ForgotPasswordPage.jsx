import { useState } from 'react'
import { forgotPassword } from '@/api/auth/account'
import { AUTH_ACCOUNT, AUTH_VALIDATION } from '@/constants/auth/authCopy'
import { AccountPageShell, Field, FormNotice, SubmitButton } from '@/components/auth/shared/AuthFormParts.jsx'

export function ForgotPasswordPage({ onGoHome }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!email.trim()) { setError(AUTH_VALIDATION.credentialsRequired); return }
    setLoading(true)
    try {
      await forgotPassword(email.trim())
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AccountPageShell title={AUTH_ACCOUNT.forgotTitle} subtitle={AUTH_ACCOUNT.forgotSubtitle} onGoHome={onGoHome}>
      {sent ? (
        <FormNotice kind="success">{AUTH_ACCOUNT.forgotSent}</FormNotice>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoFocus
              autoComplete="email"
              placeholder="you@company.com"
              className="input-base"
            />
          </Field>
          <FormNotice>{error}</FormNotice>
          <SubmitButton loading={loading}>{AUTH_ACCOUNT.forgotButton}</SubmitButton>
        </form>
      )}
    </AccountPageShell>
  )
}

export default ForgotPasswordPage
