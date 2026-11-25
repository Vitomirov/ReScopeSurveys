import { OPEN_TEXT_PLACEHOLDER } from '@/constants/survey/placeholders'
import { TAKER_INPUT_CLASS, TAKER_INPUT_RESIZE_NONE_CLASS } from '@/constants/ui/classNames'

export function OpenTextQ({ question, value = '', onChange }) {
  const cfg = question.openTextConfig
  const v   = cfg?.validation
  return (
    <div>
      {cfg?.multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={cfg.placeholder || OPEN_TEXT_PLACEHOLDER} rows={4} className={TAKER_INPUT_RESIZE_NONE_CLASS} />
        : <input type={v?.type === 'number' ? 'number' : v?.type === 'email' ? 'email' : v?.type === 'url' ? 'url' : 'text'} value={value} onChange={e => onChange(e.target.value)} placeholder={cfg?.placeholder || OPEN_TEXT_PLACEHOLDER} min={v?.numberMin ?? undefined} max={v?.numberMax ?? undefined} className={TAKER_INPUT_CLASS} />
      }
      {cfg?.maxLength && <p className="text-xs text-ink-400 text-right mt-1">{value.length} / {cfg.maxLength}</p>}
    </div>
  )
}

export default OpenTextQ
