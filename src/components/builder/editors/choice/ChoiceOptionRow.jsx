import { useRef, useEffect } from 'react'
import { Trash2, Anchor, Ban, MessageSquare, GripVertical, UserX } from 'lucide-react'
import { Toggle, IconBtn, Tip } from '@/components/ui'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { splitBulkPasteValues } from '@/utils/format/bulkPaste'

function AnchorBtn({ position, onChange }) {
  const states = [null, 'top', 'bottom']
  const labels = { null: 'No anchor', top: 'Anchored top', bottom: 'Anchored bottom' }
  const colors = {
    null:   'text-ink-300 hover:text-ink-500',
    top:    'text-brand-600 bg-brand-50',
    bottom: 'text-amber-500 bg-amber-50',
  }
  const key = position ?? 'null'
  const cycle = () => {
    const idx = states.indexOf(position)
    onChange(states[(idx + 1) % states.length])
  }
  return (
    <Tip label={`Anchor: ${labels[key]}`}>
      <button onClick={cycle} className={`p-1.5 rounded-lg transition-all ${colors[key]}`}>
        <Anchor size={13} />
      </button>
    </Tip>
  )
}

export function ChoiceOptionRow({ option, questionId, questionType, dispatch, canDelete, index, focusOptionId }) {
  const inputRef = useRef(null)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: option.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  // Auto-focus when this option was just created via Enter or Paste
  useEffect(() => {
    if (focusOptionId === option.id && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
      dispatch({ type: 'CLEAR_FOCUS' })
    }
  }, [focusOptionId, option.id, dispatch])

  const update = (patch) =>
    dispatch({ type: 'UPDATE_OPTION', questionId, optionId: option.id, patch })

  const updateOpenText = (patch) =>
    dispatch({ type: 'UPDATE_OPTION_OPEN_TEXT', questionId, optionId: option.id, patch })

  // ── Paste handler: newlines or comma-separated values → multiple options
  const handlePaste = (e) => {
    const lines = splitBulkPasteValues(e.clipboardData.getData('text'))
    if (lines.length > 1) {
      e.preventDefault()
      dispatch({ type: 'PASTE_OPTIONS', questionId, currentOptionId: option.id, lines })
    }
    // Single value: allow default paste behaviour
  }

  // ── Enter key: create new option below
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      dispatch({ type: 'ADD_OPTION_AFTER', questionId, afterOptionId: option.id })
    }
    if (e.key === 'Backspace' && option.text === '' && canDelete) {
      e.preventDefault()
      dispatch({ type: 'DELETE_OPTION', questionId, optionId: option.id })
    }
  }

  return (
    <div ref={setNodeRef} style={style} className="group">
      <div className={`flex flex-col gap-2 sm:flex-row sm:items-start p-1.5 rounded-lg hover:bg-ink-50 transition-colors ${option.anchorPosition ? 'bg-brand-50/30' : ''}`}>
        <div className="flex items-start gap-2 flex-1 min-w-0">
        {/* Drag Handle */}
        <div {...attributes} {...listeners} className="drag-handle mt-2 p-0.5 text-ink-200 group-hover:text-ink-400 transition-colors shrink-0">
          <GripVertical size={14} />
        </div>

        {/* Answer type icon */}
        <div className="mt-2.5 shrink-0">
          {questionType === 'single_select' && <div className="w-3.5 h-3.5 rounded-full border-2 border-ink-300" />}
          {questionType === 'multi_select'  && <div className="w-3.5 h-3.5 rounded border-2 border-ink-300" />}
          {questionType === 'dropdown'      && <span className="text-ink-300 text-xs font-mono">{String(index + 1).padStart(2,'0')}</span>}
        </div>

        {/* Input */}
        <div className="flex-1 min-w-0">
          <input
            ref={inputRef}
            type="text"
            value={option.text}
            onChange={e => update({ text: e.target.value })}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            placeholder={`Option ${index + 1}  (Enter to add next, paste lines or commas)`}
            className="input-base py-1.5 text-sm"
          />

          {/* Open text companion */}
          {option.openText.enabled && (
            <div className="mt-1.5 flex items-center gap-2 pl-1">
              <div className="flex-1 border-l-2 border-brand-200 pl-2">
                <input
                  type="text"
                  value={option.openText.placeholder}
                  onChange={e => updateOpenText({ placeholder: e.target.value })}
                  placeholder="Placeholder text..."
                  className="input-base py-1 text-xs text-ink-400"
                />
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs text-ink-400">Required</span>
                <Toggle size="sm" checked={option.openText.required} onChange={val => updateOpenText({ required: val })} />
              </div>
            </div>
          )}
        </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-0.5 shrink-0 pl-8 sm:pl-0 sm:mt-0.5">
          <AnchorBtn position={option.anchorPosition} onChange={pos => update({ anchorPosition: pos })} />
          <Tip label={option.isExclusive ? 'Exclusive (active)' : 'Set as exclusive / none-of-above'}>
            <button
              onClick={() => update({ isExclusive: !option.isExclusive })}
              className={`p-1.5 rounded-lg transition-all ${option.isExclusive ? 'text-rose-500 bg-rose-50' : 'text-ink-300 hover:text-rose-400'}`}
            >
              <Ban size={13} />
            </button>
          </Tip>
          <Tip label={option.openText.enabled ? 'Remove open-text field' : 'Add open-text field'}>
            <button
              onClick={() => updateOpenText({ enabled: !option.openText.enabled })}
              className={`p-1.5 rounded-lg transition-all ${option.openText.enabled ? 'text-brand-500 bg-brand-50' : 'text-ink-300 hover:text-brand-400'}`}
            >
              <MessageSquare size={13} />
            </button>
          </Tip>
          <Tip label={option.terminates ? 'Terminate active — click to remove' : 'Selecting this answer terminates the survey'}>
            <button
              onClick={() => update({ terminates: !option.terminates })}
              className={`p-1.5 rounded-lg transition-all ${option.terminates ? 'text-white bg-rose-600 hover:bg-rose-700' : 'text-ink-300 hover:text-rose-500'}`}
            >
              <UserX size={13} />
            </button>
          </Tip>
          {canDelete && <IconBtn icon={Trash2} onClick={() => dispatch({ type: 'DELETE_OPTION', questionId, optionId: option.id })} variant="danger" title="Delete option" />}
        </div>
      </div>

      {/* Indicator badges */}
      <div className="ml-10 flex gap-1.5 mb-0.5 flex-wrap">
        {option.anchorPosition && (
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded flex items-center gap-1 ${option.anchorPosition === 'top' ? 'text-brand-600 bg-brand-50' : 'text-amber-600 bg-amber-50'}`}>
            <Anchor size={9} /> Anchored {option.anchorPosition}
          </span>
        )}
        {option.isExclusive && (
          <span className="text-xs font-medium px-1.5 py-0.5 rounded flex items-center gap-1 text-rose-600 bg-rose-50">
            <Ban size={9} /> Exclusive
          </span>
        )}
        {option.terminates && (
          <span className="text-xs font-medium px-1.5 py-0.5 rounded flex items-center gap-1 text-white bg-rose-600">
            <UserX size={9} /> TERMINATES
          </span>
        )}
      </div>
    </div>
  )
}
