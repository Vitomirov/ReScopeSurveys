import { useRef } from 'react'
import { Plus, Trash2, Upload, X, ImageOff, Zap, AlignLeft } from 'lucide-react'
import { SectionLabel, Divider, Toggle } from '@/components/ui'
import { makeImageOption } from '@/store/surveyStore'

const MAX_BYTES = 3 * 1024 * 1024  // 3MB per image

function ImageOptionCard({ opt, index, isMulti, onUpdate, onDelete, canDelete }) {
  const fileRef = useRef(null)

  const handleFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > MAX_BYTES) { alert('Image must be under 3MB.'); return }
    const reader = new FileReader()
    reader.onload = () => onUpdate(opt.id, 'image', reader.result)
    reader.readAsDataURL(file)
  }

  return (
    <div className="border-2 border-ink-200 rounded-xl overflow-hidden bg-white group hover:border-ink-300 transition-all">
      {/* Image zone */}
      {opt.image ? (
        <div className="relative">
          <img src={opt.image} alt={opt.imageAlt || opt.text || ''} className="w-full h-32 object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <button onClick={() => fileRef.current?.click()}
              className="text-xs font-medium bg-white text-ink-700 px-2 py-1 rounded-lg hover:bg-ink-50">
              Replace
            </button>
            <button onClick={() => onUpdate(opt.id, 'image', null)}
              className="text-xs font-medium bg-white text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50 flex items-center gap-1">
              <X size={10} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileRef.current?.click()}
          onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]) }}
          onDragOver={e => e.preventDefault()}
          className="h-32 flex flex-col items-center justify-center gap-1 bg-ink-50 hover:bg-brand-50 cursor-pointer transition-all border-b border-ink-200"
        >
          <Upload size={18} className="text-ink-300" />
          <p className="text-xs text-ink-400">Upload image</p>
          <p className="text-xs text-ink-300">or leave blank for text-only tile</p>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => handleFile(e.target.files?.[0])} />

      {/* Label + controls */}
      <div className="p-2.5 space-y-2">
        <input
          type="text"
          value={opt.text}
          onChange={e => onUpdate(opt.id, 'text', e.target.value)}
          placeholder={`Option ${index + 1} label`}
          className="input-base py-1.5 text-sm w-full"
        />
        {opt.image && (
          <input
            type="text"
            value={opt.imageAlt || ''}
            onChange={e => onUpdate(opt.id, 'imageAlt', e.target.value)}
            placeholder="Alt text (accessibility)"
            className="input-base py-1 text-xs w-full text-ink-500"
          />
        )}

        {/* Option flags */}
        <div className="flex items-center gap-2 flex-wrap">
          {!isMulti && (
            <label className="flex items-center gap-1.5 cursor-pointer group/flag">
              <div
                onClick={() => onUpdate(opt.id, 'terminates', !opt.terminates)}
                className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-all ${
                  opt.terminates ? 'border-rose-500 bg-rose-500' : 'border-ink-300'
                }`}
              >
                {opt.terminates && <Zap size={8} className="text-white" />}
              </div>
              <span className="text-xs text-ink-500">Screen-out</span>
            </label>
          )}
          {isMulti && (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <div
                onClick={() => onUpdate(opt.id, 'isExclusive', !opt.isExclusive)}
                className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-all ${
                  opt.isExclusive ? 'border-amber-500 bg-amber-500' : 'border-ink-300'
                }`}
              >
                {opt.isExclusive && <X size={8} className="text-white" />}
              </div>
              <span className="text-xs text-ink-500">Exclusive</span>
            </label>
          )}
          <label className="flex items-center gap-1.5 cursor-pointer">
            <div
              onClick={() => onUpdate(opt.id, 'openText', { ...opt.openText, enabled: !opt.openText?.enabled })}
              className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-all ${
                opt.openText?.enabled ? 'border-brand-500 bg-brand-500' : 'border-ink-300'
              }`}
            >
              {opt.openText?.enabled && <AlignLeft size={8} className="text-white" />}
            </div>
            <span className="text-xs text-ink-500">Open text</span>
          </label>

          {canDelete && (
            <button onClick={() => onDelete(opt.id)}
              className="ml-auto p-1 text-ink-300 hover:text-rose-500 hover:bg-rose-50 rounded transition-all">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function ImageChoiceEditor({ question, dispatch }) {
  const cfg    = question.imageChoiceConfig
  const isMulti = question.questionType === 'image_choice_multi'

  const updateCfg = (patch) =>
    dispatch({ type: 'UPDATE_ITEM', id: question.id, patch: { imageChoiceConfig: { ...cfg, ...patch } } })

  const updateOption = (id, field, val) =>
    updateCfg({ imageOptions: cfg.imageOptions.map(o => o.id === id ? { ...o, [field]: val } : o) })

  const deleteOption = (id) =>
    updateCfg({ imageOptions: cfg.imageOptions.filter(o => o.id !== id) })

  const addOption = () =>
    updateCfg({ imageOptions: [...cfg.imageOptions, makeImageOption()] })

  const withoutImage = cfg.imageOptions.filter(o => !o.image).length

  return (
    <div className="space-y-4">
      {/* Instruction */}
      <div>
        <label className="text-xs text-ink-500 mb-1 block">Instruction (optional)</label>
        <input type="text" value={cfg.instruction}
          onChange={e => updateCfg({ instruction: e.target.value })}
          placeholder={isMulti ? 'Select all that apply…' : 'Select one option…'}
          className="input-base text-sm" />
      </div>

      {/* Grid columns + show labels */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-ink-500 mb-1 block">Grid columns</label>
          <div className="flex gap-1.5">
            {[2, 3, 4].map(n => (
              <button key={n} onClick={() => updateCfg({ columns: n })}
                className={`flex-1 py-1.5 rounded-lg border-2 text-sm font-bold transition-all ${
                  cfg.columns === n ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:border-ink-300'
                }`}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between p-2.5 bg-ink-50 rounded-lg">
          <div>
            <p className="text-sm font-medium text-ink-700">Show labels</p>
            <p className="text-xs text-ink-400">Text below images</p>
          </div>
          <Toggle checked={cfg.showLabels} onChange={v => updateCfg({ showLabels: v })} />
        </div>
      </div>

      {/* Text-only options note */}
      {withoutImage > 0 && (
        <div className="flex items-start gap-2 p-2.5 bg-ink-50 border border-ink-200 rounded-lg">
          <ImageOff size={14} className="text-ink-400 mt-0.5 shrink-0" />
          <p className="text-xs text-ink-500">
            <strong>{withoutImage} option{withoutImage !== 1 ? 's' : ''}</strong> without an image will render as text-only tile{withoutImage !== 1 ? 's' : ''} with a dashed border — useful for "None of the above", "Other", etc.
          </p>
        </div>
      )}

      {/* Image options grid */}
      <div>
        <SectionLabel>Options ({cfg.imageOptions.length})</SectionLabel>
        <div className={`grid gap-3 ${cfg.columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : cfg.columns === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'}`}>
          {cfg.imageOptions.map((opt, i) => (
            <ImageOptionCard
              key={opt.id}
              opt={opt}
              index={i}
              isMulti={isMulti}
              onUpdate={updateOption}
              onDelete={deleteOption}
              canDelete={cfg.imageOptions.length > 1}
            />
          ))}
          {/* Add option card */}
          <button onClick={addOption}
            className="h-full min-h-[11rem] flex flex-col items-center justify-center gap-2 border-2 border-dashed border-ink-200 hover:border-brand-300 hover:bg-brand-50/30 rounded-xl transition-all text-ink-400 hover:text-brand-600">
            <Plus size={20} />
            <span className="text-xs font-medium">Add option</span>
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="p-3 bg-pink-50 border border-pink-100 rounded-xl text-xs text-pink-700 space-y-0.5">
        <p className="font-semibold mb-1">Summary</p>
        <p>· {cfg.imageOptions.length} options · {cfg.columns}-column grid · {isMulti ? 'Multi-select' : 'Single-select'}</p>
        <p>· {cfg.imageOptions.filter(o => o.image).length} with images · {withoutImage} text-only</p>
        <p>· All termination rules, visibility logic and companion text carry over automatically</p>
      </div>
    </div>
  )
}

export default ImageChoiceEditor
