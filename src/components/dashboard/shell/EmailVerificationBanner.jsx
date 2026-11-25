import { useState } from 'react'
import { MailWarning } from 'lucide-react'
import { useApi } from '@/config/api'
import { resendVerificationEmail } from '@/api/auth/account'
import { AUTH_ACCOUNT } from '@/constants/auth/authCopy'

/** Shown until a self-signup admin confirms the address that owns the account. */
export function EmailVerificationBanner({ session }) {
  const [state, setState] = useState('idle') // idle | sending | sent | error
  const [message, setMessage] = useState('')

  if (!useApi || !session || session.emailVerified !== false) return null

  const resend = async () => {
    setState('sending')
    try {
      await resendVerificationEmail()
      setState('sent')
      setMessage(AUTH_ACCOUNT.verifyResent)
    } catch (err) {
      setState('error')
      setMessage(err.message)
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <MailWarning size={16} className="text-amber-600 shrink-0" />
      <p className="text-sm text-amber-900 flex-1">
        {state === 'sent' || state === 'error' ? message : AUTH_ACCOUNT.verifyBanner}
      </p>
      {state !== 'sent' && (
        <button
          type="button"
          onClick={resend}
          disabled={state === 'sending'}
          className="text-xs font-semibold text-amber-800 hover:text-amber-950 border border-amber-300 bg-white rounded-lg px-3 py-1.5 disabled:opacity-60 shrink-0"
        >
          {state === 'sending' ? AUTH_ACCOUNT.working : AUTH_ACCOUNT.verifyBannerAction}
        </button>
      )}
    </div>
  )
}

export default EmailVerificationBanner
