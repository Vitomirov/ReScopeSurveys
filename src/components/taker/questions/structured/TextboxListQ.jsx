import { OPEN_TEXT_PLACEHOLDER } from '@/constants/placeholders'

export function TextboxListQ({ question, value = {}, onChange }) {
  const cfg = question.textboxListConfig
  return (
    <div className="space-y-2">
      {cfg.instruction && <p className="text-sm text-ink-500 italic mb-3">{cfg.instruction}</p>}
      {cfg.rows.map(row => (
        <div key={row.id} className="flex items-center gap-3">
          <label className="text-sm font-medium text-ink-700 w-36 shrink-0 text-right">
            {row.label || <span className="italic text-ink-400">Unlabelled</span>}
          </label>
          <input
            type="text"
            value={value[row.id] || ''}
            onChange={e => onChange({ ...value, [row.id]: e.target.value })}
            placeholder={cfg.placeholder || OPEN_TEXT_PLACEHOLDER}
            className="flex-1 border-2 border-ink-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 transition-all"
          />
        </div>
      ))}
    </div>
  )
}

export default TextboxListQ
