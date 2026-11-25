import { Check } from 'lucide-react'
import { AUTH_BILLING } from '@/constants/auth/authCopy'
import { formatMoney } from '@/utils/format/format'

function formatPlanPrice(priceCents, currency = 'USD') {
  if (priceCents === 0) return AUTH_BILLING.freePrice
  return `${formatMoney(priceCents, currency)} / month`
}

function formatSurveyLimit(maxSurveys) {
  if (maxSurveys == null) return 'Unlimited surveys'
  return `${maxSurveys} survey${maxSurveys === 1 ? '' : 's'}`
}

function gridColsClass(count) {
  if (count <= 1) return 'md:grid-cols-1 md:max-w-xs'
  if (count === 2) return 'md:grid-cols-2'
  return 'md:grid-cols-3'
}

function PlanCard({ option, currency, changing, onSelect }) {
  const { plan, direction, selectable, blockers } = option
  const isUpgrade = direction === 'upgrade'

  return (
    <div className="flex flex-col h-full rounded-xl border border-ink-100 bg-white p-3 transition-colors">
      <div className="mb-2.5">
        <h4 className="text-sm font-bold text-ink-800 leading-tight">{plan.name}</h4>
        <p className="text-sm font-semibold text-brand-700 mt-1 tabular-nums">
          {formatPlanPrice(plan.priceCents, currency)}
        </p>
        <p className="text-[11px] text-ink-400 mt-0.5 leading-snug">
          {plan.seats} seat{plan.seats === 1 ? '' : 's'} · {formatSurveyLimit(plan.maxSurveys)}
        </p>
      </div>

      <ul className="space-y-1 mb-3 flex-1">
        {plan.highlights.map(item => (
          <li key={item} className="flex items-start gap-1.5 text-[11px] text-ink-600 leading-snug">
            <Check size={11} className="text-brand-600 shrink-0 mt-0.5" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      {selectable ? (
        <button
          type="button"
          disabled={changing}
          onClick={() => onSelect(option)}
          className={[
            'w-full text-xs font-semibold px-3 py-2 rounded-lg transition-all disabled:opacity-60 mt-auto',
            isUpgrade ? 'btn-primary justify-center' : 'btn-ghost border border-ink-200 hover:bg-ink-50',
          ].join(' ')}
        >
          {isUpgrade ? AUTH_BILLING.upgradePlan : AUTH_BILLING.downgradePlan}
        </button>
      ) : (
        <div className="space-y-1.5 mt-auto">
          <button type="button" disabled className="w-full btn-ghost border border-ink-200 text-xs py-2 opacity-50">
            {isUpgrade ? AUTH_BILLING.upgradePlan : AUTH_BILLING.downgradePlan}
          </button>
          {blockers.map(blocker => (
            <p key={blocker.code} className="text-[10px] text-amber-700 leading-snug">
              {blocker.message}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

export function BillingPlanPicker({ plans, currency, changing, onSelectPlan }) {
  if (!plans?.length) return null

  const switchable = plans.filter(p => p.direction !== 'current')
  if (!switchable.length) return null

  const count = switchable.length

  return (
    <div>
      <h3 className="text-sm font-semibold text-ink-800 mb-1">{AUTH_BILLING.changePlan}</h3>
      <p className="text-xs text-ink-400 mb-3">{AUTH_BILLING.changePlanSubtitle}</p>

      {/*
        Mobile: horizontal snap-scroll strip (one card visible at a time).
        md+: equal-width columns in a single row (2 or 3 plans).
      */}
      <div
        className={[
          'flex gap-3 overflow-x-auto overscroll-x-contain snap-x snap-mandatory pb-1 -mx-0.5 px-0.5',
          'md:grid md:overflow-visible md:snap-none md:pb-0 md:mx-0 md:px-0',
          gridColsClass(count),
        ].join(' ')}
      >
        {switchable.map(option => (
          <div
            key={option.planId}
            className="snap-start shrink-0 w-[min(72vw,13.5rem)] md:w-auto md:shrink md:snap-align-none"
          >
            <PlanCard
              option={option}
              currency={currency}
              changing={changing}
              onSelect={onSelectPlan}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export function DowngradeConfirmDialog({ option, changing, onCancel, onConfirm }) {
  if (!option) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
        <h3 className="text-base font-bold text-ink-800 mb-2">{AUTH_BILLING.confirmDowngradeTitle}</h3>
        <p className="text-sm text-ink-500 mb-4">{AUTH_BILLING.confirmDowngradeBody}</p>
        <p className="text-sm font-semibold text-ink-700 mb-2">
          Switch to {option.plan.name} ({formatPlanPrice(option.plan.priceCents)})
        </p>
        {option.warnings?.length > 0 && (
          <ul className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-4 space-y-1">
            {option.warnings.map(w => (
              <li key={w}>• {w}</li>
            ))}
          </ul>
        )}
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} disabled={changing} className="flex-1 btn-ghost border border-ink-200">
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={changing}
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all disabled:opacity-60"
          >
            {changing ? 'Updating…' : AUTH_BILLING.downgradePlan}
          </button>
        </div>
      </div>
    </div>
  )
}

export default BillingPlanPicker
