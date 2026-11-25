import { ForgotPasswordPage } from './ForgotPasswordPage.jsx'
import { ResetPasswordPage } from './ResetPasswordPage.jsx'
import { AcceptInvitePage } from './AcceptInvitePage.jsx'
import { VerifyEmailPage } from './VerifyEmailPage.jsx'

/** Routes #/forgot-password, #/reset-password, #/accept-invite, #/verify-email to their screen. */
export function AccountLinkPage({ view, token, session, onLogin, onSessionUpdate, onGoHome }) {
  switch (view) {
    case 'forgot-password':
      return <ForgotPasswordPage onGoHome={onGoHome} />
    case 'reset-password':
      return <ResetPasswordPage token={token} onLogin={onLogin} onGoHome={onGoHome} />
    case 'accept-invite':
      return <AcceptInvitePage token={token} onLogin={onLogin} onGoHome={onGoHome} />
    case 'verify-email':
      return <VerifyEmailPage token={token} session={session} onSessionUpdate={onSessionUpdate} onGoHome={onGoHome} />
    default:
      return null
  }
}

export default AccountLinkPage
