import { useState, useEffect } from 'react'
import { Eye, EyeOff, AlertCircle } from 'lucide-react'
import { login, signup, DEFAULT_CREDENTIALS } from '@/utils/data/authStore'
import { prefetchForRoute } from '@/utils/routing/routePrefetch'
import { AUTH_ACCOUNT, AUTH_COPY, AUTH_VALIDATION } from '@/constants/authCopy'
import { useApi } from '@/config/api'
import { SignupPlanPanelAside, SignupPlanPanelCompact } from '@/components/auth/SignupPlanPanel.jsx'
import { LoginWelcomePanelAside, LoginWelcomePanelCompact } from '@/components/auth/LoginWelcomePanel.jsx'
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout.jsx'
import { PricingCompareLink } from '@/website/components/Pricing.jsx'
import { nav } from '@/utils/routing/appRoute'
import { normalizeSignupPlanId } from '@shared/planCatalog.js'

export function LoginPage({ onLogin, initialMode = 'login', onGoHome, signupPlanId = 'free_trial' }) {
  const [mode, setMode] = useState(initialMode)

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  const [organizationName, setOrganizationName] = useState('')
  const [name,     setName]     = useState('')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [showPass, setShowPass] = useState(false)
  const [totpRequired, setTotpRequired] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const isSignup = mode === 'signup'

  const switchMode = (next) => {
    setMode(next)
    setError('')
    setPassword('')
    setConfirm('')
    setShowPass(false)
    if (next === 'signup') {
      nav('signup', null, { plan: normalizeSignupPlanId(signupPlanId) })
    } else if (initialMode === 'signup' || signupPlanId) {
      nav('login')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (isSignup) {
      if (!organizationName.trim()) { setError(AUTH_VALIDATION.orgRequired); return }
      if (!name.trim())            { setError(AUTH_VALIDATION.nameRequired); return }
      if (!email.trim() || !password) { setError(AUTH_VALIDATION.credentialsRequired); return }
      if (password.length < 8)     { setError(AUTH_VALIDATION.passwordMinLength); return }
      if (password !== confirm)    { setError(AUTH_VALIDATION.passwordsMismatch); return }

      setLoading(true)
      const result = await signup({
        organizationName,
        name,
        email,
        password,
        intendedPlanId: normalizeSignupPlanId(signupPlanId),
      })
      setLoading(false)
      if (result.ok) {
        prefetchForRoute({ session: result.session })
        onLogin(result.session)
      } else setError(result.error)
      return
    }

    if (!email || !password) { setError(AUTH_VALIDATION.loginRequired); return }
    setLoading(true)
    const result = await login(email, password, totpRequired ? totpCode : undefined)
    setLoading(false)
    if (result.code === 'TOTP_REQUIRED') {
      setTotpRequired(true)
      setError('Enter the code from your authenticator app.')
      return
    }
    if (result.ok) {
      prefetchForRoute({ session: result.session })
      onLogin(result.session)
    } else setError(result.error)
  }

  const showDevHint = !isSignup && (import.meta.env.DEV || import.meta.env.VITE_USE_API === 'true')

  const modeToggle = (
    <p className="text-sm text-ink-500 mt-5">
      {isSignup ? (
        <>
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => switchMode('login')}
            className="font-semibold text-brand-600 hover:text-brand-700"
          >
            {AUTH_COPY.signIn}
          </button>
        </>
      ) : (
        <>
          New here?{' '}
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className="font-semibold text-brand-600 hover:text-brand-700"
          >
            {AUTH_COPY.createOrgLink}
          </button>
        </>
      )}
    </p>
  )

  const authForm = (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      {isSignup && (
        <>
          <div>
            <label className="text-xs font-semibold text-ink-600 block mb-1">Organization name</label>
            <input
              type="text"
              value={organizationName}
              onChange={e => setOrganizationName(e.target.value)}
              autoFocus
              placeholder="Acme Research"
              className="input-base"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-ink-600 block mb-1">Your full name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              autoComplete="name"
              placeholder="Jane Smith"
              className="input-base"
            />
          </div>
        </>
      )}

      <div>
        <label className="text-xs font-semibold text-ink-600 block mb-1">
          {isSignup ? 'Work email' : 'Email'}
        </label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoFocus={!isSignup}
          autoComplete="email"
          placeholder={isSignup ? 'jane@company.com' : (import.meta.env.DEV ? DEFAULT_CREDENTIALS.email : 'you@company.com')}
          className="input-base"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-semibold text-ink-600 block">Password</label>
          {!isSignup && useApi && (
            <button
              type="button"
              onClick={() => nav('forgot-password')}
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              {AUTH_ACCOUNT.forgotLink}
            </button>
          )}
        </div>
        <div className="relative">
          <input
            type={showPass ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            placeholder={isSignup ? 'At least 8 characters' : '••••••••'}
            className="input-base pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPass(v => !v)}
            className="absolute right-3 top-2.5 text-ink-400 hover:text-ink-600 transition-colors"
            aria-label={showPass ? 'Hide password' : 'Show password'}
          >
            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {!isSignup && totpRequired && (
        <div>
          <label className="text-xs font-semibold text-ink-600 block mb-1">Authenticator code</label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={totpCode}
            onChange={e => setTotpCode(e.target.value)}
            className="input-base"
            autoFocus
          />
        </div>
      )}

      {isSignup && (
        <div>
          <label className="text-xs font-semibold text-ink-600 block mb-1">Confirm password</label>
          <input
            type={showPass ? 'text' : 'password'}
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            autoComplete="new-password"
            placeholder="Re-enter password"
            className="input-base"
          />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg">
          <AlertCircle size={14} className="text-rose-500 shrink-0" />
          <p className="text-sm text-rose-700">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full btn-primary py-2.5 justify-center disabled:opacity-60 mt-1"
      >
        {loading
          ? (isSignup ? AUTH_COPY.creating : AUTH_COPY.signingIn)
          : (isSignup ? AUTH_COPY.createAccountButton : AUTH_COPY.signIn)}
      </button>

    </form>
  )

  if (isSignup) {
    return (
      <AuthSplitLayout
        onGoHome={onGoHome}
        aside={<SignupPlanPanelAside planId={signupPlanId} />}
        mobileBanner={<SignupPlanPanelCompact planId={signupPlanId} />}
        title="Create your account"
        subtitle="Set up your organization in a minute. You can invite teammates after signup."
        introExtra={onGoHome ? <PricingCompareLink /> : null}
        form={authForm}
        footer={modeToggle}
      />
    )
  }

  return (
    <AuthSplitLayout
      onGoHome={onGoHome}
      aside={<LoginWelcomePanelAside />}
      mobileBanner={<LoginWelcomePanelCompact />}
      title={AUTH_COPY.loginFormTitle}
      subtitle={AUTH_COPY.loginFormSubtitle}
      form={authForm}
      footer={modeToggle}
    />
  )
}

export default LoginPage
