import { useState, useMemo, useEffect, useCallback, useRef, useLayoutEffect, lazy, Suspense } from 'react'
import {
  Plus, Search, MoreVertical, Settings,
  Copy, Trash2, ExternalLink, ChevronUp, ChevronDown,
  Layers, BarChart3, Clock, CheckCircle2, XCircle,
  PlayCircle, PauseCircle, Edit3, Eye,
} from 'lucide-react'
import {
  loadLibrary, deleteSurvey, duplicateSurvey, buildClonedSurvey,
} from '@/utils/data/surveyLibrary'
import { useApi } from '@/config/api'
import { AUTH_ERRORS } from '@/constants/authCopy'
import { DEFAULT_SURVEY_TITLE } from '@/constants/surveyDefaults'
import {
  getSurvey, deleteSurveyApi, migrateLocalLibrary,
  metaToLibraryEntry, patchSurvey,
} from '@/api/survey/surveys'
import { getDashboard } from '@/api/platform/dashboard'
import { fetchClients, fetchTopics, fetchSurveyTypes } from '@/api/platform/platform'
import {
  loadClients, loadTopics, loadSurveyTypes,
  SURVEY_STATUSES,
} from '@/utils/data/platformStore'
import { countResponsesForSurveys } from '@/utils/data/responseStore'
import { resolveClientName, resolveTopicName, resolveSurveyTypeName } from '@/utils/platform/platformResolve'
import { InlineLoader, useToast } from '@/components/ui'
import { AppContentShell } from '@/components/shared/layout/AppContentShell.jsx'
import { AppWorkspaceColumns } from '@/components/shared/layout/AppWorkspaceColumns.jsx'
import { prefetchBuilder, prefetchPreview } from '@/utils/routing/routePrefetch'
import {
  canManagePlatform, canSeeAllSurveys, filterSurveysForSession,
} from '@/utils/platform/permissions'
import { useResponseNotifications } from '@/hooks/useResponseNotifications'
import { EmailVerificationBanner } from './EmailVerificationBanner.jsx'

const PlatformSettings = lazy(() => import('./PlatformSettings.jsx'))
const TeamPanel        = lazy(() => import('./TeamPanel.jsx'))
const TeamMembersModal = lazy(() => import('./TeamMembersModal.jsx'))
const DashboardHeader  = lazy(() => import('./DashboardHeader.jsx'))
const AccountSettingsModal = lazy(() => import('./AccountSettingsModal.jsx'))

// ─── Helpers ───────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = new Date()
  const diff = now - d
  if (diff < 60000)   return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000)return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
  return d.toLocaleDateString(undefined, { day:'2-digit', month:'short', year:'numeric' })
}

function StatusBadge({ statusId }) {
  const s = SURVEY_STATUSES.find(x => x.id === statusId) || SURVEY_STATUSES[0]
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${s.color}`}>
      {s.label}
    </span>
  )
}

function SortIcon({ field, sort }) {
  if (sort.field !== field) return <ChevronUp size={12} className="text-ink-200" />
  return sort.dir === 'asc'
    ? <ChevronUp size={12} className="text-brand-500" />
    : <ChevronDown size={12} className="text-brand-500" />
}

function ResponsesCount({ total, complete, newCount, compact, onOpenNew }) {
  if (!(total > 0) && !(newCount > 0)) {
    return <span className="text-xs text-ink-300">No data</span>
  }

  if (newCount > 0) {
    if (compact) {
      return (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpenNew?.() }}
          className="inline-flex items-center gap-1.5 bg-brand-50 border border-brand-200 rounded-lg px-2 py-1 text-xs text-ink-500 hover:bg-brand-100/80 focus-ring"
        >
          {total > 0 && (
            <>
              <strong className="text-ink-700">{total}</strong>
              <span>responses ·</span>
            </>
          )}
          <span className="text-brand-700 font-semibold">{newCount} New</span>
        </button>
      )
    }
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onOpenNew?.() }}
        className="inline-flex flex-col items-start bg-brand-50 border border-brand-200 rounded-lg px-2 py-1 hover:bg-brand-100/80 focus-ring"
      >
        <span className="text-sm font-bold text-ink-700">{total}</span>
        <span className="text-xs text-brand-700 font-semibold">{newCount} New</span>
      </button>
    )
  }

  if (compact) {
    return (
      <span>
        <strong className="text-ink-700">{total}</strong> responses
      </span>
    )
  }

  return (
    <div>
      <p className="text-sm font-bold text-ink-700">{total}</p>
      <p className="text-xs text-ink-400">{complete} complete</p>
    </div>
  )
}

// ─── Context menu ──────────────────────────────────────────────────────────
function SurveyMenu({ onOpen, onPreview, onDuplicate, onDelete }) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState(null)
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  const placeMenu = useCallback(() => {
    const btn = btnRef.current
    const menu = menuRef.current
    if (!btn) return

    const rect = btn.getBoundingClientRect()
    const gap = 4
    const right = window.innerWidth - rect.right
    const menuHeight = menu?.offsetHeight ?? 188
    const spaceBelow = window.innerHeight - rect.bottom - gap
    const spaceAbove = rect.top - gap

    if (spaceBelow >= menuHeight || spaceBelow >= spaceAbove) {
      setMenuStyle({ top: rect.bottom + gap, right })
    } else {
      setMenuStyle({ bottom: window.innerHeight - rect.top + gap, right })
    }
  }, [])

  useLayoutEffect(() => {
    if (!open) return undefined
    placeMenu()
    const sync = () => placeMenu()
    window.addEventListener('resize', sync)
    window.addEventListener('scroll', sync, true)
    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('scroll', sync, true)
    }
  }, [open, placeMenu])

  const handleOpen = (e) => {
    e.stopPropagation()
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setMenuStyle({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
    setOpen(o => !o)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        className="p-2.5 text-ink-500 hover:text-ink-800 hover:bg-ink-100 active:bg-ink-200 rounded-lg transition-all focus-ring min-h-[44px] min-w-[44px] flex items-center justify-center"
      >
        <MoreVertical size={15} />
      </button>
      {open && menuStyle && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            ref={menuRef}
            className="fixed z-50 bg-white border border-ink-200 rounded-xl shadow-xl py-1 w-48 max-h-[calc(100vh-1rem)] overflow-y-auto"
            style={menuStyle}
          >
            <button onClick={() => { setOpen(false); onOpen() }}
              onMouseEnter={prefetchBuilder}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-ink-50 text-ink-700">
              <Edit3 size={14} /> Open in builder
            </button>
            <button onClick={() => { setOpen(false); onPreview() }}
              onMouseEnter={prefetchPreview}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-ink-50 text-ink-700">
              <Eye size={14} /> Preview
            </button>
            <button onClick={() => { setOpen(false); onDuplicate() }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-ink-50 text-ink-700">
              <Copy size={14} /> Duplicate
            </button>
            <div className="border-t border-ink-100 my-1" />
            <button onClick={() => { setOpen(false); onDelete() }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-rose-50 text-rose-600">
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </>
      )}
    </>
  )
}

// ─── Stats bar ─────────────────────────────────────────────────────────────
function StatsBar({ surveys }) {
  const counts = useMemo(() => {
    const c = { total: surveys.length, draft: 0, live: 0, paused: 0, closed: 0 }
    surveys.forEach(s => { if (c[s.survey?.status] !== undefined) c[s.survey?.status]++ })
    return c
  }, [surveys])

  const cards = [
    { label: 'Total surveys', short: 'Total', value: counts.total, icon: Layers,       color: 'text-brand-600 bg-brand-50' },
    { label: 'Live',          short: 'Live',  value: counts.live,  icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Drafts',        short: 'Drafts', value: counts.draft, icon: Edit3,        color: 'text-ink-600 bg-ink-100' },
    { label: 'Paused',        short: 'Paused', value: counts.paused, icon: PauseCircle, color: 'text-amber-600 bg-amber-50' },
    { label: 'Closed',        short: 'Closed', value: counts.closed, icon: XCircle,     color: 'text-rose-600 bg-rose-50' },
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

// ─── Main Dashboard ────────────────────────────────────────────────────────
export function Dashboard({ onOpenSurvey, onNewSurvey, onPreviewSurvey, session, onLogout, onSessionUpdate, panelOnly = false }) {
  const { toast } = useToast()
  const isAdmin = canSeeAllSurveys(session)
  const [tick, setTick]             = useState(0)
  const [apiSurveys, setApiSurveys] = useState([])
  const [apiClients, setApiClients] = useState([])
  const [apiTopics,  setApiTopics]  = useState([])
  const [apiSurveyTypes, setApiSurveyTypes] = useState([])
  const [apiLoading, setApiLoading] = useState(useApi)
  const [search, setSearch]         = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterTopic,  setFilterTopic]  = useState('')
  const [filterType,   setFilterType]   = useState('')
  const [filterOwner,  setFilterOwner]  = useState('')
  const [sort, setSort]             = useState({ field: 'updatedAt', dir: 'desc' })
  const [showSettings, setShowSettings] = useState(false)
  const [showAccount, setShowAccount]     = useState(false)
  const [showTeamMembers, setShowTeamMembers] = useState(false)
  const [showTeamActivity, setShowTeamActivity] = useState(false)
  const [deleteId, setDeleteId]     = useState(null)
  const migrateAttemptedRef = useRef(false)

  const refresh = useCallback(async ({ allowMigrate = false } = {}) => {
    if (!useApi) {
      setTick(t => t + 1)
      return
    }
    setApiLoading(true)
    try {
      let data = await getDashboard()
      if (data.surveys.length === 0 && allowMigrate && !migrateAttemptedRef.current) {
        migrateAttemptedRef.current = true
        const local = loadLibrary()
        if (local.length > 0) {
          await migrateLocalLibrary(local)
          data = await getDashboard()
        }
      }
      setApiSurveys(data.surveys.map(metaToLibraryEntry))
      const [clients, topics, surveyTypes] = await Promise.all([
        fetchClients(), fetchTopics(), fetchSurveyTypes(),
      ])
      setApiClients(clients)
      setApiTopics(topics)
      setApiSurveyTypes(surveyTypes)
    } catch (err) {
      console.error('Failed to load dashboard', err)
      if (err.status === 403) {
        toast({ message: AUTH_ERRORS.forbidden, type: 'error' })
      }
    } finally {
      setApiLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (panelOnly) return
    if (useApi) refresh({ allowMigrate: true })
  }, [refresh, panelOnly])

  const surveys = useMemo(() => {
    const raw = useApi ? apiSurveys : loadLibrary()
    return useApi ? raw : filterSurveysForSession(raw, session)
  }, [useApi, apiSurveys, tick, session])

  const notifications = useResponseNotifications(surveys)
  const newCountBySurvey = useMemo(() => {
    const map = {}
    for (const row of notifications.payload?.bySurvey || []) {
      map[row.surveyId] = row.newCount
    }
    if (useApi) {
      for (const entry of surveys) {
        const id = entry.survey?.id || entry.id
        if (id && map[id] == null) map[id] = entry.stats?.newSinceExport ?? 0
      }
    }
    return map
  }, [notifications.payload, surveys, useApi])
  const clients = useMemo(
    () => (useApi ? apiClients : loadClients()),
    [useApi, apiClients, tick]
  )
  const topics = useMemo(
    () => (useApi ? apiTopics : loadTopics()),
    [useApi, apiTopics, tick]
  )
  const surveyTypes = useMemo(
    () => (useApi ? apiSurveyTypes : loadSurveyTypes()),
    [useApi, apiSurveyTypes, tick]
  )

  const clientMap = useMemo(() =>
    Object.fromEntries(clients.map(c => [c.id, c.name])), [clients])
  const topicMap  = useMemo(() =>
    Object.fromEntries(topics.map(t => [t.id, t.name])),  [topics])
  const typeMap   = useMemo(() =>
    Object.fromEntries(surveyTypes.map(t => [t.id, t.name])), [surveyTypes])

  const displayClient = useCallback(
    (survey) => resolveClientName(survey?.clientId, clients, survey?.clientName)
      || clientMap[survey?.clientId]
      || '',
    [clients, clientMap]
  )
  const displayTopic = useCallback(
    (survey) => resolveTopicName(survey?.topicId, topics, survey?.topicName)
      || topicMap[survey?.topicId]
      || '',
    [topics, topicMap]
  )
  const displayType = useCallback(
    (survey) => resolveSurveyTypeName(survey?.surveyType, surveyTypes, survey?.surveyTypeName)
      || typeMap[survey?.surveyType]
      || '',
    [surveyTypes, typeMap]
  )
  const ownerOptions = useMemo(() => {
    if (!isAdmin) return []
    const map = new Map()
    for (const entry of surveys) {
      if (entry.ownerId) map.set(entry.ownerId, entry.ownerName || 'Unknown')
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [surveys, isAdmin])

  // Response counts per survey
  const responseCounts = useMemo(() => {
    if (useApi) {
      return Object.fromEntries(
        surveys.map(s => {
          const id = s.survey?.id || s.id
          return [id, s.stats || { total: 0, complete: 0, terminated: 0, partial: 0 }]
        })
      )
    }
    return countResponsesForSurveys(
      surveys.map(s => s.survey?.id || s.id)
    )
  }, [useApi, surveys, tick])

  // Filter + sort
  const displayed = useMemo(() => {
    let list = [...surveys]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(s => (s.survey?.title || '').toLowerCase().includes(q))
    }
    if (filterStatus) list = list.filter(s => (s.survey?.status || 'draft') === filterStatus)
    if (filterClient) list = list.filter(s => s.survey?.clientId === filterClient)
    if (filterTopic)  list = list.filter(s => s.survey?.topicId  === filterTopic)
    if (filterType)   list = list.filter(s => s.survey?.surveyType === filterType)
    if (filterOwner)  list = list.filter(s => s.ownerId === filterOwner)

    list.sort((a, b) => {
      let av = '', bv = ''
      switch (sort.field) {
        case 'title':      av = a.survey?.title || ''; bv = b.survey?.title || ''; break
        case 'code':       av = a.survey?.surveyCode || ''; bv = b.survey?.surveyCode || ''; break
        case 'status':     av = a.survey?.status || ''; bv = b.survey?.status || ''; break
        case 'client':     av = displayClient(a.survey); bv = displayClient(b.survey); break
        case 'owner':      av = a.ownerName || ''; bv = b.ownerName || ''; break
        case 'responses':  av = responseCounts[a.survey?.id]?.total || 0; bv = responseCounts[b.survey?.id]?.total || 0; break
        case 'updatedAt':  av = a.survey?.updatedAt || ''; bv = b.survey?.updatedAt || ''; break
        default: av = a.survey?.updatedAt || ''; bv = b.survey?.updatedAt || ''
      }
      const cmp = typeof av === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv))
      return sort.dir === 'asc' ? cmp : -cmp
    })
    return list
  }, [surveys, search, filterStatus, filterClient, filterTopic, filterType, filterOwner, sort, responseCounts, clientMap, displayClient])

  const toggleSort = (field) =>
    setSort(s => s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' })

  const tableColumns = useMemo(() => {
    const cols = [
      { field: 'code',      label: 'Code',         w: 'w-28' },
      { field: 'title',     label: 'Survey',       w: 'flex-1' },
      { field: 'status',    label: 'Status',       w: 'w-24' },
      { field: 'client',    label: 'Client',       w: 'w-24' },
      { field: null,        label: 'Topic / Type', w: 'w-36' },
    ]
    if (isAdmin) cols.push({ field: 'owner', label: 'Created by', w: 'w-30' })
    cols.push(
      { field: 'responses', label: 'Responses',    w: 'w-28' },
      { field: 'updatedAt', label: 'Modified',     w: 'w-28' },
      { field: null,        label: '',              w: 'w-10' },
    )
    return cols
  }, [isAdmin])

  const activeFilters = [filterStatus, filterClient, filterTopic, filterType, filterOwner].filter(Boolean).length

  const handleOpenSurvey    = (entry) => onOpenSurvey(entry.id || entry.survey?.id)
  const handlePreviewSurvey = (entry) => onPreviewSurvey(entry.id || entry.survey?.id)
  const handleOpenExport    = (entry) => onOpenSurvey(entry.id || entry.survey?.id, { export: true })

  const handleDuplicate = async (id) => {
    if (!useApi) {
      duplicateSurvey(id)
      refresh()
      return
    }
    try {
      const full = await getSurvey(id)
      const cloneSurvey = buildClonedSurvey(full.survey)
      const cloneItems = JSON.parse(JSON.stringify(full.items || []))
      await patchSurvey(cloneSurvey.id, { survey: cloneSurvey, items: cloneItems })
      refresh()
    } catch (err) {
      console.error('Failed to duplicate survey', err)
      if (err.status === 403) toast({ message: AUTH_ERRORS.forbidden, type: 'error' })
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    if (useApi) {
      try {
        await deleteSurveyApi(deleteId)
        deleteSurvey(deleteId) // keep localStorage in sync so migrate won't resurrect it
        setDeleteId(null)
        refresh()
      } catch (err) {
        console.error('Failed to delete survey', err)
        if (err.status === 403) toast({ message: AUTH_ERRORS.forbidden, type: 'error' })
      }
      return
    }
    deleteSurvey(deleteId)
    setDeleteId(null)
    refresh()
  }

  if (panelOnly) {
    return (
      <div className="h-screen bg-surface flex flex-col overflow-hidden">
        <DashboardHeader
          session={session}
          onNewSurvey={() => {}}
          onGoHome={() => {}}
          onLogout={onLogout}
          onOpenAccount={() => setShowAccount(true)}
          onOpenTeamMembers={() => setShowTeamMembers(true)}
          onOpenTeamActivity={() => setShowTeamActivity(true)}
        />
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md text-center">
            <h1 className="text-xl font-semibold text-ink-800">Panel access</h1>
            <p className="mt-2 text-sm text-ink-500">
              This account opens the panel. Survey editing is turned off.
              Use Panel in the header to continue.
            </p>
          </div>
        </main>
        {showAccount && session && (
          <Suspense fallback={null}>
            <AccountSettingsModal
              session={session}
              onSessionUpdate={onSessionUpdate}
              onClose={() => setShowAccount(false)}
            />
          </Suspense>
        )}
        {showTeamMembers && canManagePlatform(session) && (
          <Suspense fallback={null}>
            <TeamMembersModal session={session} onClose={() => setShowTeamMembers(false)} />
          </Suspense>
        )}
        {showTeamActivity && canManagePlatform(session) && (
          <Suspense fallback={null}>
            <TeamPanel onClose={() => setShowTeamActivity(false)} />
          </Suspense>
        )}
      </div>
    )
  }

  return (
    <div className="h-screen bg-surface flex flex-col overflow-hidden">
      <Suspense fallback={
        <header className="bg-white/95 backdrop-blur-md border-b border-ink-200/80 min-h-[4.25rem]" />
      }>
        <DashboardHeader
          session={session}
          onNewSurvey={onNewSurvey}
          onGoHome={() => {
            setShowAccount(false)
            setShowSettings(false)
            setShowTeamMembers(false)
            setShowTeamActivity(false)
          }}
          onLogout={onLogout}
          onOpenAccount={() => setShowAccount(true)}
          onOpenTeamMembers={() => setShowTeamMembers(true)}
          onOpenTeamActivity={() => setShowTeamActivity(true)}
            notifications={{
              payload: notifications.payload,
              loading: notifications.loading,
              error: notifications.error,
              onRetry: notifications.refresh,
              onOpen: notifications.refresh,
              onSelect: (surveyId) => onOpenSurvey(surveyId, { export: true }),
            }}
          />
      </Suspense>

      <AppContentShell className="flex-1 min-h-0 overflow-y-auto py-4 sm:py-6">
        <AppWorkspaceColumns showRail={false}>
        <EmailVerificationBanner session={session} />
        <StatsBar surveys={surveys} />

        {canManagePlatform(session) && (
          <div className="card mb-4 overflow-hidden flex flex-col">
            <button
              type="button"
              onClick={() => {
                setShowSettings(open => {
                  if (open) refresh()
                  return !open
                })
              }}
              aria-expanded={showSettings}
              className={`w-full p-3 sm:p-4 flex items-center gap-2.5 text-sm font-medium transition-colors min-h-[44px] ${
                showSettings
                  ? 'text-ink-900 bg-ink-50/80 border-b border-ink-100'
                  : 'text-ink-600 hover:text-ink-900 hover:bg-ink-50/80'
              }`}
            >
              <Settings size={16} className="text-ink-400 shrink-0" />
              <span className="flex-1 text-left">Platform settings</span>
              <ChevronDown
                size={16}
                className={`text-ink-400 shrink-0 transition-transform ${showSettings ? 'rotate-180' : ''}`}
              />
            </button>
            {showSettings && (
              <Suspense fallback={
                <div className="p-8 flex items-center justify-center text-sm text-ink-400">
                  Loading settings…
                </div>
              }>
                <PlatformSettings
                  embedded
                  hideHeader
                  session={session}
                  onClose={() => { setShowSettings(false); refresh() }}
                />
              </Suspense>
            )}
          </div>
        )}

        {/* Filters bar */}
        <div className="card p-3 sm:p-4 mb-4 space-y-3">
          <div className="flex items-center gap-2 bg-ink-50 rounded-lg px-3 py-2.5 min-h-[44px]">
            <Search size={16} className="text-ink-400 shrink-0" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search surveys…"
              className="bg-transparent border-none outline-none text-sm flex-1 min-w-0 text-ink-700 placeholder:text-ink-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:flex-wrap gap-2">
            {[
              { label: 'Status', value: filterStatus, setter: setFilterStatus,
                options: SURVEY_STATUSES.map(s => ({ value: s.id, label: s.label })) },
              { label: 'Client', value: filterClient, setter: setFilterClient,
                options: clients.map(c => ({ value: c.id, label: c.name })) },
              { label: 'Topic', value: filterTopic, setter: setFilterTopic,
                options: topics.map(t => ({ value: t.id, label: t.name })) },
              { label: 'Audience', value: filterType, setter: setFilterType,
                options: surveyTypes.map(t => ({ value: t.id, label: t.name })) },
              ...(isAdmin ? [{
                label: 'Owner', value: filterOwner, setter: setFilterOwner,
                options: ownerOptions.map(([id, name]) => ({ value: id, label: name })),
              }] : []),
            ].map(f => (
              <label key={f.label} className="block min-w-0 md:w-auto">
                <span className="sr-only">Filter by {f.label}</span>
                <select
                  value={f.value}
                  onChange={e => f.setter(e.target.value)}
                  className={`w-full md:w-auto text-sm border rounded-lg px-3 py-2.5 min-h-[44px] bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 ${
                    f.value ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-700'
                  }`}
                >
                  <option value="">All {f.label}</option>
                  {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            {activeFilters > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setFilterStatus('')
                  setFilterClient('')
                  setFilterTopic('')
                  setFilterType('')
                  setFilterOwner('')
                }}
                className="text-sm text-rose-600 hover:text-rose-700 px-2 py-1.5 hover:bg-rose-50 rounded-lg transition-all min-h-[44px] sm:min-h-0"
              >
                Clear {activeFilters} filter{activeFilters !== 1 ? 's' : ''}
              </button>
            ) : (
              <span />
            )}
            <span className="text-xs text-ink-400 shrink-0">
              {displayed.length} of {surveys.length}
            </span>
          </div>
        </div>

        {/* Empty state */}
        {apiLoading && (
          <div className="flex items-center justify-center py-24 text-sm text-ink-400">
            Loading surveys…
          </div>
        )}

        {!apiLoading && surveys.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mb-4">
              <Layers size={28} className="text-brand-400" />
            </div>
            <h3 className="text-base font-semibold text-ink-700 mb-1">No surveys yet</h3>
            <p className="text-sm text-ink-400 mb-6">Create your first survey to get started.</p>
            <button
              onClick={onNewSurvey}
              onMouseEnter={prefetchBuilder}
              onFocus={prefetchBuilder}
              className="btn-primary"
            >
              <Plus size={15} /> Create first survey
            </button>
          </div>
        )}

        {/* Survey list — cards on mobile, table on md+ */}
        {!apiLoading && surveys.length > 0 && (
          <>
            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {displayed.length === 0 && (
                <div className="card p-8 text-center text-sm text-ink-400">
                  No surveys match the current filters.
                </div>
              )}
              {displayed.map(entry => {
                const sv     = entry.survey || {}
                const qCount = entry.questionCount ??
                  (entry.items || []).filter(i => i.itemType === 'question').length
                const rc     = responseCounts[sv.id] || { total: 0, complete: 0 }
                const newCount = newCountBySurvey[sv.id] || 0
                return (
                  <div
                    key={sv.id}
                    className="card p-4 active:bg-ink-50 transition-colors"
                    onMouseEnter={prefetchBuilder}
                    onFocus={prefetchBuilder}
                    onClick={() => handleOpenSurvey(entry)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-mono font-semibold text-ink-500 bg-ink-100 px-1.5 py-0.5 rounded">
                            {sv.surveyCode || '—'}
                          </span>
                          <StatusBadge statusId={sv.status || 'draft'} />
                        </div>
                        <p className="font-semibold text-ink-800 break-words">
                          {sv.title || DEFAULT_SURVEY_TITLE}
                        </p>
                        {sv.internalName && (
                          <p className="text-xs text-ink-400 truncate mt-0.5">{sv.internalName}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-ink-500">
                          <span>{qCount} question{qCount !== 1 ? 's' : ''}</span>
                          {displayClient(sv) && <span>{displayClient(sv)}</span>}
                          {displayTopic(sv) && <span>{displayTopic(sv)}</span>}
                          {displayType(sv) && (
                            <span className="font-medium text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">
                              {displayType(sv)}
                            </span>
                          )}
                          {isAdmin && entry.ownerName && (
                            <span className="text-ink-400">by {entry.ownerName}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-ink-100">
                          <div className="flex items-center gap-3 text-xs text-ink-500">
                            <ResponsesCount
                              total={rc.total}
                              complete={rc.complete}
                              newCount={newCount}
                              compact
                              onOpenNew={() => handleOpenExport(entry)}
                            />
                            <span className="flex items-center gap-1">
                              <Clock size={11} className="text-ink-300" />
                              {fmtDate(sv.updatedAt)}
                            </span>
                          </div>
                          <div onClick={e => e.stopPropagation()}>
                            <SurveyMenu
                              onOpen={() => handleOpenSurvey(entry)}
                              onPreview={() => handlePreviewSurvey(entry)}
                              onDuplicate={() => handleDuplicate(sv.id)}
                              onDelete={() => setDeleteId(sv.id)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden md:block card overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60">
                  {tableColumns.map((col, i) => (
                    <th
                      key={i}
                      onClick={col.field ? () => toggleSort(col.field) : undefined}
                      className={`px-4 py-2.5 text-left text-xs font-semibold text-ink-500 uppercase tracking-wider ${col.w} ${col.field ? 'cursor-pointer hover:text-ink-700 select-none' : ''}`}
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        {col.field && <SortIcon field={col.field} sort={sort} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 && (
                  <tr>
                    <td colSpan={tableColumns.length} className="text-center py-8 text-sm text-ink-400">
                      No surveys match the current filters.
                    </td>
                  </tr>
                )}
                {displayed.map(entry => {
                  const sv     = entry.survey || {}
                  const qCount = entry.questionCount ??
                    (entry.items || []).filter(i => i.itemType === 'question').length
                  const rc     = responseCounts[sv.id] || { total: 0, complete: 0 }
                  const newCount = newCountBySurvey[sv.id] || 0
                  return (
                    <tr
                      key={sv.id}
                      className="border-b border-ink-50 hover:bg-ink-50/50 transition-colors cursor-pointer group"
                      onMouseEnter={prefetchBuilder}
                      onFocus={prefetchBuilder}
                      onClick={() => handleOpenSurvey(entry)}
                    >
                      {/* Code */}
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono font-semibold text-ink-500 bg-ink-100 px-1.5 py-0.5 rounded">
                          {sv.surveyCode || '—'}
                        </span>
                      </td>

                      {/* Title + internal name */}
                      <td className="px-4 py-3">
                        <p className="font-semibold text-ink-800 truncate max-w-xs">
                          {sv.title || DEFAULT_SURVEY_TITLE}
                        </p>
                        {sv.internalName && (
                          <p className="text-xs text-ink-400 truncate max-w-xs mt-0.5">
                            {sv.internalName}
                          </p>
                        )}
                        <p className="text-xs text-ink-300 mt-0.5">{qCount} question{qCount !== 1 ? 's' : ''}</p>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <StatusBadge statusId={sv.status || 'draft'} />
                      </td>

                      {/* Client */}
                      <td className="px-4 py-3 text-xs text-ink-600">
                        {displayClient(sv) || <span className="text-ink-300">—</span>}
                      </td>

                      {/* Topic + Type */}
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          {displayTopic(sv) && (
                            <p className="text-xs text-ink-600">{displayTopic(sv)}</p>
                          )}
                          {displayType(sv) && (
                            <span className="text-xs font-medium text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">
                              {displayType(sv)}
                            </span>
                          )}
                          {!displayTopic(sv) && !displayType(sv) && (
                            <span className="text-ink-300 text-xs">—</span>
                          )}
                        </div>
                      </td>

                      {isAdmin && (
                        <td className="px-4 py-3 text-xs text-ink-600">
                          {entry.ownerName || <span className="text-ink-300">—</span>}
                        </td>
                      )}

                      {/* Responses */}
                      <td className="px-4 py-3">
                        <ResponsesCount
                          total={rc.total}
                          complete={rc.complete}
                          newCount={newCount}
                          onOpenNew={() => handleOpenExport(entry)}
                        />
                      </td>

                      {/* Modified */}
                      <td className="px-4 py-3 text-xs text-ink-500">
                        <div className="flex items-center gap-1">
                          <Clock size={11} className="text-ink-300" />
                          {fmtDate(sv.updatedAt)}
                        </div>
                      </td>

                      {/* Menu */}
                      <td className="px-2 py-3" onClick={e => e.stopPropagation()}>
                        <SurveyMenu
                          onOpen={() => handleOpenSurvey(entry)}
                          onPreview={() => handlePreviewSurvey(entry)}
                          onDuplicate={() => handleDuplicate(sv.id)}
                          onDelete={() => setDeleteId(sv.id)}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </>
        )}
        </AppWorkspaceColumns>
      </AppContentShell>

      {/* Delete confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center">
            <div className="w-14 h-14 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-rose-500" />
            </div>
            <h3 className="text-base font-bold text-ink-800 mb-2">Delete this survey?</h3>
            <p className="text-sm text-ink-500 mb-6">
              This removes the survey and all its stored responses permanently. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 btn-ghost border border-ink-200">
                Cancel
              </button>
              <button onClick={handleDelete} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account settings — all signed-in users */}
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

      {showTeamMembers && canManagePlatform(session) && (
        <Suspense fallback={
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
            <InlineLoader label="Loading team members…" />
          </div>
        }>
          <TeamMembersModal
            session={session}
            onClose={() => setShowTeamMembers(false)}
          />
        </Suspense>
      )}

      {showTeamActivity && canManagePlatform(session) && (
        <Suspense fallback={
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
            <InlineLoader label="Loading team activity…" />
          </div>
        }>
          <TeamPanel onClose={() => setShowTeamActivity(false)} />
        </Suspense>
      )}
    </div>
  )
}

export default Dashboard
