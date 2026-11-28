import { memo } from 'react'
import { Trash2, GripVertical, ChevronRight, Zap } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ConditionBuilder,
  ConditionSummaryInline,
  buildConditionLogicString,
} from '@/components/shared/conditions/ConditionBuilder'
import { ImportQuestionReview } from '@/components/builder/import/ImportQuestionReview'

// ─── Condition summary for collapsed view ──────────────────────────────────
function CollapsedSummary({ conditions, questions }) {
  if (!conditions.length)
    return <span className="italic text-rose-600 text-xs">No conditions — click to configure</span>

  return (
    <div className="flex flex-wrap items-center gap-1">
      {conditions.map((cond, i) => (
        <span key={cond.id} className="flex items-center gap-1">
          {i > 0 && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
              cond.join === 'OR' ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-800/40 text-rose-400'
            }`}>
              {cond.join}
            </span>
          )}
          <span className="text-xs text-rose-300 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-800/30">
            <ConditionSummaryInline cond={cond} questions={questions} variant="termination" truncate={30} />
          </span>
        </span>
      ))}
    </div>
  )
}

// ─── Main TerminationBlockItem ─────────────────────────────────────────────
export const TerminationBlockItem = memo(function TerminationBlockItem({
  item, availableQuestions, contextItems = [], isActive, onActivateItem, dispatch,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  const conditions = item.conditions || []
  const hasConditions = conditions.length > 0

  return (
    <div ref={setNodeRef} style={style}>
      <div className={`rounded-xl overflow-hidden border transition-all ${
        isActive ? 'border-rose-500 shadow-lg shadow-rose-900/30' : 'border-rose-900/50 hover:border-rose-700'
      } bg-gradient-to-r from-rose-950 to-slate-950`}>

        {/* ── Header ── */}
        <div
          className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer"
          onClick={() => onActivateItem(item.id)}
        >
          <div
            {...attributes} {...listeners}
            className="drag-handle text-rose-800 hover:text-rose-600 transition-colors"
            onClick={e => e.stopPropagation()}
          >
            <GripVertical size={15} />
          </div>

          <div className="w-6 h-6 rounded-lg bg-rose-600 flex items-center justify-center shrink-0">
            <Zap size={12} className="text-white" />
          </div>

          <div className="flex-1 min-w-0" onClick={e => e.stopPropagation()}>
            <input
              type="text"
              value={item.title}
              onChange={e => dispatch({ type: 'UPDATE_ITEM', id: item.id, patch: { title: e.target.value } })}
              placeholder="Termination Block"
              className="bg-transparent border-none outline-none text-sm font-semibold text-rose-100 placeholder:text-rose-700 w-full mb-0.5"
            />
            {!isActive && (
              <div className="mt-0.5">
                <CollapsedSummary conditions={conditions} questions={availableQuestions} />
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
            {hasConditions && (
              <span className="text-xs bg-rose-700/50 text-rose-300 px-1.5 py-0.5 rounded-full">
                {conditions.length} cond{conditions.length !== 1 ? 's' : ''}
              </span>
            )}
            <button
              onClick={() => dispatch({ type: 'DELETE_ITEM', id: item.id })}
              className="p-1.5 text-rose-700 hover:text-rose-400 hover:bg-rose-900/40 rounded-lg transition-all"
            >
              <Trash2 size={13} />
            </button>
            <div className={`transition-transform duration-150 text-rose-700 ${isActive ? 'rotate-90' : ''}`}>
              <ChevronRight size={15} />
            </div>
          </div>
        </div>

        <div className="bg-white/5">
          <ImportQuestionReview item={item} dispatch={dispatch} />
        </div>

        {/* ── Expanded condition editor ── */}
        {isActive && (
          <div className="border-t border-rose-900/50 px-3 pt-3 pb-4 space-y-3">
            <div className="p-2.5 bg-rose-950/50 rounded-lg border border-rose-900/30">
              <p className="text-xs text-rose-400 leading-relaxed">
                <strong className="text-rose-300">How this works:</strong> This block evaluates all
                conditions using <em>AND before OR</em> precedence — so{' '}
                <code className="bg-rose-900/40 px-1 rounded">A AND B OR C</code> fires when{' '}
                <code className="bg-rose-900/40 px-1 rounded">(A AND B)</code> is true, or{' '}
                <code className="bg-rose-900/40 px-1 rounded">C</code> alone is true.
                Termination fires when the block evaluates to <strong className="text-rose-300">true</strong>.
                Checked when the respondent clicks Next.
              </p>
            </div>

            <ConditionBuilder
              variant="termination"
              conditions={conditions}
              availableQuestions={availableQuestions}
              contextItems={contextItems}
              onUpdateCondition={(conditionId, patch) =>
                dispatch({ type: 'UPDATE_TERMINATION_CONDITION', blockId: item.id, conditionId, patch })}
              onDeleteCondition={(conditionId) =>
                dispatch({ type: 'DELETE_TERMINATION_CONDITION', blockId: item.id, conditionId })}
              onAddCondition={() =>
                dispatch({ type: 'ADD_TERMINATION_CONDITION', blockId: item.id })}
              addLabel="Add Condition"
              truncate={30}
              previewMode="none"
            />

            {conditions.length > 1 && (
              <div className="p-2.5 bg-rose-950/60 rounded-lg border border-rose-900/40">
                <p className="text-xs text-rose-500 font-semibold mb-1.5 uppercase tracking-wider">
                  Logic Preview
                </p>
                <p className="text-xs text-rose-300 font-mono leading-relaxed whitespace-pre-line">
                  {buildConditionLogicString(conditions, availableQuestions)}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
})
