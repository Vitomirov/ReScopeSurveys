import { useEffect, useState } from 'react'
import { apiFetch } from '@/api/client'

/**
 * Optional authenticator. Password login is unchanged until the user turns this on.
 */
export function TotpSettings() {
  const [enabled, setEnabled] = useState(false)
  const [secret, setSecret] = useState('')
  const [otpauth, setOtpauth] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiFetch('/api/auth/totp')
      .then((data) => { if (!cancelled) setEnabled(Boolean(data?.enabled)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  async function start() {
    setError('')
    setBusy(true)
    try {
      const data = await apiFetch('/api/auth/totp/setup', { method: 'POST', body: {} })
      setSecret(data.secret)
      setOtpauth(data.otpauth)
    } catch (err) {
      setError(err.message || 'Authenticator is not available.')
    } finally {
      setBusy(false)
    }
  }

  async function enable() {
    setError('')
    setBusy(true)
    try {
      await apiFetch('/api/auth/totp/enable', { method: 'POST', body: { secret, code } })
      setEnabled(true)
      setSecret('')
      setOtpauth('')
      setCode('')
    } catch (err) {
      setError(err.message || 'Could not turn on the authenticator.')
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setError('')
    setBusy(true)
    try {
      await apiFetch('/api/auth/totp/disable', { method: 'POST', body: { password, code } })
      setEnabled(false)
      setPassword('')
      setCode('')
    } catch (err) {
      setError(err.message || 'Could not turn off the authenticator.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-xl border border-ink-100 bg-white p-4 sm:p-5 mt-4">
      <h3 className="text-sm font-bold text-ink-800">Authenticator</h3>
      <p className="text-xs text-ink-400 mt-1 leading-relaxed">
        Optional. Sign-in stays password-only until you turn this on.
      </p>
      {enabled ? (
        <div className="mt-3 space-y-2">
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Current password"
            autoComplete="current-password"
            className="input-base py-1.5 text-sm w-full"
          />
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="Authenticator code"
            autoComplete="one-time-code"
            className="input-base py-1.5 text-sm w-full"
          />
          <button type="button" onClick={disable} disabled={busy} className="text-sm px-4 py-2 rounded-lg border border-ink-200">
            Turn off
          </button>
        </div>
      ) : secret ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-ink-600 break-all">Secret: {secret}</p>
          <p className="text-xs text-ink-400 break-all">{otpauth}</p>
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="Code from the app"
            autoComplete="one-time-code"
            className="input-base py-1.5 text-sm w-full"
          />
          <button type="button" onClick={enable} disabled={busy} className="btn-primary text-sm px-4 py-2">
            Confirm
          </button>
        </div>
      ) : (
        <button type="button" onClick={start} disabled={busy} className="mt-3 text-sm px-4 py-2 rounded-lg border border-ink-200">
          Set up authenticator
        </button>
      )}
      {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}
    </section>
  )
}
