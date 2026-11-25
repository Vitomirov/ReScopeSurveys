import { useState, useEffect, useCallback } from 'react'
import { CreditCard } from 'lucide-react'
import { useApi } from '@/config/api'
import { AUTH_BILLING, AUTH_ERRORS } from '@/constants/auth/authCopy'
import {
  fetchBillingOverview,
  fetchBillingPlans,
  changeSubscriptionPlan,
} from '@/api/platform/billing'
import { InlineLoader, Modal, StatusPill, useToast } from '@/components/ui'
import { formatMoney, formatDate } from '@/utils/format/format'
import { BillingPlanPicker, DowngradeConfirmDialog } from './BillingPlanPicker'

export function BillingPanel({ onClose, embedded = false, initialOverview = null, onOverviewChange }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(useApi)
  const [changing, setChanging] = useState(false)
  const [overview, setOverview] = useState(initialOverview)
  const [planOptions, setPlanOptions] = useState(null)
  const [pendingDowngrade, setPendingDowngrade] = useState(null)

  useEffect(() => {
    if (initialOverview) setOverview(initialOverview)
  }, [initialOverview])

  const load = useCallback(async () => {
    if (!useApi) return
    const overviewPromise = initialOverview
      ? Promise.resolve(initialOverview)
      : fetchBillingOverview()
    const [overviewData, plansData] = await Promise.all([
      overviewPromise,
      fetchBillingPlans(),
    ])
    setOverview(overviewData)
    setPlanOptions(plansData)
  }, [initialOverview])

  useEffect(() => {
    if (!useApi) {
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    Promise.all([load()])
      .catch(err => {
        if (alive) toast({ message: err.message || AUTH_ERRORS.forbidden, type: 'error' })
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [load, toast])

  const applyPlanChange = async (option) => {
    setChanging(true)
    try {
      const data = await changeSubscriptionPlan(option.planId)
      setOverview(prev => {
        const next = {
          ...prev,
          subscription: data.subscription,
          planFeatures: data.planFeatures,
          usage: data.usage,
          invoices: data.invoices ?? prev?.invoices,
        }
        onOverviewChange?.(next)
        return next
      })
      const plansData = await fetchBillingPlans()
      setPlanOptions(plansData)
      setPendingDowngrade(null)
      toast({
        message: AUTH_BILLING.planChangeSuccess,
        type: 'success',
      })
    } catch (err) {
      toast({ message: err.message || AUTH_BILLING.planChangeBlocked, type: 'error' })
    } finally {
      setChanging(false)
    }
  }

  const handleSelectPlan = (option) => {
    if (option.direction === 'downgrade') {
      setPendingDowngrade(option)
      return
    }
    applyPlanChange(option)
  }

  const sub = overview?.subscription
  const usage = overview?.usage ?? planOptions?.usage
  const planFeatures = overview?.planFeatures
  const invoices = overview?.invoices ?? []
  const isFreeTrial = planFeatures?.isFreeTrial || sub?.planId === 'free_trial'
  const surveyLimit = sub?.maxSurveys ?? planFeatures?.maxSurveys
  const showSurveyUsage = surveyLimit != null && usage

  const body = loading ? (
    <InlineLoader label="Loading billing…" />
  ) : (
    <>
      {isFreeTrial && (
        <p className="text-sm text-brand-700 bg-brand-50 border border-brand-100 rounded-xl px-4 py-3">
          {AUTH_BILLING.trialBanner}
        </p>
      )}

      {sub && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="border border-ink-100 rounded-xl p-4">
            <p className="text-xs text-ink-400 uppercase tracking-wide mb-1">{AUTH_BILLING.plan}</p>
            <p className="text-lg font-bold text-ink-800">{sub.planName}</p>
            <p className="text-sm text-ink-500 mt-1">
              {sub.priceCents === 0
                ? AUTH_BILLING.freePrice
                : `${formatMoney(sub.priceCents, sub.currency)} / month`}
            </p>
          </div>
          <div className="border border-ink-100 rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-ink-400">{AUTH_BILLING.status}</span>
              <StatusPill status={sub.status} />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-400">{AUTH_BILLING.seats}</span>
              <span className="font-medium text-ink-700">
                {usage ? `${usage.users} / ${sub.seats}` : sub.seats}
              </span>
            </div>
            {showSurveyUsage && (
              <div className="flex justify-between text-sm">
                <span className="text-ink-400">{AUTH_BILLING.surveys}</span>
                <span className="font-medium text-ink-700">{usage.surveys} / {surveyLimit}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-ink-400">{AUTH_BILLING.periodEnd}</span>
              <span className="font-medium text-ink-700">{formatDate(sub.currentPeriodEnd)}</span>
            </div>
          </div>
        </div>
      )}

      <BillingPlanPicker
        plans={planOptions?.plans}
        currency={sub?.currency}
        changing={changing}
        onSelectPlan={handleSelectPlan}
      />

      <div>
        <h3 className="text-sm font-semibold text-ink-800 mb-3">{AUTH_BILLING.invoices}</h3>
        {invoices.length === 0 ? (
          <p className="text-sm text-ink-400 text-center py-6 border border-dashed border-ink-200 rounded-xl">
            {AUTH_BILLING.noInvoices}
          </p>
        ) : (
          <div className="border border-ink-100 rounded-xl overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="bg-ink-50/80 text-xs text-ink-500 uppercase">
                  <th className="text-left px-3 py-2.5 font-semibold">Date</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Description</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Amount</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} className="border-t border-ink-50">
                    <td className="px-3 py-2.5 text-ink-600">{formatDate(inv.createdAt)}</td>
                    <td className="px-3 py-2.5 text-ink-700">{inv.description || '—'}</td>
                    <td className="px-3 py-2.5 text-right font-medium">{formatMoney(inv.amountCents, inv.currency)}</td>
                    <td className="px-3 py-2.5 text-right"><StatusPill status={inv.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )

  return (
    <>
      {embedded ? (
        <div className="space-y-8">{body}</div>
      ) : (
        <Modal
          icon={CreditCard}
          title={AUTH_BILLING.heading}
          subtitle={AUTH_BILLING.subtitle}
          onClose={onClose}
          bodyClassName="space-y-8"
          maxWidth="max-w-5xl"
        >
          {body}
        </Modal>
      )}

      <DowngradeConfirmDialog
        option={pendingDowngrade}
        changing={changing}
        onCancel={() => setPendingDowngrade(null)}
        onConfirm={() => applyPlanChange(pendingDowngrade)}
      />
    </>
  )
}

export default BillingPanel
