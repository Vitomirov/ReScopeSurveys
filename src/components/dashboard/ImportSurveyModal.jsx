import { useState, useRef } from 'react'
import { Upload, FileText, X, Download } from 'lucide-react'
import { importSurveyFormData } from '@/api/survey/import'
import { ApiError } from '@/api/client'

const TEMPLATE_XLSX = '/templates/survey-import-template.xlsx'
const TEMPLATE_TXT = '/templates/survey-import-text-outline-sample.txt'

const SAMPLE_OUTLINE = `How satisfied are you with our product overall?
() Very satisfied
() Somewhat satisfied
() Neutral
() Somewhat dissatisfied
() Very dissatisfied

Which of the following features do you use regularly? (Select all that apply)
[] Reporting and Analytics
[] Automated Workflows
[] Third-Party Integrations
[] Custom Templates

What is your current job title?
____

Please share any additional feedback or suggestions for improvement:
____
____`

export function ImportSurveyModal({ open, onClose, onImported, canImport }) {
  const [tab, setTab] = useState('file')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [warnings, setWarnings] = useState([])
  const fileRef = useRef(null)

  if (!open) return null

  async function submitFile(file) {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('format', file.name.endsWith('.csv') ? 'csv' : 'xlsx')
    return importSurveyFormData(fd)
  }

  async function submitText() {
    const fd = new FormData()
    fd.append('format', 'text')
    fd.append('text', text)
    return importSurveyFormData(fd)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canImport) return
    setBusy(true)
    setError('')
    setWarnings([])
    try {
      let data
      if (tab === 'text') {
        if (!text.trim()) {
          setError('Paste survey content or use the sample outline.')
          setBusy(false)
          return
        }
        data = await submitText()
      } else {
        const file = fileRef.current?.files?.[0]
        if (!file) {
          setError('Choose a .xlsx or .csv file.')
          setBusy(false)
          return
        }
        data = await submitFile(file)
      }
      setWarnings(data.warnings || [])
      onImported?.(data)
      onClose()
    } catch (err) {
      const body = err instanceof ApiError ? err.body : null
      const lines = (body?.errors || [])
        .map(e => (e.path ? `${e.path}: ${e.message}` : e.message))
        .filter(Boolean)
      setError(lines.length ? lines.join('\n') : (body?.error || err.message || 'Import failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/40"
      onClick={onClose}
    >
    {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
    <div
      className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5 border border-ink-200"
      onClick={ev => ev.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">Import survey</h2>
          <p className="text-sm text-ink-500 mt-0.5">
            {canImport
              ? 'Imports land as pending for QA before you publish.'
              : 'Survey import is included with the Enterprise plan.'}
          </p>
        </div>
        <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-ink-50 text-ink-500" aria-label="Close">
          <X size={18} />
        </button>
      </div>

      {canImport && (
        <div className="flex flex-wrap gap-2 mb-4 p-3 rounded-xl bg-ink-50 border border-ink-100">
          <a
            href={TEMPLATE_XLSX}
            download="survey-import-template.xlsx"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-800"
          >
            <Download size={14} /> Excel template
          </a>
          <a
            href={TEMPLATE_TXT}
            download="survey-import-text-outline-sample.txt"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-800"
          >
            <Download size={14} /> Text sample
          </a>
          <span className="text-xs text-ink-400 w-full sm:w-auto sm:ml-auto">
            Full guide: <code className="text-ink-500">docs/SURVEY_IMPORT.md</code>
          </span>
        </div>
      )}

      {canImport && (
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setTab('file')}
            className={`flex-1 py-2 text-sm rounded-lg border ${tab === 'file' ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-ink-200'}`}
          >
            <Upload size={14} className="inline mr-1" /> File
          </button>
          <button
            type="button"
            onClick={() => setTab('text')}
            className={`flex-1 py-2 text-sm rounded-lg border ${tab === 'text' ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-ink-200'}`}
          >
            <FileText size={14} className="inline mr-1" /> Text outline
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {tab === 'file' && canImport && (
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" className="block w-full text-sm" />
        )}
        {tab === 'text' && canImport && (
          <>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={12}
              className="w-full text-sm border border-ink-200 rounded-xl p-3 font-mono"
              placeholder="Paste ReScope text outline…"
            />
            <button
              type="button"
              className="text-xs text-brand-600 mt-2 hover:underline"
              onClick={() => setText(SAMPLE_OUTLINE)}
            >
              Insert sample outline
            </button>
          </>
        )}

        {error && <p className="text-sm text-rose-600 mt-3 whitespace-pre-wrap">{error}</p>}
        {warnings.length > 0 && (
          <ul className="text-xs text-amber-700 mt-2 list-disc pl-4">
            {warnings.map((w, i) => (
              <li key={i}>{w.message || String(w)}</li>
            ))}
          </ul>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-ink-200">Cancel</button>
          {canImport && (
            <button type="submit" disabled={busy} className="px-4 py-2 text-sm rounded-lg bg-brand-600 text-white disabled:opacity-50">
              {busy ? 'Importing…' : 'Import'}
            </button>
          )}
        </div>
      </form>
    </div>
    </div>
  )
}