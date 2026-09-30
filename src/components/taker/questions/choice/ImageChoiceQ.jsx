import { useState } from 'react'
import { Check } from 'lucide-react'
import { SPECIFY_PLACEHOLDER } from '@/constants/placeholders'

export function ImageChoiceQ({ question, value, onChange }) {
  const cfg     = question.imageChoiceConfig
  const isMulti = question.questionType === 'image_choice_multi'
  const [companions, setCompanions] = useState({})

  // value = optionId (single) | optionId[] (multi)
  const isSelected = (id) => isMulti
    ? Array.isArray(value) && value.includes(id)
    : value === id

  const toggle = (opt) => {
    if (isMulti) {
      const curr = Array.isArray(value) ? value : []
      if (opt.isExclusive) {
        onChange(curr.includes(opt.id) ? [] : [opt.id])
      } else {
        const exclusiveIds = cfg.imageOptions.filter(o => o.isExclusive).map(o => o.id)
        const filtered = curr.filter(id => !exclusiveIds.includes(id))
        onChange(filtered.includes(opt.id)
          ? filtered.filter(id => id !== opt.id)
          : [...filtered, opt.id])
      }
    } else {
      onChange(value === opt.id ? null : opt.id)
    }
  }

  const colClass = cfg.columns === 2
    ? 'grid-cols-2'
    : cfg.columns === 3
      ? 'grid-cols-2 sm:grid-cols-3'
      : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'

  return (
    <div>
      {cfg.instruction && <p className="text-sm text-ink-500 italic mb-3">{cfg.instruction}</p>}
      <div className={`grid ${colClass} gap-3`}>
        {cfg.imageOptions.map(opt => {
          const sel = isSelected(opt.id)
          return (
            <div key={opt.id}>
              <button
                onClick={() => toggle(opt)}
                className={`w-full rounded-xl border-2 overflow-hidden transition-all focus:outline-none relative group ${
                  sel
                    ? 'border-brand-500 shadow-md shadow-brand-100'
                    : 'border-ink-200 hover:border-ink-300'
                }`}
              >
                {opt.image ? (
                  <>
                    <img src={opt.image} alt={opt.imageAlt || opt.text || ''}
                      className="w-full aspect-square object-cover" />
                    {/* Selected overlay */}
                    {sel && (
                      <div className="absolute inset-0 bg-brand-600/20 flex items-center justify-center">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shadow ${
                          isMulti ? 'bg-brand-600' : 'bg-brand-600'
                        }`}>
                          {isMulti
                            ? <Check size={14} className="text-white" strokeWidth={3} />
                            : <div className="w-3 h-3 rounded-full bg-white" />
                          }
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  /* Text-only tile */
                  <div className={`aspect-square flex items-center justify-center p-3 border-2 border-dashed rounded-xl transition-all ${
                    sel ? 'border-brand-400 bg-brand-50' : 'border-ink-200 bg-ink-50 group-hover:border-ink-300'
                  }`}>
                    <span className={`text-sm font-medium text-center leading-snug ${sel ? 'text-brand-700' : 'text-ink-600'}`}>
                      {opt.text || 'Option'}
                    </span>
                  </div>
                )}
              </button>

              {/* Label below image */}
              {cfg.showLabels && opt.image && (
                <p className={`text-xs text-center mt-1.5 font-medium leading-snug ${sel ? 'text-brand-700' : 'text-ink-600'}`}>
                  {opt.text}
                </p>
              )}

              {/* Companion open text */}
              {sel && opt.openText?.enabled && (
                <div className="mt-1.5">
                  <input
                    type="text"
                    value={companions[opt.id] || ''}
                    onChange={e => setCompanions(c => ({ ...c, [opt.id]: e.target.value }))}
                    placeholder={opt.openText.placeholder || SPECIFY_PLACEHOLDER}
                    className="w-full border border-ink-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ImageChoiceQ
