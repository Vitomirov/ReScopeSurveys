import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  X, Download, Filter, Clock, CheckCircle2, XCircle, Loader2,
  Trash2, AlertTriangle, RefreshCw, ChevronDown, ChevronUp,
  Calendar, BarChart3,
} from 'lucide-react'
import {
  loadResponses, loadExportHistory, recordExport,
  lastExportTimestamp, applyFilters, deleteResponse, clearResponses,
  newResponseId,
} from '@/utils/data/responseStore'
import { useApi } from '@/config/api'
import {
  fetchAllResponses, fetchResponseStats, fetchResponsesPage,
  deleteResponseApi, clearResponsesApi,
} from '@/api/survey/responses'
import { fetchLastExport, recordExportApi } from '@/api/survey/exports'
import { generateCSV, generateCSVFromApiPages, downloadCSV } from '@/utils/csvExport'
import { formatAnswer } from '@/utils/csv/formatAnswer'

const STATUS_META = {
  complete:   { label: 'Complete',    color: 'text-emerald-700 bg-emerald-100 border-emerald-200' },
  terminated: { label: 'Terminated',  color: 'text-rose-700 bg-rose-100 border-rose-200' },
  partial:    { label: 'Partial',     color: 'text-amber-700 bg-amber-100 border-amber-200' },
  dnc:        { label: 'DNC',         color: 'text-slate-700 bg-slate-100 border-slate-300' },
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, color: 'text-ink-600 bg-ink-100 border-ink-200' }
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${m.color}`}>
      {m.label}
    </span>
  )
}

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function fmtDateShort(iso) {
  if (!iso) return ''
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`)
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

function daysAgoISO(days) {
  const from = new Date()
  from.setDate(from.getDate() - days)
  return from.toISOString().split('T')[0]
}

function getDatePreset(filters) {
  if (filters.sinceLastExport) return 'since-export'
  if (!filters.dateFrom && !filters.dateTo) return 'all'
  if (filters.dateFrom === todayISO() && !filters.dateTo) return 'today'
  if (filters.dateFrom === daysAgoISO(7) && !filters.dateTo) return '7d'
  if (filters.dateFrom === daysAgoISO(30) && !filters.dateTo) return '30d'
  return 'custom'
}

function hasActiveFilters(filters) {
  return filters.statuses.length > 0
    || filters.dateFrom
    || filters.dateTo
    || filters.sinceLastExport
}

const DATE_PRESETS = [
  { id: 'all', label: 'All time' },
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'since-export', label: 'Since last export' },
  { id: 'custom', label: 'Custom range' },
]

function applyDatePreset(presetId, lastExport) {
  switch (presetId) {
    case 'all':
      return { dateFrom: '', dateTo: '', sinceLastExport: null }
    case 'today':
      return { dateFrom: todayISO(), dateTo: '', sinceLastExport: null }
    case '7d':
      return { dateFrom: daysAgoISO(7), dateTo: '', sinceLastExport: null }
    case '30d':
      return { dateFrom: daysAgoISO(30), dateTo: '', sinceLastExport: null }
    case 'since-export':
      return lastExport
        ? { dateFrom: '', dateTo: '', sinceLastExport: lastExport }
        : { dateFrom: '', dateTo: '', sinceLastExport: null }
    case 'custom':
      return { dateFrom: daysAgoISO(30), dateTo: todayISO(), sinceLastExport: null }
    default:
      return {}
  }
}

function describeDateFilter(filters) {
  if (filters.sinceLastExport) return `After last export (${fmtDate(filters.sinceLastExport)})`
  if (!filters.dateFrom && !filters.dateTo) return null
  if (filters.dateFrom && filters.dateTo) {
    return `${fmtDateShort(filters.dateFrom)} – ${fmtDateShort(filters.dateTo)}`
  }
  if (filters.dateFrom) return `From ${fmtDateShort(filters.dateFrom)}`
  return `Until ${fmtDateShort(filters.dateTo)}`
}

// ─── Filters panel ─────────────────────────────────────────────────────────
function ExportFiltersBar({ filters, setFilters, lastExport }) {
  const allStatuses = ['complete', 'terminated', 'partial', 'dnc']
  const datePreset = getDatePreset(filters)
  const dateSummary = describeDateFilter(filters)

  const toggleStatus = (s) =>
    setFilters(f => ({
      ...f,
      statuses: f.statuses.includes(s) ? f.statuses.filter(x => x !== s) : [...f.statuses, s],
    }))

  const selectDatePreset = (presetId) => {
    if (presetId === 'since-export' && !lastExport) return
    setFilters(f => ({ ...f, ...applyDatePreset(presetId, lastExport) }))
  }

  const clearAll = () =>
    setFilters({ statuses: [], dateFrom: '', dateTo: '', sinceLastExport: null })

  const clearDateFilter = () =>
    setFilters(f => ({ ...f, dateFrom: '', dateTo: '', sinceLastExport: null }))

  return (
    <div className="px-5 py-4 bg-ink-50/80 border-b border-ink-100 space-y-4 shrink-0">
      <div className="flex items-center gap-2">
        <Filter size={14} className="text-ink-500 shrink-0" />
        <p className="text-sm font-bold text-ink-700">Filters</p>
      </div>

      {/* Status */}
      <div>
        <p className="text-xs font-semibold text-ink-500 mb-2">Response status</p>
        <div className="flex gap-2 flex-wrap">
          {allStatuses.map(s => {
            const m = STATUS_META[s]
            const sel = filters.statuses.includes(s)
            return (
              <button
                key={s}
                type="button"
                onClick={() => toggleStatus(s)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border-2 transition-all ${
                  sel ? `${m.color} border-current` : 'border-ink-200 text-ink-500 hover:border-ink-300 bg-white'
                }`}
              >
                {m.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Date — always visible */}
      <div className="rounded-xl border border-ink-200 bg-white p-3.5 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Calendar size={15} className="text-brand-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-ink-800">Date range</p>
              <p className="text-xs text-ink-400">
                {dateSummary || 'All response dates included'}
              </p>
            </div>
          </div>
          {(filters.dateFrom || filters.dateTo || filters.sinceLastExport) && (
            <button
              type="button"
              onClick={clearDateFilter}
              className="text-xs font-medium text-ink-500 hover:text-ink-700 px-2 py-1 rounded-lg hover:bg-ink-50 transition-colors shrink-0"
            >
              Clear dates
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {DATE_PRESETS.map(({ id, label }) => {
            const selected = datePreset === id
            const disabled = id === 'since-export' && !lastExport
            return (
              <button
                key={id}
                type="button"
                onClick={() => selectDatePreset(id)}
                disabled={disabled}
                title={disabled ? 'No export recorded yet' : undefined}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                  selected
                    ? 'border-brand-500 bg-brand-50 text-brand-800 shadow-sm'
                    : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:bg-ink-50'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {label}
              </button>
            )
          })}
        </div>

        {filters.sinceLastExport ? (
          <div className="flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50/70 px-3 py-2.5">
            <RefreshCw size={14} className="text-brand-600 shrink-0 mt-0.5" />
            <p className="text-xs text-brand-800">
              Showing responses submitted after{' '}
              <span className="font-semibold">{fmtDate(lastExport)}</span>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <label className="block">
              <span className="text-xs font-semibold text-ink-600 mb-1.5 block">From</span>
              <input
                type="date"
                value={filters.dateFrom}
                max={filters.dateTo || undefined}
                onChange={e => setFilters(f => ({
                  ...f,
                  dateFrom: e.target.value,
                  sinceLastExport: null,
                }))}
                className="input-base py-2 text-sm w-full"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-ink-600 mb-1.5 block">To</span>
              <input
                type="date"
                value={filters.dateTo}
                min={filters.dateFrom || undefined}
                onChange={e => setFilters(f => ({
                  ...f,
                  dateTo: e.target.value,
                  sinceLastExport: null,
                }))}
                className="input-base py-2 text-sm w-full"
              />
            </label>
          </div>
        )}
      </div>

      {hasActiveFilters(filters) && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-ink-500">Active:</span>
          {filters.statuses.map(s => (
            <FilterChip
              key={s}
              label={STATUS_META[s]?.label || s}
              onRemove={() => toggleStatus(s)}
            />
          ))}
          {dateSummary && (
            <FilterChip label={dateSummary} onRemove={clearDateFilter} />
          )}
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-rose-600 hover:text-rose-700 font-medium ml-1"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}

function FilterChip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-700 bg-white border border-ink-200 rounded-full pl-2.5 pr-1 py-1">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="p-0.5 rounded-full hover:bg-ink-100 text-ink-400 hover:text-ink-700 transition-colors"
        aria-label={`Remove ${label} filter`}
      >
        <X size={12} />
      </button>
    </span>
  )
}

// ─── Response table ─────────────────────────────────────────────────────────
function ResponseTable({ responses, items, surveyId, onDeleted, onDeleteResponse }) {
  const [expanded, setExpanded] = useState(null)
  const questions = useMemo(
    () => (items || []).filter(item => item.itemType === 'question'),
    [items]
  )

  const del = async (id) => {
    if (!window.confirm('Delete this response? This cannot be undone.')) return
    await onDeleteResponse(id)
    onDeleted()
  }

  if (!responses.length) {
    return (
      <div className="text-center py-8 text-ink-400">
        <BarChart3 size={28} className="mx-auto mb-2 text-ink-200" />
        <p className="text-sm">No responses match the current filters.</p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {responses.map((r) => (
        <div key={r.id} className="border border-ink-200 rounded-xl overflow-hidden bg-white">
          {/* Row summary */}
          <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-ink-50 transition-colors">
            <button
              onClick={() => setExpanded(expanded === r.id ? null : r.id)}
              className="p-0.5 text-ink-400 hover:text-ink-600 transition-colors"
            >
              {expanded === r.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <span className="text-xs font-mono text-ink-400 shrink-0">{r.id.slice(0, 14)}</span>
            <StatusBadge status={r.status} />
            <span className="text-xs text-ink-500 flex-1">{fmtDate(r.timestamp)}</span>
            <span className="text-xs text-ink-400 shrink-0">
              Page {(r.pageReached ?? 0) + 1}
            </span>
            <button
              onClick={() => del(r.id)}
              className="p-1 text-ink-300 hover:text-rose-500 transition-colors shrink-0"
              title="Delete response"
            >
              <Trash2 size={12} />
            </button>
          </div>

          {/* Expanded detail */}
          {expanded === r.id && (
            <div className="border-t border-ink-100 px-3 py-2.5 bg-ink-50 space-y-2 max-h-64 overflow-y-auto">
              {questions.length === 0 ? (
                <p className="text-xs text-ink-400">No questions in this survey.</p>
              ) : questions.map((q, index) => {
                const answer = formatAnswer(q, r.responses || {}, r.companions)
                return (
                  <div key={q.id} className="bg-white rounded-lg border border-ink-100 px-2.5 py-2">
                    <p className="text-xs font-medium text-ink-700">
                      {index + 1}. {q.text || 'Untitled question'}
                    </p>
                    <p className="text-xs text-ink-600 mt-0.5 whitespace-pre-wrap break-words">
                      {answer || '—'}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Export history ─────────────────────────────────────────────────────────
function ExportHistory({ history }) {
  if (!history.length) return (
    <p className="text-xs text-ink-400 italic">No exports recorded yet.</p>
  )
  return (
    <div className="space-y-1.5">
      {history.map(h => (
        <div key={h.id} className="flex items-center gap-3 text-xs px-3 py-2 bg-ink-50 rounded-lg border border-ink-100">
          <Clock size={12} className="text-ink-400 shrink-0" />
          <span className="text-ink-600 flex-1">{fmtDate(h.timestamp)}</span>
          <span className="text-ink-500">{h.rowCount} row{h.rowCount !== 1 ? 's' : ''}</span>
          <span className="text-ink-400 text-xs">{h.filterDescription}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main ExportManager ─────────────────────────────────────────────────────
export function ExportManager({ survey, items, onClose }) {
  const surveyId = survey?.id

  const [filters, setFilters] = useState({
    statuses: [],
    dateFrom: '',
    dateTo: '',
    sinceLastExport: null,
  })
  const [tick, setTick] = useState(0)
  const [apiResponses, setApiResponses] = useState([])
  const [apiStats, setApiStats] = useState(null)
  const [apiLastExport, setApiLastExport] = useState(null)
  const [responsesLoading, setResponsesLoading] = useState(useApi)
  const [showHistory, setShowHistory] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const refresh = () => setTick(t => t + 1)

  const loadApiResponses = useCallback(async () => {
    if (!useApi || !surveyId) return
    setResponsesLoading(true)
    try {
      const [stats, responses, last] = await Promise.all([
        fetchResponseStats(surveyId),
        fetchAllResponses(surveyId),
        fetchLastExport(surveyId),
      ])
      setApiStats(stats)
      setApiResponses(responses)
      setApiLastExport(last?.timestamp ?? null)
    } catch (err) {
      console.error('Failed to load responses', err)
    } finally {
      setResponsesLoading(false)
    }
  }, [surveyId])

  useEffect(() => {
    if (useApi) loadApiResponses()
  }, [useApi, loadApiResponses, tick])

  const localResponses = useMemo(() => loadResponses(surveyId), [surveyId, tick])
  const allResponses   = useApi ? apiResponses : localResponses
  const exportHistory = useMemo(() => loadExportHistory(surveyId),         [surveyId, tick])
  const localLastExport = useMemo(() => lastExportTimestamp(surveyId),     [surveyId, tick])
  const lastExport    = useApi ? apiLastExport : localLastExport
  const filtered      = useMemo(() => applyFilters(allResponses, filters), [allResponses, filters])

  const filterDescription = () => {
    const parts = []
    if (filters.statuses.length) parts.push(filters.statuses.join(', '))
    const datePart = describeDateFilter(filters)
    if (datePart) parts.push(datePart)
    return parts.length ? parts.join(' · ') : 'All responses'
  }

  const handleExport = useCallback(async () => {
    if (!filtered.length) return
    setIsExporting(true)
    try {
      const csv = useApi
        ? await generateCSVFromApiPages(
            items,
            survey,
            filters,
            (page) => fetchResponsesPage(surveyId, page, 200),
          )
        : generateCSV(items, filtered, survey)
      const ts  = new Date().toISOString()
      const filename = `${(survey?.title || 'survey').replace(/\s+/g, '_')}_${ts.slice(0, 10)}.csv`
      downloadCSV(csv, filename)

      recordExport(surveyId, {
        id:                newResponseId(),
        timestamp:         ts,
        rowCount:          filtered.length,
        filterDescription: filterDescription(),
      })
      if (useApi) {
        try {
          await recordExportApi(surveyId, {
            rowCount: filtered.length,
            filters: {
              statuses: filters.statuses,
              dateFrom: filters.dateFrom || null,
              dateTo: filters.dateTo || null,
              sinceLastExport: filters.sinceLastExport || null,
              filterDescription: filterDescription(),
            },
          })
        } catch (err) {
          console.error('Failed to record export on server', err)
        }
      }
      refresh()
    } finally {
      setIsExporting(false)
    }
  }, [filtered, items, survey, surveyId, filters, useApi])

  const handleClearAll = async () => {
    if (useApi) {
      try {
        await clearResponsesApi(surveyId)
      } catch (err) {
        console.error('Failed to clear responses', err)
        return
      }
    } else {
      clearResponses(surveyId)
    }
    setConfirmClear(false)
    refresh()
  }

  const handleDeleteResponse = async (responseId) => {
    if (useApi) {
      await deleteResponseApi(surveyId, responseId)
      return
    }
    deleteResponse(surveyId, responseId)
  }

  const counts = useMemo(() => {
    if (useApi && apiStats) {
      return {
        complete:   apiStats.complete ?? 0,
        terminated: apiStats.terminated ?? 0,
        partial:    apiStats.partial ?? 0,
        dnc:        apiStats.dnc ?? 0,
      }
    }
    const c = { complete: 0, terminated: 0, partial: 0, dnc: 0 }
    allResponses.forEach(r => { if (c[r.status] !== undefined) c[r.status]++ })
    return c
  }, [useApi, apiStats, allResponses])

  const totalResponses = useApi && apiStats ? apiStats.total : allResponses.length

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-ink-100 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
            <Download size={16} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-ink-800">Response Export Manager</h2>
            <p className="text-xs text-ink-400">
              {totalResponses} total response{totalResponses !== 1 ? 's' : ''} ·{' '}
              <span className="text-emerald-600">{counts.complete} complete</span> ·{' '}
              <span className="text-rose-500">{counts.terminated} terminated</span> ·{' '}
              <span className="text-amber-500">{counts.partial} partial</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-ink-400 hover:text-ink-700 hover:bg-ink-100 rounded-lg transition-all">
            <X size={18} />
          </button>
        </div>

        <ExportFiltersBar
          filters={filters}
          setFilters={setFilters}
          lastExport={lastExport}
        />

        <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
          {/* Response table */}
          <div className="flex-1 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-ink-500 uppercase tracking-wider">
                {hasActiveFilters(filters)
                  ? `Filtered: ${filtered.length} of ${allResponses.length}`
                  : `All responses (${allResponses.length})`
                }
              </p>
              <div className="flex items-center gap-2">
                <button onClick={refresh} className="p-1.5 text-ink-400 hover:text-ink-600 hover:bg-ink-100 rounded-lg transition-all" title="Refresh">
                  <RefreshCw size={13} />
                </button>
                {allResponses.length > 0 && (
                  confirmClear ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-rose-600">Delete all?</span>
                      <button onClick={handleClearAll} className="text-xs font-bold text-white bg-rose-600 px-2 py-1 rounded-lg">Yes</button>
                      <button onClick={() => setConfirmClear(false)} className="text-xs text-ink-500 px-2 py-1 hover:bg-ink-100 rounded-lg">No</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmClear(true)}
                      className="text-xs text-rose-500 hover:text-rose-700 flex items-center gap-1 px-2 py-1 hover:bg-rose-50 rounded-lg transition-all"
                    >
                      <Trash2 size={11} /> Clear all
                    </button>
                  )
                )}
              </div>
            </div>

            {responsesLoading ? (
              <div className="text-center py-16 text-ink-400 text-sm">Loading responses…</div>
            ) : allResponses.length === 0 ? (
              <div className="text-center py-16 text-ink-300">
                <Download size={36} className="mx-auto mb-3 text-ink-200" />
                <p className="text-sm font-semibold text-ink-400">No responses yet</p>
                <p className="text-xs mt-1">Run the survey in Preview mode to collect responses.</p>
              </div>
            ) : (
              <ResponseTable
                responses={filtered}
                items={items}
                surveyId={surveyId}
                onDeleted={refresh}
                onDeleteResponse={handleDeleteResponse}
              />
            )}
          </div>

          {/* Export history */}
          <div className="border-t border-ink-100 px-4 pb-4 pt-3 shrink-0">
            <button
              onClick={() => setShowHistory(h => !h)}
              className="flex items-center gap-2 text-xs font-semibold text-ink-500 hover:text-ink-700 transition-colors mb-2"
            >
              <Clock size={12} />
              Export history ({exportHistory.length})
              {showHistory ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
            {showHistory && <ExportHistory history={exportHistory} />}
          </div>
        </div>

        {/* Export footer */}
        <div className="px-5 py-4 border-t border-ink-100 bg-white shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${
                filtered.length > 0 ? 'text-emerald-700' : 'text-ink-400'
              }`}>
                {filtered.length} response{filtered.length !== 1 ? 's' : ''} will export
              </p>
              <p className="text-xs text-ink-400 truncate mt-0.5">
                {filterDescription()}
              </p>
            </div>
            <button
              onClick={handleExport}
              disabled={!filtered.length || isExporting}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-all shrink-0"
            >
              {isExporting
                ? <><Loader2 size={15} className="animate-spin" /> Generating…</>
                : <><Download size={15} /> Download CSV</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ExportManager
