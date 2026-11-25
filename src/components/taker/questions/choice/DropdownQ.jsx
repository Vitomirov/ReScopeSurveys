import { TAKER_INPUT_CLASS } from '@/constants/ui/classNames'
import { useOrderedChoiceOptions } from '@/hooks/useOrderedChoiceOptions'

export function DropdownQ({ question, value, onChange }) {
  const options = useOrderedChoiceOptions(question)
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value || null)} className={`${TAKER_INPUT_CLASS} cursor-pointer`}>
      <option value="">— Select an option —</option>
      {options.map(opt => <option key={opt.id} value={opt.id}>{opt.text}</option>)}
    </select>
  )
}

export default DropdownQ
