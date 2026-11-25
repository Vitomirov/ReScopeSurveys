import { AuthBrandAside, AuthBrandCompact } from './AuthBrandAside.jsx'
import { AUTH_LOGIN_WELCOME } from '@/constants/auth/authCopy'

const copy = AUTH_LOGIN_WELCOME

export function LoginWelcomePanelAside() {
  return (
    <AuthBrandAside
      ariaLabel="Product overview"
      eyebrow={copy.eyebrow}
      title={copy.title}
      detail={copy.detail}
      highlights={copy.highlights}
      footerNote={copy.footerNote}
    />
  )
}

export function LoginWelcomePanelCompact() {
  return (
    <AuthBrandCompact
      ariaLabel="Sign in"
      eyebrow={copy.eyebrow}
      title={copy.title}
      detail={copy.detail}
      highlights={copy.highlights.slice(0, 3)}
    />
  )
}
