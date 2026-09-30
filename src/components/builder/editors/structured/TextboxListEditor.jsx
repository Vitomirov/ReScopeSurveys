import { useRef } from 'react'
import { Plus } from 'lucide-react'
import { SectionLabel } from '@/components/ui'
import { EditableListRow } from '@/components/shared'
import { makeTextboxRow } from '@/store/surveyStore'
import { OPEN_TEXT_PLACEHOLDER } from '@/constants/placeholders'

export function TextboxListEditor({ question, dispatch }) {
  const cfg = question.textboxListConfig
  const inputRefs = useRef({})

  const updateCfg = (patch) =>
    dispatch({ type: 'UPDATE_ITEM', id: question.id, patch: { textboxListConfig: { ...cfg, ...patch } } })

  const updateRow    = (id, label) => updateCfg({ rows: cfg.rows.map(r => r.id === id ? { ...r, label } : r) })
  const deleteRow    = (id)        => updateCfg({ rows: cfg.rows.filter(r => r.id !== id) })
  const bulkReplace  = (rows)      => updateCfg({ rows })
  const addRowAfter  = (afterId) => {
    const idx  = cfg.rows.findIndex(r => r.id === afterId)
    const next = makeTextboxRow()
    updateCfg({ rows: [...cfg.rows.slice(0, idx + 1), next, ...cfg.rows.slice(idx + 1)] })
    setTimeout(() => inputRefs.current[next.id]?.focus(), 30)
  }
  const addRow = () => {
    const next = makeTextboxRow()
    updateCfg({ rows: [...cfg.rows, next] })
    setTimeout(() => inputRefs.current[next.id]?.focus(), 30)
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-ink-500 mb-1 block">Instruction (optional)</label>
        <input type="text" value={cfg.instruction}
          onChange={e => updateCfg({ instruction: e.target.value })}
          placeholder="Write the product(s) you use next to each brand…"
          className="input-base text-sm" />
      </div>

      <div>
        <SectionLabel>Rows ({cfg.rows.length})</SectionLabel>
        <p className="text-xs text-ink-400 mb-2"><strong>Enter</strong> to add next · <strong>Paste lines</strong> to bulk-add</p>
        <div className="space-y-1.5">
          {cfg.rows.map((row, i) => (
            <EditableListRow
              key={row.id}
              item={row}
              index={i}
              items={cfg.rows}
              valueField="label"
              onUpdate={updateRow}
              onDelete={deleteRow}
              onAddAfter={addRowAfter}
              onBulkReplace={bulkReplace}
              makeItem={makeTextboxRow}
              canDelete={cfg.rows.length > 1}
              inputRefs={inputRefs}
              placeholder={`Row label ${i + 1}`}
              trailing={
                <div className="w-28 h-8 border border-ink-200 rounded-lg bg-white flex items-center px-2 shrink-0">
                  <span className="text-xs text-ink-300 italic">answer…</span>
                </div>
              }
            />
          ))}
        </div>
        <button onClick={addRow}
          className="mt-2 flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium px-2 py-1.5 hover:bg-brand-50 rounded-lg transition-all">
          <Plus size={14} /> Add row
        </button>
      </div>

      <div>
        <label className="text-xs text-ink-500 mb-1 block">Input placeholder text</label>
        <input type="text" value={cfg.placeholder}
          onChange={e => updateCfg({ placeholder: e.target.value })}
          placeholder={OPEN_TEXT_PLACEHOLDER}
          className="input-base text-sm" />
      </div>

      {/* Preview */}
      <div className="rounded-xl border border-dashed border-ink-200 p-4 bg-ink-50 space-y-2">
        <p className="text-xs text-ink-400 font-medium mb-3">Preview</p>
        {cfg.rows.slice(0, 4).map(row => (
          <div key={row.id} className="flex items-center gap-3">
            <span className="text-sm text-ink-700 w-32 shrink-0 font-medium">{row.label || 'Label'}</span>
            <div className="flex-1 h-9 border border-ink-200 rounded-lg bg-white flex items-center px-3">
              <span className="text-sm text-ink-300">{cfg.placeholder || OPEN_TEXT_PLACEHOLDER}</span>
            </div>
          </div>
        ))}
        {cfg.rows.length > 4 && <p className="text-xs text-ink-400">…and {cfg.rows.length - 4} more rows</p>}
      </div>
    </div>
  )
}

export default TextboxListEditor
