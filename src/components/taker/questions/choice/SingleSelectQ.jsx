import { SPECIFY_PLACEHOLDER } from '@/constants/survey/placeholders'
import { useOrderedChoiceOptions } from '@/hooks/useOrderedChoiceOptions'

export function SingleSelectQ({ question, value, onChange, companions = {}, onCompanionChange }) {
  const options = useOrderedChoiceOptions(question)
  if (!options.length) {
    return <p className="text-sm text-ink-400 italic p-3 border border-dashed border-ink-200 rounded-xl">Options will appear here once the source question is answered.</p>
  }
  return (
    <div className="space-y-2">
      {options.map(opt => {
        const selected = value === opt.id
        return (
          <div key={opt.id}>
            <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selected ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:border-ink-300 bg-white'}`}>
              <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${selected ? 'border-brand-500 bg-brand-500' : 'border-ink-300'}`}>
                {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <span className="text-sm text-ink-800 flex-1">{opt.text}</span>
              <input type="radio" className="sr-only" checked={selected} onChange={() => onChange(opt.id)} />
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
    </div>
  )
}

export default SingleSelectQ
