import { useState, useEffect, useCallback, useMemo, useRef, memo, lazy, Suspense } from 'react'
import { X, Plus, Trash2, Edit3, Check, Settings } from 'lucide-react'
import {
  loadClients, loadTopics, loadSurveyTypes,
  addClient, updateClient, deleteClient,
  addTopic, updateTopic, deleteTopic,
  addSurveyType, updateSurveyType, deleteSurveyType,
} from '@/utils/data/platformStore'
import { useApi } from '@/config/api'
import {
  fetchClients, createClient, updateClientApi, deleteClientApi,
  fetchTopics, createTopic, updateTopicApi, deleteTopicApi,
  fetchSurveyTypes, createSurveyType, updateSurveyTypeApi, deleteSurveyTypeApi,
} from '@/api/platform/platform'
import { fetchBillingOverview } from '@/api/platform/billing'
import { canViewBilling } from '@/utils/platform/permissions'

const BrandKitPanel = lazy(() =>
  import('./BrandKitPanel.jsx').then(m => ({ default: m.BrandKitPanel })),
)
const DomainVerificationPanel = lazy(() =>
  import('./DomainVerificationPanel.jsx').then(m => ({ default: m.DomainVerificationPanel })),
)
const BillingPanel = lazy(() =>
  import('./BillingPanel.jsx').then(m => ({ default: m.BillingPanel })),
)
const IntegrationKeysPanel = lazy(() =>
  import('./IntegrationKeysPanel.jsx').then(m => ({ default: m.IntegrationKeysPanel })),
)

const BASE_SETTINGS_TABS = [
  ['lists', 'Classification labels'],
  ['brandKit', 'Branding'],
  ['domain', 'Domain'],
]

const TAB_FALLBACK = (
  <p className="text-sm text-ink-400 text-center py-8">Loading…</p>
)

function emptyIfApi(localLoader) {
  return useApi ? [] : localLoader()
}

// ─── Editable list (clients / topics / types) ───────────────────────────────
const EditableList = memo(function EditableList({ label, description, items, onAdd, onUpdate, onDelete, placeholder }) {
  const [newText,   setNewText]   = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editText,  setEditText]  = useState('')

  const handleAdd = () => {
    if (!newText.trim()) return
    onAdd(newText.trim())
    setNewText('')
  }
  const startEdit = (item) => { setEditingId(item.id); setEditText(item.name) }
  const commitEdit = () => { if (editText.trim()) onUpdate(editingId, editText.trim()); setEditingId(null) }

  return (
    <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-4">
      <p className="text-sm font-semibold text-ink-800">{label}</p>
      {description && (
        <p className="text-xs text-ink-400 mt-1 mb-3 leading-relaxed">{description}</p>
      )}
      {!description && <div className="mb-3" />}
      <div className="space-y-1.5 mb-3">
        {items.map(item => (
          <div key={item.id} className="flex items-center gap-2 group">
            {editingId === item.id ? (
              <>
                <input autoFocus type="text" value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null) }}
                  className="input-base py-1.5 text-sm flex-1" />
                <button onClick={commitEdit} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"><Check size={14} /></button>
                <button onClick={() => setEditingId(null)} className="p-1.5 text-ink-400 hover:bg-ink-100 rounded-lg"><X size={14} /></button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-ink-700 px-2 py-1.5 rounded-lg group-hover:bg-ink-50">{item.name}</span>
                <button onClick={() => startEdit(item)} className="p-1.5 text-ink-300 hover:text-ink-600 hover:bg-ink-100 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><Edit3 size={13} /></button>
                <button onClick={() => onDelete(item.id)} className="p-1.5 text-ink-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={13} /></button>
              </>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-xs text-ink-400 italic py-2 px-2">
            None yet — add your first below. Labels are optional and used for filtering surveys.
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <input type="text" value={newText} onChange={e => setNewText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder={placeholder} className="input-base py-1.5 text-sm flex-1" />
        <button onClick={handleAdd} disabled={!newText.trim()}
          className="flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 px-3 py-1.5 hover:bg-brand-50 border border-brand-200 rounded-lg transition-all disabled:opacity-30">
          <Plus size={14} /> Add
        </button>
      </div>
    </div>
  )
})

// ─── Main PlatformSettings ─────────────────────────────────────────────────
export function PlatformSettings({ onClose, session, embedded = false, hideHeader = false }) {
  const [clients, setClients] = useState(() => emptyIfApi(loadClients))
  const [topics,  setTopics]  = useState(() => emptyIfApi(loadTopics))
  const [surveyTypes, setSurveyTypes] = useState(() => emptyIfApi(loadSurveyTypes))
  const [billingOverview, setBillingOverview] = useState(null)
  const [tab,     setTab]     = useState('lists')
  const [loadingLists, setLoadingLists] = useState(useApi)

  const listsLoaded = useRef(!useApi)

  const settingsTabs = useMemo(() => {
    let tabs = [...BASE_SETTINGS_TABS]
    if (billingOverview?.planFeatures?.surveyImport) {
      tabs = [...tabs, ['integrations', 'Integration keys']]
    }
    if (canViewBilling(session)) {
      tabs = [...tabs, ['billing', 'Billing']]
    }
    return tabs
  }, [session, billingOverview?.planFeatures?.surveyImport])

  const loadLists = useCallback(async () => {
    if (!useApi || listsLoaded.current) return
    setLoadingLists(true)
    try {
      const [c, t, st] = await Promise.all([
        fetchClients(), fetchTopics(), fetchSurveyTypes(),
      ])
      setClients(c)
      setTopics(t)
      setSurveyTypes(st)
      listsLoaded.current = true
    } catch (err) {
      console.error('Failed to load classification labels', err)
    } finally {
      setLoadingLists(false)
    }
  }, [])

  const ensureBillingOverview = useCallback(async () => {
    if (!useApi || billingOverview) return billingOverview
    try {
      const billing = await fetchBillingOverview()
      setBillingOverview(billing)
      return billing
    } catch (err) {
      console.error('Failed to load billing overview', err)
      return null
    }
  }, [billingOverview])

  const handleBillingOverviewChange = useCallback((next) => {
    setBillingOverview(next)
  }, [])

  useEffect(() => {
    if (useApi) loadLists()
  }, [loadLists])

  useEffect(() => {
    if (!useApi || (tab !== 'billing' && tab !== 'integrations')) return
    ensureBillingOverview()
  }, [tab, ensureBillingOverview])

  const handleAddClient = useCallback(async (name) => {
    if (useApi) {
      const client = await createClient(name)
      setClients(prev => [...prev, client])
      return
    }
    setClients(addClient(name))
  }, [])

  const handleUpdateClient = useCallback(async (id, name) => {
    if (useApi) {
      const client = await updateClientApi(id, name)
      setClients(prev => prev.map(c => c.id === id ? client : c))
      return
    }
    setClients(updateClient(id, name))
  }, [])

  const handleDeleteClient = useCallback(async (id) => {
    if (useApi) {
      await deleteClientApi(id)
      setClients(prev => prev.filter(c => c.id !== id))
      return
    }
    setClients(deleteClient(id))
  }, [])

  const handleAddTopic = useCallback(async (name) => {
    if (useApi) {
      const topic = await createTopic(name)
      setTopics(prev => [...prev, topic])
      return
    }
    setTopics(addTopic(name))
  }, [])

  const handleUpdateTopic = useCallback(async (id, name) => {
    if (useApi) {
      const topic = await updateTopicApi(id, name)
      setTopics(prev => prev.map(t => t.id === id ? topic : t))
      return
    }
    setTopics(updateTopic(id, name))
  }, [])

  const handleDeleteTopic = useCallback(async (id) => {
    if (useApi) {
      await deleteTopicApi(id)
      setTopics(prev => prev.filter(t => t.id !== id))
      return
    }
    setTopics(deleteTopic(id))
  }, [])

  const handleAddSurveyType = useCallback(async (name) => {
    if (useApi) {
      const surveyType = await createSurveyType(name)
      setSurveyTypes(prev => [...prev, surveyType])
      return
    }
    setSurveyTypes(addSurveyType(name))
  }, [])

  const handleUpdateSurveyType = useCallback(async (id, name) => {
    if (useApi) {
      const surveyType = await updateSurveyTypeApi(id, name)
      setSurveyTypes(prev => prev.map(t => t.id === id ? surveyType : t))
      return
    }
    setSurveyTypes(updateSurveyType(id, name))
  }, [])

  const handleDeleteSurveyType = useCallback(async (id) => {
    if (useApi) {
      await deleteSurveyTypeApi(id)
      setSurveyTypes(prev => prev.filter(t => t.id !== id))
      return
    }
    setSurveyTypes(deleteSurveyType(id))
  }, [])

  const panel = (
    <div className={`bg-white w-full overflow-hidden flex flex-col ${embedded ? '' : `rounded-2xl shadow-2xl max-h-[90vh] ${tab === 'brandKit' ? 'max-w-5xl' : 'max-w-4xl'}`}`}>
      {!hideHeader && (
        <div className="flex items-start sm:items-center gap-3 px-4 sm:px-5 py-3 sm:py-4 border-b border-ink-100 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-ink-800 flex items-center justify-center shrink-0">
            <Settings size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-ink-800">Platform Settings</h2>
            <p className="text-xs text-ink-400 hidden sm:block">Classification labels, branding, domain, and billing</p>
          </div>
          <button onClick={onClose} className="p-2.5 text-ink-400 hover:text-ink-700 hover:bg-ink-100 rounded-lg transition-all min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0">
            <X size={18} />
          </button>
        </div>
      )}

      <div className="flex border-b border-ink-100 px-4 sm:px-5 shrink-0 overflow-x-auto">
        {settingsTabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`text-sm font-medium px-1 py-3 mr-5 sm:mr-6 border-b-2 transition-colors whitespace-nowrap min-h-[44px] ${
              tab === id ? 'border-brand-500 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        {loadingLists && tab === 'lists' ? (
          <p className="text-sm text-ink-400 text-center py-8">Loading settings…</p>
        ) : tab === 'lists' ? (
          <div className="space-y-5">
            <p className="text-sm text-ink-500 leading-relaxed">
              Add the labels your team uses to organise surveys. They appear when tagging surveys
              and as filters on the dashboard — only what you define here, nothing preset.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <EditableList
                label="Clients"
                description="Who the survey is for — e.g. Acme Corp, Internal."
                items={clients}
                onAdd={handleAddClient}
                onUpdate={handleUpdateClient}
                onDelete={handleDeleteClient}
                placeholder="Add client…"
              />
              <EditableList
                label="Topics"
                description="Subject area — e.g. Brand tracking, UX research."
                items={topics}
                onAdd={handleAddTopic}
                onUpdate={handleUpdateTopic}
                onDelete={handleDeleteTopic}
                placeholder="Add topic…"
              />
              <EditableList
                label="Audience types"
                description="Respondent profile — e.g. Consumer, B2B, HCP."
                items={surveyTypes}
                onAdd={handleAddSurveyType}
                onUpdate={handleUpdateSurveyType}
                onDelete={handleDeleteSurveyType}
                placeholder="Add audience type…"
              />
            </div>
          </div>
        ) : tab === 'brandKit' ? (
          <Suspense fallback={TAB_FALLBACK}>
            <BrandKitPanel embedded />
          </Suspense>
        ) : tab === 'integrations' ? (
          <Suspense fallback={TAB_FALLBACK}>
            <IntegrationKeysPanel />
          </Suspense>
        ) : tab === 'billing' ? (
          <Suspense fallback={TAB_FALLBACK}>
            <BillingPanel
              embedded
              initialOverview={billingOverview}
              onOverviewChange={handleBillingOverviewChange}
            />
          </Suspense>
        ) : (
          <Suspense fallback={TAB_FALLBACK}>
            <DomainVerificationPanel embedded />
          </Suspense>
        )}
      </div>

      <div className="px-5 pb-5 flex justify-end shrink-0 border-t border-ink-100 pt-4">
        <button onClick={onClose} className="btn-primary px-6">Done</button>
      </div>
    </div>
  )

  if (embedded && hideHeader) return panel

  return embedded ? (
    <div className="card mb-4 overflow-hidden flex flex-col">
      {panel}
    </div>
  ) : (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {panel}
    </div>
  )
}

export default PlatformSettings
