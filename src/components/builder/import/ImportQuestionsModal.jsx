import { useState } from 'react'
import { X } from 'lucide-react'
import { getSurvey } from '@/api/survey/surveys'
import { importSurveyJson } from '@/api/survey/import'
import { ApiError } from '@/api/client'
import { parseTextOutline } from '@shared/surveyImport/parseTextOutline.js'

export function ImportQuestionsModal({ open, onClose, surveyId, onAppended }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!open) return null

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const remote = await getSurvey(surveyId)
      const parsed = parseTextOutline(text)
      await importSurveyJson({
        schemaVersion: 1,
        mode: 'append',
        surveyId,
        revision: remote.revision,
        items: parsed.items,
      })
      onAppended?.(remote.revision)
      onClose()
    } catch (err) {
      const body = err instanceof ApiError ? err.body : null
      setError(body?.errors?.[0]?.message || err.message || 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-900/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5 border border-ink-200" onClick={ev => ev.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold text-ink-900">Import questions</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-ink-50"><X size={18} /></button>
        </div>
        <p className="text-sm text-ink-500 mb-3">Appends to this survey (draft or pending only). Uses ReScope text outline format.</p>
        <form onSubmit={handleSubmit}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={10}
            className="w-full text-sm border border-ink-200 rounded-xl p-3 font-mono"
          />
          {error && <p className="text-sm text-rose-600 mt-2">{error}</p>}
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-ink-200 rounded-lg">Cancel</button>
            <button type="submit" disabled={busy} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
              {busy ? 'Importing…' : 'Append'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}