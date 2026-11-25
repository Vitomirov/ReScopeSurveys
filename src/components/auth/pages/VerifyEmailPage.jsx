import { useEffect, useState } from 'react'
import { resendVerificationEmail, verifyEmail } from '@/api/auth/account'

/** One verify request per token — survives StrictMode unmount/remount in dev. */
const verifyByToken = new Map()
function exchangeVerificationToken(token) {
  let pending = verifyByToken.get(token)
  if (!pending) {
    pending = verifyEmail(token).finally(() => {
      setTimeout(() => verifyByToken.delete(token), 60_000)
    })
    verifyByToken.set(token, pending)
  }
  return pending
}
import { refreshSessionFromApi } from '@/utils/data/authStore'
import { nav } from '@/utils/routing/appRoute'
import { AUTH_ACCOUNT } from '@/constants/auth/authCopy'
import { InlineLoader } from '@/components/ui'
import { AccountPageShell, FormNotice, SignInButton } from '@/components/auth/shared/AuthFormParts.jsx'

/** Works signed in or out: the token alone proves mailbox ownership. */
export function VerifyEmailPage({ token, session, onSessionUpdate, onGoHome }) {
  const [status, setStatus] = useState(token ? 'checking' : 'invalid')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!token) return
    let alive = true
    exchangeVerificationToken(token)
      .then(async () => {
        if (session) {
          const next = await refreshSessionFromApi()
          if (alive && next) onSessionUpdate(next)
        }
        if (alive) setStatus('verified')
      })
      .catch(() => { if (alive) setStatus('invalid') })
    return () => { alive = false }
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  const resend = async () => {
    try {
      await resendVerificationEmail()
      setNotice(AUTH_ACCOUNT.verifyResent)
    } catch (err) {
      setNotice(err.message)
    }
  }

  const footer = session
    ? (
      <p className="text-sm text-ink-500 mt-5">
        <button type="button" onClick={() => nav('dashboard')} className="font-semibold text-brand-600 hover:text-brand-700">
          {AUTH_ACCOUNT.continueToDashboard}
        </button>
      </p>
    )
    : undefined

  return (
    <AccountPageShell title={AUTH_ACCOUNT.verifyTitle} onGoHome={onGoHome} footer={footer}>
      {status === 'checking' && <InlineLoader label={AUTH_ACCOUNT.verifyChecking} />}
      {status === 'verified' && (
        <div className="space-y-3.5">
          <FormNotice kind="success">{AUTH_ACCOUNT.verifySuccess}</FormNotice>
          {session
            ? (
              <button type="button" onClick={() => nav('dashboard')} className="w-full btn-primary py-2.5 justify-center">
                {AUTH_ACCOUNT.continueToDashboard}
              </button>
            )
            : <SignInButton />}
        </div>
      )}
      {status === 'invalid' && (
        <div className="space-y-3.5">
          <FormNotice>{AUTH_ACCOUNT.verifyInvalid}</FormNotice>
          {session && !session.emailVerified && (
            <button type="button" onClick={resend} className="w-full btn-primary py-2.5 justify-center">
              {AUTH_ACCOUNT.verifyResend}
            </button>
          )}
          <FormNotice kind={notice === AUTH_ACCOUNT.verifyResent ? 'success' : 'error'}>{notice}</FormNotice>
        </div>
      )}
    </AccountPageShell>
  )
}

export default VerifyEmailPage
