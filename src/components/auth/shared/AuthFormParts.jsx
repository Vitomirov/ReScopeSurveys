import { useState } from 'react'
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react'
import { AuthSplitLayout } from '@/components/auth/layout/AuthSplitLayout.jsx'
import { LoginWelcomePanelAside, LoginWelcomePanelCompact } from '@/components/auth/layout/LoginWelcomePanel.jsx'
import { AUTH_ACCOUNT, AUTH_COPY } from '@/constants/auth/authCopy'
import { nav } from '@/utils/routing/appRoute'

/** Sign-in styled page shell used by every account-link screen. */
export function AccountPageShell({ title, subtitle, children, footer, onGoHome }) {
  return (
    <AuthSplitLayout
      onGoHome={onGoHome}
      aside={<LoginWelcomePanelAside />}
      mobileBanner={<LoginWelcomePanelCompact />}
      title={title}
      subtitle={subtitle}
      form={children}
      footer={footer ?? <BackToSignIn />}
    />
  )
}

export function BackToSignIn({ label = AUTH_ACCOUNT.backToSignIn }) {
  return (
    <p className="text-sm text-ink-500 mt-5">
      <button type="button" onClick={() => nav('login')} className="font-semibold text-brand-600 hover:text-brand-700">
        {label}
      </button>
    </p>
  )
}

export function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink-600 block mb-1">{label}</label>
      {children}
    </div>
  )
}

export function PasswordField({ label, value, onChange, placeholder = 'At least 8 characters', autoFocus = false }) {
  const [show, setShow] = useState(false)
  return (
    <Field label={label}>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete="new-password"
          autoFocus={autoFocus}
          placeholder={placeholder}
          className="input-base pr-10"
        />
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          className="absolute right-3 top-2.5 text-ink-400 hover:text-ink-600 transition-colors"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </Field>
  )
}

export function FormNotice({ kind = 'error', children }) {
  if (!children) return null
  const error = kind === 'error'
  return (
    <div className={`flex items-start gap-2 p-3 rounded-lg border ${error ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
      {error
        ? <AlertCircle size={14} className="text-rose-500 shrink-0 mt-0.5" />
        : <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />}
      <p className={`text-sm ${error ? 'text-rose-700' : 'text-emerald-800'}`}>{children}</p>
    </div>
  )
}

export function SubmitButton({ loading, children }) {
  return (
    <button type="submit" disabled={loading} className="w-full btn-primary py-2.5 justify-center disabled:opacity-60 mt-1">
      {loading ? AUTH_ACCOUNT.working : children}
    </button>
  )
}

export function SignInButton() {
  return (
    <button type="button" onClick={() => nav('login')} className="w-full btn-primary py-2.5 justify-center">
      {AUTH_COPY.signIn}
    </button>
  )
}
