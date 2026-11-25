import { signupIntentSummary } from '@shared/planCatalog.js'
import { AuthBrandAside, AuthBrandCompact, AuthHighlightList } from './AuthBrandAside.jsx'

function PlanPrice({ price, size = 'md' }) {
  if (price.type === 'label') {
    return (
      <p className={size === 'lg' ? 'text-2xl font-semibold text-white' : 'text-sm font-semibold text-brand-800'}>
        {price.label}
      </p>
    )
  }
  const amountClass = size === 'lg'
    ? 'text-4xl font-bold tracking-tight text-white tabular-nums'
    : 'text-lg font-bold text-brand-800 tabular-nums'
  const suffixClass = size === 'lg'
    ? 'text-lg font-medium text-brand-100/90'
    : 'text-sm font-medium text-brand-700/80'
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
      <span className={amountClass}>{price.amount}</span>
      {price.suffix ? <span className={suffixClass}>{price.suffix}</span> : null}
    </p>
  )
}

/** Desktop left rail — plan summary for signup. */
export function SignupPlanPanelAside({ planId }) {
  const summary = signupIntentSummary(planId)

  return (
    <AuthBrandAside
      ariaLabel="Plan summary"
      eyebrow="Your selected plan"
      title={summary.name}
      detail={summary.detail}
      highlights={summary.highlights}
      footerNote="14-day free trial · No credit card required · Cancel or change plans anytime"
    >
      <div className="mt-4">
        <PlanPrice price={summary.price} size="lg" />
      </div>
    </AuthBrandAside>
  )
}

/** Mobile — compact plan strip above the form. */
export function SignupPlanPanelCompact({ planId }) {
  const summary = signupIntentSummary(planId)

  return (
    <AuthBrandCompact
      ariaLabel="Plan summary"
      eyebrow="Selected plan"
      title={summary.name}
      detail={summary.detail}
      highlights={summary.highlights.slice(0, 3)}
    >
      <div className="mt-3 flex justify-end">
        <PlanPrice price={summary.price} size="md" />
      </div>
    </AuthBrandCompact>
  )
}
