import { useState, useEffect, lazy, Suspense, useCallback } from 'react'
import { Tag, AlertCircle, CheckCircle2, Plus } from 'lucide-react'
import {
  SURVEY_STATUSES,
  loadClients, loadTopics, loadSurveyTypes,
} from '@/utils/data/platformStore'
import { fetchClients, fetchTopics, fetchSurveyTypes } from '@/api/platform/platform'
import { useApi } from '@/config/api'
import { getSession, updateSession } from '@/utils/data/authStore'
import { canManagePlatform } from '@/utils/platform/permissions'
import { isSurveyCodeTaken } from '@/utils/data/surveyLibrary'
import { ShareableSurveyUrl } from './managers/ShareableSurveyUrl'
import { DEFAULT_DATE_FORMAT } from '@/constants/surveyDefaults'
import { SURVEY_DATE_FORMAT_OPTIONS } from '@/utils/format/dateSurveyFormat'

const PlatformSettings = lazy(() => import('@/components/dashboard/PlatformSettings.jsx'))

const CODE_RE = /^[A-Z0-9_-]{1,20}$/i

function LabelSelect({ label, value, options, onChange }) {
  return (
    <div>
      <label className="text-xs text-ink-500 mb-1 block">{label}</label>
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="input-base text-sm"
      >
        <option value="">— None —</option>
        {options.map(o => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </div>
  )
}

export function SurveyMetadata({ survey, dispatch }) {
  const [clients, setClients] = useState(loadClients)
  const [topics,  setTopics]  = useState(loadTopics)
  const [surveyTypes, setSurveyTypes] = useState(loadSurveyTypes)
  const [codeError, setCodeError] = useState('')
  const [showLabels, setShowLabels] = useState(false)
  const canManage = canManagePlatform(getSession())

  const refreshLists = useCallback(() => {
    if (!useApi) {
      setClients(loadClients())
      setTopics(loadTopics())
      setSurveyTypes(loadSurveyTypes())
      return
    }
    Promise.all([fetchClients(), fetchTopics(), fetchSurveyTypes()])
      .then(([c, t, st]) => {
        setClients(c)
        setTopics(t)
        setSurveyTypes(st)
      })
      .catch(err => console.error('Failed to load platform lists', err))
  }, [])

  useEffect(() => { refreshLists() }, [refreshLists])

  const set = (field, value) =>
    dispatch({ type: 'SET_SURVEY_FIELD', field, value })

  const validateCode = (code) => {
    if (!code) { setCodeError(''); return }
    if (!CODE_RE.test(code)) { setCodeError('Letters, numbers, - and _ only. Max 20 chars.'); return }
    if (isSurveyCodeTaken(code, survey.id)) { setCodeError('This code is already used by another survey.'); return }
    setCodeError('')
  }

  const hasLabels = clients.length + topics.length + surveyTypes.length > 0
  const showClassification = hasLabels || survey.clientId || survey.topicId || survey.surveyType

  return (
    <div className="mt-3 border-t border-ink-100 pt-3">
      <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
        <Tag size={12} /> Internal Labels
        <span className="ml-1 text-ink-300 font-normal normal-case tracking-normal">— visible to admins only</span>
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Internal name */}
        <div className="col-span-2">
          <label className="text-xs text-ink-500 mb-1 block">Internal name</label>
          <input
            type="text"
            value={survey.internalName || ''}
            onChange={e => set('internalName', e.target.value)}
            placeholder="e.g. Brand tracking UK Q1 2026 — for your team and client reference"
            className="input-base text-sm"
          />
        </div>

        {/* Survey code */}
        <div>
          <label className="text-xs text-ink-500 mb-1 block">Survey code</label>
          <div className="relative">
            <input
              type="text"
              value={survey.surveyCode || ''}
              onChange={e => { set('surveyCode', e.target.value.toUpperCase()); validateCode(e.target.value) }}
              placeholder="e.g. DMR2026172"
              className={`input-base text-sm font-mono pr-7 ${codeError ? 'border-rose-400 focus:ring-rose-400' : ''}`}
            />
            {survey.surveyCode && !codeError && (
              <CheckCircle2 size={14} className="absolute right-2 top-2.5 text-emerald-500 pointer-events-none" />
            )}
            {codeError && (
              <AlertCircle size={14} className="absolute right-2 top-2.5 text-rose-500 pointer-events-none" />
            )}
          </div>
          {codeError && <p className="text-xs text-rose-500 mt-1">{codeError}</p>}
        </div>

        {/* Status */}
        <div>
          <label className="text-xs text-ink-500 mb-1 block">Status</label>
          <select
            value={survey.status || 'draft'}
            onChange={e => set('status', e.target.value)}
            className="input-base text-sm w-full"
          >
            {SURVEY_STATUSES.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-ink-500 mb-1 block">Default date format</label>
          <select
            value={survey.defaultDateFormat || DEFAULT_DATE_FORMAT}
            onChange={e => set('defaultDateFormat', e.target.value)}
            className="input-base text-sm w-full font-mono"
          >
            {SURVEY_DATE_FORMAT_OPTIONS.map(fmt => (
              <option key={fmt.value} value={fmt.value}>{fmt.label}</option>
            ))}
          </select>
        </div>

        <div className="col-span-2 pt-1 border-t border-ink-50">
          <div className="flex items-center justify-between gap-3 mb-2 mt-1">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider">Classification</p>
              <p className="text-xs text-ink-400 mt-0.5">Optional tags for filtering on the dashboard.</p>
            </div>
            {canManage && (
              <button
                type="button"
                onClick={() => setShowLabels(true)}
                className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 px-2.5 py-1.5 rounded-lg border border-brand-200 hover:bg-brand-50 transition-all"
              >
                <Plus size={13} />
                {hasLabels ? 'Manage labels' : 'Add labels'}
              </button>
            )}
          </div>

          {showClassification ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <LabelSelect
                label="Client"
                value={survey.clientId}
                options={clients}
                onChange={v => set('clientId', v)}
              />
              <LabelSelect
                label="Topic"
                value={survey.topicId}
                options={topics}
                onChange={v => set('topicId', v)}
              />
              <LabelSelect
                label="Audience type"
                value={survey.surveyType}
                options={surveyTypes}
                onChange={v => set('surveyType', v)}
              />
            </div>
          ) : !canManage && (
            <p className="text-xs text-ink-400 italic">Ask an admin to set up labels.</p>
          )}
        </div>
      </div>

      <ShareableSurveyUrl survey={survey} clients={clients} />

      {showLabels && (
        <Suspense fallback={null}>
          <PlatformSettings
            session={getSession()}
            onClose={() => { setShowLabels(false); refreshLists() }}
          />
        </Suspense>
      )}
    </div>
  )
}
