import { Check } from 'lucide-react'
import { SPECIFY_PLACEHOLDER } from '@/constants/survey/placeholders'
import { useOrderedChoiceOptions } from '@/hooks/useOrderedChoiceOptions'

export function MultiSelectQ({ question, value = [], onChange, companions = {}, onCompanionChange }) {
  const options = useOrderedChoiceOptions(question)
  const toggle = (optId, isExclusive) => {
    if (isExclusive) { onChange(value.includes(optId) ? [] : [optId]); return }
    const exclusiveIds = options.filter(o => o.isExclusive).map(o => o.id)
    const filtered = value.filter(id => !exclusiveIds.includes(id))
    onChange(filtered.includes(optId) ? filtered.filter(id => id !== optId) : [...filtered, optId])
  }
  return (
    <div className="space-y-2">
      {options.map(opt => {
        const selected = value.includes(opt.id)
        return (
          <div key={opt.id}>
            <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selected ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:border-ink-300 bg-white'}`}>
              <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-all ${selected ? 'border-brand-500 bg-brand-500' : 'border-ink-300'}`}>
                {selected && <Check size={10} className="text-white" strokeWidth={3} />}
              </div>
              <span className="text-sm text-ink-800 flex-1">{opt.text}</span>
              {opt.isExclusive && <span className="text-xs text-rose-500 shrink-0">Exclusive</span>}
              <input type="checkbox" className="sr-only" checked={selected} onChange={() => toggle(opt.id, opt.isExclusive)} />
            </label>
            {selected && opt.openText?.enabled && (
              <div className="mt-1.5 ml-7">
                <input
                  type="text"
                  value={companions[opt.id] || ''}
                  onChange={e => onCompanionChange?.(opt.id, e.target.value)}
                  placeholder={opt.openText.placeholder || SPECIFY_PLACEHOLDER}
                  className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
            )}
          </div>
        )
      })}
      {(question.minSelections || question.maxSelections) && (
        <p className="text-xs text-ink-400 mt-1">{question.minSelections && `Min ${question.minSelections}`}{question.minSelections && question.maxSelections ? ' · ' : ''}{question.maxSelections && `Max ${question.maxSelections}`} selection(s)</p>
      )}
    </div>
  )
}

export default MultiSelectQ
