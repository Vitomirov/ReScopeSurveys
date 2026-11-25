import { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react'
import {
  Building2, ChevronLeft, Plus, Search, User, Trash2,
  Users, CheckCircle2, AlertTriangle, Clock, ChevronRight,
} from 'lucide-react'
import { useApi } from '@/config/api'
import { AUTH_BILLING, AUTH_ERRORS, AUTH_PROFILE } from '@/constants/auth/authCopy'
import {
  fetchVendorOrganizations,
  fetchVendorOrganization,
  updateVendorSubscription,
  createVendorInvoice,
  deleteVendorOrganization,
} from '@/api/platform/vendor'
import { InlineLoader, StatusPill, useToast } from '@/components/ui'
import { formatMoney, formatDate } from '@/utils/format/format'
import { normalizeSurveyDomain } from '@shared/surveyUrl.js'
import {
  AppShell,
  APP_SHELL_GRID,
  APP_HEADER_PANE,
  APP_HEADER_ACTIONS,
  APP_HEADER_USER_CLUSTER,
} from '@/components/shared/layout/AppBuilderShell.jsx'
import { AppBackSlot } from '@/components/shared/layout/AppLeadingZone.jsx'
import { AppLogo } from '@/components/shared/branding/AppLogo.jsx'
import { HeaderLogoutButton } from '@/components/shared/layout/HeaderLogoutButton.jsx'
import { AppContentShell } from '@/components/shared/layout/AppContentShell.jsx'
import { AppWorkspaceColumns } from '@/components/shared/layout/AppWorkspaceColumns.jsx'
import { roleLabel } from '@/utils/platform/permissions'
import { UserAvatar } from './UserAvatar.jsx'

const AccountSettingsModal = lazy(() => import('./AccountSettingsModal.jsx'))

const PLANS = [
  { id: 'free_trial', name: 'Free Trial' },
  { id: 'starter', name: 'Starter' },
  { id: 'professional', name: 'Professional' },
  { id: 'enterprise', name: 'Enterprise' },
]

const STATUSES = ['trialing', 'active', 'past_due', 'canceled']

function applyDetailToForm(detail, setters) {
  setters.setDetail(detail)
  setters.setPlanId(detail.subscription.planId)
  setters.setStatus(detail.subscription.status)
  setters.setSurveyDomain(detail.organization.surveyDomain || '')
}

function OrgDetail({ orgId, cachedDetail, onCacheDetail, onOrgListPatch, onBack, onDeleted }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(!cachedDetail)
  const [detail, setDetail] = useState(cachedDetail ?? null)
  const [planId, setPlanId] = useState(cachedDetail?.subscription?.planId ?? 'starter')
  const [status, setStatus] = useState(cachedDetail?.subscription?.status ?? 'active')
  const [surveyDomain, setSurveyDomain] = useState(cachedDetail?.organization?.surveyDomain ?? '')
  const [saving, setSaving] = useState(false)
  const [invoiceAmount, setInvoiceAmount] = useState('')
  const [invoiceDesc, setInvoiceDesc] = useState('')
  const [showDelete, setShowDelete] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const orgData = await fetchVendorOrganization(orgId)
      applyDetailToForm(orgData, { setDetail, setPlanId, setStatus, setSurveyDomain })
      onCacheDetail(orgId, orgData)
    } catch (err) {
      toast({ message: err.message || AUTH_ERRORS.forbidden, type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [orgId, toast, onCacheDetail])

  useEffect(() => {
    if (cachedDetail) {
      applyDetailToForm(cachedDetail, { setDetail, setPlanId, setStatus, setSurveyDomain })
      setLoading(false)
      return
    }
    load()
  }, [orgId, cachedDetail, load])

  const saveSubscription = async () => {
    setSaving(true)
    try {
      const data = await updateVendorSubscription(orgId, {
        planId,
        status,
        surveyDomain: planId === 'enterprise' ? surveyDomain : '',
      })
      setDetail(prev => {
        const next = {
          ...prev,
          subscription: data.subscription,
          organization: {
            ...prev.organization,
            surveyDomain: data.surveyDomain || '',
          },
        }
        onCacheDetail(orgId, next)
        onOrgListPatch(orgId, {
          subscription: data.subscription,
        })
        return next
      })
      setSurveyDomain(data.surveyDomain || '')
      toast({ message: 'Subscription updated.', type: 'success' })
    } catch (err) {
      toast({ message: err.message || AUTH_ERRORS.forbidden, type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const addInvoice = async (e) => {
    e.preventDefault()
    const cents = Math.round(Number(invoiceAmount) * 100)
    if (!cents || cents <= 0) return
    try {
      const data = await createVendorInvoice(orgId, {
        amountCents: cents,
        status: 'open',
        description: invoiceDesc.trim() || `${detail?.organization?.name} subscription`,
      })
      setDetail(prev => {
        const next = {
          ...prev,
          invoices: [data.invoice, ...(prev.invoices || [])],
        }
        onCacheDetail(orgId, next)
        return next
      })
      setInvoiceAmount('')
      setInvoiceDesc('')
      toast({ message: 'Invoice created.', type: 'success' })
    } catch (err) {
      toast({ message: err.message || AUTH_ERRORS.forbidden, type: 'error' })
    }
  }

  const handleDelete = async () => {
    if (!organization || confirmName.trim() !== organization.name) return
    setDeleting(true)
    try {
      await deleteVendorOrganization(orgId, { confirmName: confirmName.trim() })
      toast({ message: AUTH_BILLING.deleteOrgSuccess, type: 'success' })
      setShowDelete(false)
      setConfirmName('')
      onDeleted?.(orgId)
    } catch (err) {
      const message = err.body?.code === 'ORG_DELETE_FORBIDDEN'
        ? AUTH_BILLING.deleteOrgForbidden
        : (err.message || AUTH_ERRORS.forbidden)
      toast({ message, type: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  const closeDeleteModal = () => {
    if (deleting) return
    setShowDelete(false)
    setConfirmName('')
  }

  if (loading) return <InlineLoader label="Loading organization…" />
  if (!detail) {
    return <p className="text-sm text-ink-400 text-center py-8">Could not load organization.</p>
  }

  const { organization, subscription, invoices } = detail

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 mb-4 min-h-[44px]"
      >
        <ChevronLeft size={16} /> Back to organizations
      </button>

      <div className="mb-6">
        <h3 className="font-semibold text-ink-800 text-lg">{organization.name}</h3>
        <p className="text-xs text-ink-400 mt-1">
          {organization.userCount} users · {organization.surveyCount} surveys · joined {formatDate(organization.createdAt)}
        </p>
      </div>

      <div className="card p-4 mb-6 space-y-3">
        <h4 className="text-sm font-semibold text-ink-800">Subscription</h4>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="text-ink-500 text-xs block mb-1">Plan</span>
            <select value={planId} onChange={e => setPlanId(e.target.value)} className="input-base w-full text-sm">
              {PLANS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-ink-500 text-xs block mb-1">Status</span>
            <select value={status} onChange={e => setStatus(e.target.value)} className="input-base w-full text-sm">
              {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </label>
        </div>
        {planId === 'enterprise' && (
          <label className="text-sm block">
            <span className="text-ink-500 text-xs block mb-1">Survey domain</span>
            <input
              type="text"
              value={surveyDomain}
              onChange={e => setSurveyDomain(e.target.value)}
              placeholder="domain.com"
              className="input-base w-full text-sm font-mono"
            />
            <span className="text-xs text-ink-400 mt-1 block">
              Used in public survey URLs, e.g. https://{normalizeSurveyDomain(surveyDomain) || 'client.com'}/project-name-date
            </span>
          </label>
        )}
        <p className="text-xs text-ink-400">
          Current: {subscription.planName} · {formatMoney(subscription.priceCents)} · renews {formatDate(subscription.currentPeriodEnd)}
        </p>
        <button type="button" onClick={saveSubscription} disabled={saving} className="btn-primary text-sm px-4">
          {saving ? 'Saving…' : 'Save subscription'}
        </button>
      </div>

      <div className="card p-4">
        <h4 className="text-sm font-semibold text-ink-800 mb-3">Create invoice</h4>
        <form onSubmit={addInvoice} className="flex flex-wrap gap-2 items-end">
          <label className="text-sm">
            <span className="text-ink-500 text-xs block mb-1">Amount (USD)</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={invoiceAmount}
              onChange={e => setInvoiceAmount(e.target.value)}
              className="input-base w-28 text-sm"
            />
          </label>
          <label className="text-sm flex-1 min-w-[160px]">
            <span className="text-ink-500 text-xs block mb-1">Description</span>
            <input
              value={invoiceDesc}
              onChange={e => setInvoiceDesc(e.target.value)}
              className="input-base w-full text-sm"
              placeholder="Optional"
            />
          </label>
          <button type="submit" className="btn-primary text-sm px-3 flex items-center gap-1">
            <Plus size={14} /> Add
          </button>
        </form>

        {invoices?.length > 0 && (
          <div className="mt-4 border-t border-ink-50 pt-3 space-y-2">
            {invoices.slice(0, 6).map(inv => (
              <div key={inv.id} className="flex justify-between items-center text-sm">
                <span className="text-ink-600">{inv.description || formatDate(inv.createdAt)}</span>
                <span className="flex items-center gap-2 font-medium">
                  {formatMoney(inv.amountCents)} <StatusPill status={inv.status} />
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card border-rose-200 bg-rose-50/30 p-4 mt-6">
        <h4 className="text-sm font-semibold text-rose-800">{AUTH_BILLING.dangerZone}</h4>
        <p className="text-xs text-rose-700/80 mt-1 mb-4 leading-relaxed">
          {AUTH_BILLING.deleteOrgHint}
        </p>
        <button
          type="button"
          onClick={() => setShowDelete(true)}
          className="inline-flex items-center gap-2 bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300 text-sm font-semibold px-4 py-2 rounded-lg transition-all focus-ring"
        >
          <Trash2 size={14} />
          {AUTH_BILLING.deleteOrg}
        </button>
      </div>

      {showDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <div className="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-rose-500" />
            </div>
            <h3 className="text-base font-bold text-ink-800 mb-2 text-center">
              {AUTH_BILLING.deleteOrgConfirmTitle}
            </h3>
            <p className="text-sm text-ink-500 mb-4 text-center">
              {AUTH_BILLING.deleteOrgConfirmBody}
            </p>
            <div className="rounded-lg bg-ink-50 border border-ink-100 px-3 py-2.5 mb-4 text-xs text-ink-600 space-y-1">
              <p><strong className="text-ink-800">{organization.name}</strong></p>
              <p>{organization.userCount} users · {organization.surveyCount} surveys</p>
            </div>
            <label className="block text-sm mb-4">
              <span className="text-ink-500 text-xs block mb-1.5">{AUTH_BILLING.deleteOrgTypeName}</span>
              <input
                type="text"
                value={confirmName}
                onChange={e => setConfirmName(e.target.value)}
                placeholder={organization.name}
                autoFocus
                className="input-base w-full text-sm"
              />
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleting}
                className="flex-1 btn-ghost border border-ink-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || confirmName.trim() !== organization.name}
                className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:hover:bg-rose-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all"
              >
                {deleting ? 'Deleting…' : AUTH_BILLING.deleteOrg}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ConsoleUserMenu({ session, onOpenAccount }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  if (!session) return null

  const accountLabel = session.name || session.username

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`flex items-center justify-center w-10 h-10 rounded-full transition-all focus-ring ${
          open
            ? 'ring-2 ring-brand-500/40 ring-offset-2 bg-brand-50/60'
            : 'hover:bg-ink-50 hover:ring-2 hover:ring-ink-200/80'
        }`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu, ${accountLabel}`}
        title={accountLabel}
      >
        <UserAvatar user={session} size="sm" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] w-64 bg-white border border-ink-200 rounded-2xl shadow-xl shadow-ink-900/10 p-2 z-50"
        >
          <div className="flex items-center gap-3 px-2 py-2.5 mb-1">
            <UserAvatar user={session} size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink-800 truncate">
                {session.name || session.username}
              </p>
              <p className="text-xs text-ink-400 truncate">@{session.username}</p>
              {session.organizationName && (
                <p className="text-xs text-ink-500 truncate mt-0.5">{session.organizationName}</p>
              )}
            </div>
          </div>
          <div className="px-2 pb-2">
            <span className="inline-flex text-[10px] font-bold uppercase tracking-wider text-violet-700 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full">
              {roleLabel(session.role)}
            </span>
          </div>

          <div className="border-t border-ink-100 my-1.5 pt-1.5">
            <button
              type="button"
              onClick={() => { setOpen(false); onOpenAccount?.() }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 rounded-lg transition-colors text-left"
            >
              <User size={15} className="text-ink-400 shrink-0" />
              {AUTH_PROFILE.myAccount}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function OrgStats({ orgs }) {
  const counts = useMemo(() => {
    const c = { orgs: orgs.length, active: 0, trialing: 0, pastDue: 0, users: 0 }
    orgs.forEach(org => {
      c.users += org.userCount || 0
      const status = org.subscription?.status
      if (status === 'active') c.active++
      else if (status === 'trialing') c.trialing++
      else if (status === 'past_due') c.pastDue++
    })
    return c
  }, [orgs])

  const cards = [
    { label: 'Organizations', short: 'Orgs', value: counts.orgs, icon: Building2, color: 'text-violet-600 bg-violet-50' },
    { label: 'Active', short: 'Active', value: counts.active, icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Trials', short: 'Trials', value: counts.trialing, icon: Clock, color: 'text-sky-600 bg-sky-50' },
    { label: 'Past due', short: 'Past due', value: counts.pastDue, icon: AlertTriangle, color: 'text-amber-600 bg-amber-50' },
    { label: 'Users', short: 'Users', value: counts.users, icon: Users, color: 'text-brand-600 bg-brand-50' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mb-4 sm:mb-6">
      {cards.map(card => (
        <div key={card.label} className="card px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3 min-w-0">
          <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center shrink-0 ${card.color}`}>
            <card.icon size={16} className="sm:hidden" />
            <card.icon size={18} className="hidden sm:block" />
          </div>
          <div className="min-w-0">
            <p className="text-lg sm:text-xl font-bold text-ink-800 leading-none">{card.value}</p>
            <p className="text-[11px] sm:text-xs text-ink-400 mt-0.5 leading-tight">
              <span className="sm:hidden">{card.short}</span>
              <span className="hidden sm:inline">{card.label}</span>
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

export function PlatformConsole({ session, onLogout, onSessionUpdate }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(useApi)
  const [orgs, setOrgs] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [search, setSearch] = useState('')
  const [showAccount, setShowAccount] = useState(false)
  const detailCache = useRef(new Map())

  const loadOrgs = useCallback(async () => {
    if (!useApi) {
      setOrgs([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setOrgs(await fetchVendorOrganizations())
    } catch (err) {
      toast({ message: err.message || AUTH_ERRORS.forbidden, type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadOrgs() }, [loadOrgs])

  const cacheDetail = useCallback((orgId, detail) => {
    detailCache.current.set(orgId, detail)
  }, [])

  const patchOrgInList = useCallback((orgId, { subscription }) => {
    setOrgs(prev => prev.map(org => (
      org.id === orgId
        ? { ...org, subscription }
        : org
    )))
  }, [])

  const handleBack = useCallback(() => {
    setSelectedId(null)
  }, [])

  const handleOrgDeleted = useCallback((orgId) => {
    detailCache.current.delete(orgId)
    setOrgs(prev => prev.filter(org => org.id !== orgId))
    setSelectedId(null)
  }, [])

  const displayed = useMemo(() => {
    if (!search.trim()) return orgs
    const q = search.trim().toLowerCase()
    return orgs.filter(org => org.name.toLowerCase().includes(q))
  }, [orgs, search])

  return (
    <div className="h-screen bg-surface flex flex-col overflow-hidden">
      <header className="bg-white/95 backdrop-blur-md border-b border-ink-200/80 sticky top-0 z-30 safe-top">
        <AppShell>
          <div className={`${APP_SHELL_GRID} items-center min-h-[4.25rem] py-3`}>
            <AppBackSlot />

            <div className={APP_HEADER_PANE}>
              <AppLogo onClick={handleBack} size="md" className="shrink-0 min-w-0" />
              <span className="w-px h-5 bg-ink-200 shrink-0 hidden sm:block" aria-hidden />
              <div className="min-w-0 flex items-center gap-2 hidden sm:flex">
                <p className="text-sm font-semibold text-ink-800 truncate">
                  {AUTH_BILLING.platformHeading}
                </p>
                <span className="inline-flex text-[10px] font-bold uppercase tracking-wider text-violet-700 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded-full shrink-0">
                  Owner
                </span>
              </div>

              <div className={APP_HEADER_ACTIONS}>
                <div className={APP_HEADER_USER_CLUSTER}>
                  <ConsoleUserMenu
                    session={session}
                    onOpenAccount={() => setShowAccount(true)}
                  />
                  <HeaderLogoutButton onLogout={onLogout} className="-mr-1 sm:mr-0" />
                </div>
              </div>
            </div>
          </div>
        </AppShell>
      </header>

      <AppContentShell className="flex-1 min-h-0 overflow-y-auto py-4 sm:py-6">
        <AppWorkspaceColumns showRail={false}>
          {selectedId ? (
            <OrgDetail
              orgId={selectedId}
              cachedDetail={detailCache.current.get(selectedId) ?? null}
              onCacheDetail={cacheDetail}
              onOrgListPatch={patchOrgInList}
              onBack={handleBack}
              onDeleted={handleOrgDeleted}
            />
          ) : (
            <>
              <div className="mb-4 sm:mb-5">
                <h1 className="text-lg sm:text-xl font-bold text-ink-800">
                  {AUTH_BILLING.platformHeading}
                </h1>
                <p className="text-sm text-ink-400 mt-0.5">
                  {AUTH_BILLING.platformSubtitle}
                </p>
              </div>

              <OrgStats orgs={orgs} />

              {loading ? (
                <InlineLoader label="Loading organizations…" />
              ) : orgs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
                    <Building2 size={28} className="text-violet-400" />
                  </div>
                  <h3 className="text-base font-semibold text-ink-700 mb-1">{AUTH_BILLING.noOrgs}</h3>
                  <p className="text-sm text-ink-400">{AUTH_BILLING.platformEmptyHint}</p>
                </div>
              ) : (
                <>
                  <div className="card p-3 sm:p-4 mb-4">
                    <div className="flex items-center gap-2 bg-ink-50 rounded-lg px-3 py-2.5 min-h-[44px]">
                      <Search size={16} className="text-ink-400 shrink-0" />
                      <input
                        type="search"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={AUTH_BILLING.searchOrgs}
                        className="bg-transparent border-none outline-none text-sm flex-1 min-w-0 text-ink-700 placeholder:text-ink-400"
                      />
                    </div>
                    <p className="text-xs text-ink-400 mt-3 flex items-center justify-between gap-2">
                      <span>{AUTH_BILLING.selectOrg}</span>
                      <span className="shrink-0">{displayed.length} of {orgs.length}</span>
                    </p>
                  </div>

                  {displayed.length === 0 ? (
                    <div className="card p-8 text-center text-sm text-ink-400">
                      No organizations match the current search.
                    </div>
                  ) : (
                    <>
                      <div className="md:hidden space-y-3">
                        {displayed.map(org => (
                          <button
                            key={org.id}
                            type="button"
                            onClick={() => setSelectedId(org.id)}
                            className="card p-4 w-full text-left active:bg-ink-50 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-semibold text-ink-800 truncate">{org.name}</p>
                                <p className="text-xs text-ink-500 mt-1">
                                  {org.subscription?.planName ?? '—'}
                                  {' · '}
                                  {org.userCount} users
                                </p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {org.subscription?.status
                                  ? <StatusPill status={org.subscription.status} />
                                  : null}
                                <ChevronRight size={16} className="text-ink-300" />
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>

                      <div className="hidden md:block card overflow-x-auto">
                        <table className="w-full text-sm min-w-[560px]">
                          <thead>
                            <tr className="border-b border-ink-100 bg-ink-50/60">
                              <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-500 uppercase tracking-wider">Organization</th>
                              <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-500 uppercase tracking-wider">Plan</th>
                              <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-500 uppercase tracking-wider">Status</th>
                              <th className="text-right px-4 py-2.5 text-xs font-semibold text-ink-500 uppercase tracking-wider">Users</th>
                              <th className="text-right px-4 py-2.5 text-xs font-semibold text-ink-500 uppercase tracking-wider">Surveys</th>
                              <th className="w-10" />
                            </tr>
                          </thead>
                          <tbody>
                            {displayed.map(org => (
                              <tr
                                key={org.id}
                                className="border-b border-ink-50 hover:bg-violet-50/40 cursor-pointer transition-colors"
                                onClick={() => setSelectedId(org.id)}
                              >
                                <td className="px-4 py-3 font-medium text-ink-800">{org.name}</td>
                                <td className="px-4 py-3 text-ink-600">{org.subscription?.planName ?? '—'}</td>
                                <td className="px-4 py-3">
                                  {org.subscription?.status
                                    ? <StatusPill status={org.subscription.status} />
                                    : <span className="text-ink-300">—</span>}
                                </td>
                                <td className="px-4 py-3 text-right text-ink-600">{org.userCount}</td>
                                <td className="px-4 py-3 text-right text-ink-600">{org.surveyCount}</td>
                                <td className="px-2 py-3 text-ink-300">
                                  <ChevronRight size={16} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </AppWorkspaceColumns>
      </AppContentShell>

      {showAccount && session && (
        <Suspense fallback={
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
            <InlineLoader label="Loading account…" />
          </div>
        }>
          <AccountSettingsModal
            session={session}
            onSessionUpdate={onSessionUpdate}
            onClose={() => setShowAccount(false)}
          />
        </Suspense>
      )}
    </div>
  )
}

export default PlatformConsole
