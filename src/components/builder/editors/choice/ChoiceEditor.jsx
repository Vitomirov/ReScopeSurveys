import { Plus, UserX, Link2, Link2Off } from 'lucide-react'
import { isPipeableSource, isMatrixPipeSource, getMatrixPipeModeLabel } from '@/utils/survey/questions/piping'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { ChoiceOptionRow } from './ChoiceOptionRow'
import { QuestionLogicPanel } from '../logic/QuestionLogicPanel'
import { Divider, SectionLabel, Toggle } from '@/components/ui'

export function ChoiceEditor({ question, dispatch, focusOptionId, availableQuestions = [], contextItems = [], allItems = [], itemIndex = 0 }) {
  const pipeableSources = availableQuestions.filter(q => isPipeableSource(q.questionType))
  const pipeCfg         = question.pipedOptionsConfig || {}
  const pipingEnabled   = pipeCfg.enabled || false
  const matrixPipeMode  = pipeCfg.matrixPipeMode || (pipeCfg.matrixRowId ? 'columns' : 'rows')
  const setPipeCfg = (patch) =>
    dispatch({ type: 'UPDATE_ITEM', id: question.id, patch: { pipedOptionsConfig: { ...pipeCfg, ...patch } } })
  const sourceQ = pipeableSources.find(q => q.id === pipeCfg.sourceQuestionId)
  const ruleContextItems = contextItems.length ? contextItems : availableQuestions

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = question.options.findIndex(o => o.id === active.id)
    const newIndex = question.options.findIndex(o => o.id === over.id)
    dispatch({ type: 'REORDER_OPTIONS', questionId: question.id, options: arrayMove(question.options, oldIndex, newIndex) })
  }

  const topAnchored    = question.options.filter(o => o.anchorPosition === 'top').length
  const bottomAnchored = question.options.filter(o => o.anchorPosition === 'bottom').length
  const hasExclusive   = question.options.some(o => o.isExclusive)
  const hasOpenText    = question.options.some(o => o.openText?.enabled)
  const termOptCount   = question.options.filter(o => o.terminates).length
  const ruleCount      = (question.terminationRules || []).length
  const branchCount    = (question.branchRules || []).length
  const redirectCount  = (question.externalRedirectRules || []).length

  return (
    <div>
      {/* ── Option piping panel ─────────────────────────────────────────── */}
      <div className={`mb-3 p-3 rounded-xl border-2 transition-all ${pipingEnabled ? 'border-brand-400 bg-brand-50' : 'border-ink-100 bg-ink-50'}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {pipingEnabled ? <Link2 size={13} className="text-brand-600 shrink-0" /> : <Link2Off size={13} className="text-ink-400 shrink-0" />}
            <span className={`text-sm font-semibold ${pipingEnabled ? 'text-brand-700' : 'text-ink-600'}`}>
              Pipe options from earlier question
            </span>
          </div>
          <Toggle checked={pipingEnabled} onChange={v => setPipeCfg({ enabled: v, sourceQuestionId: null })} />
        </div>

        {pipingEnabled && (
          <div className="mt-2.5 space-y-2">
            {pipeableSources.length === 0 ? (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                No compatible questions found before this one. Add a single-select, multi-select, or dropdown question earlier in the survey.
              </p>
            ) : (
              <>
                <select
                  value={pipeCfg.sourceQuestionId || ''}
                  onChange={e => setPipeCfg({
                    sourceQuestionId: e.target.value || null,
                    matrixRowId: null,
                    matrixPipeMode: 'rows',
                  })}
                  className="input-base text-sm"
                >
                  <option value="">— Select source question —</option>
                  {pipeableSources.map((q) => (
                    <option key={q.id} value={q.id}>
                      Q{availableQuestions.indexOf(q) + 1}: {q.text || '(untitled)'}
                      {q.questionType === 'matrix' ? ' (matrix)' : ''}
                    </option>
                  ))}
                </select>
                {sourceQ && isMatrixPipeSource(sourceQ) && (
                  <>
                    <select
                      value={matrixPipeMode}
                      onChange={e => setPipeCfg({
                        matrixPipeMode: e.target.value,
                        matrixRowId: e.target.value === 'rows' ? null : pipeCfg.matrixRowId,
                      })}
                      className="input-base text-sm"
                    >
                      <option value="rows">Pipe matrix rows as options</option>
                      <option value="columns">Pipe selected columns from a row</option>
                    </select>
                    {matrixPipeMode === 'columns' && (
                      <select
                        value={pipeCfg.matrixRowId || ''}
                        onChange={e => setPipeCfg({ matrixRowId: e.target.value || null })}
                        className="input-base text-sm"
                      >
                        <option value="">— Select matrix row —</option>
                        {(sourceQ.matrixConfig?.rows || []).map(row => (
                          <option key={row.id} value={row.id}>{row.text || '(untitled row)'}</option>
                        ))}
                      </select>
                    )}
                  </>
                )}
                {sourceQ && (
                  <p className="text-xs text-brand-600">
                    ✓ In preview, options come from {getMatrixPipeModeLabel(matrixPipeMode)} in Q{availableQuestions.indexOf(sourceQ) + 1}.
                    Manual options below are ignored while piping is active.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Dim manual options when piping is active */}
      <div className={pipingEnabled ? 'opacity-40 pointer-events-none select-none' : ''}>
      {/* Summary badges */}
      {(topAnchored > 0 || bottomAnchored > 0 || hasExclusive || hasOpenText || termOptCount > 0 || ruleCount > 0 || branchCount > 0 || redirectCount > 0) && (
        <div className="flex flex-wrap gap-1.5 mb-3 p-2 bg-ink-50 rounded-lg">
          {topAnchored > 0    && <span className="text-xs text-brand-600 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded">⚓ {topAnchored} top</span>}
          {bottomAnchored > 0 && <span className="text-xs text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded">⚓ {bottomAnchored} bottom</span>}
          {hasExclusive       && <span className="text-xs text-rose-500 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded">⊘ Exclusive</span>}
          {hasOpenText        && <span className="text-xs text-brand-600 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded">💬 Open-text</span>}
          {termOptCount > 0   && <span className="text-xs text-white bg-rose-600 px-2 py-0.5 rounded flex items-center gap-1"><UserX size={9} /> {termOptCount} instant</span>}
          {ruleCount > 0      && <span className="text-xs text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded">{ruleCount} rule{ruleCount !== 1 ? 's' : ''} · {question.terminationLogic || 'if_any'}</span>}
          {branchCount > 0    && <span className="text-xs text-sky-700 bg-sky-100 border border-sky-200 px-2 py-0.5 rounded">{branchCount} branch{branchCount !== 1 ? 'es' : ''} · {question.branchLogic || 'if_any'}</span>}
          {redirectCount > 0  && <span className="text-xs text-emerald-700 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded">{redirectCount} external redirect{redirectCount !== 1 ? 's' : ''} · {question.externalRedirectLogic || 'if_any'}</span>}
        </div>
      )}

      <SectionLabel>Answer Options</SectionLabel>
      <p className="text-xs text-ink-400 mb-2">
        <strong>Enter</strong> to add next · <strong>Paste lines or commas</strong> to bulk-add ·{' '}
        <UserX size={10} className="inline text-rose-500" /> for instant screen-out
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={question.options.map(o => o.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-0.5">
            {question.options.map((option, index) => (
              <ChoiceOptionRow
                key={option.id}
                option={option}
                questionId={question.id}
                questionType={question.questionType}
                dispatch={dispatch}
                canDelete={question.options.length > 1}
                index={index}
                focusOptionId={focusOptionId}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        onClick={() => dispatch({ type: 'ADD_OPTION', questionId: question.id })}
        className="mt-2 flex items-center gap-2 text-sm text-brand-600 hover:text-brand-700 font-medium px-2 py-1.5 hover:bg-brand-50 rounded-lg transition-all w-full"
      >
        <Plus size={15} /> Add option
      </button>

      {/* Multi-select limits */}
      {question.questionType === 'multi_select' && (
        <>
          <Divider label="Selection Limits" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-ink-500 mb-1 block">Min selections</label>
              <input type="number" min={1} max={question.options.length} value={question.minSelections ?? ''}
                onChange={e => dispatch({ type: 'UPDATE_ITEM', id: question.id, patch: { minSelections: e.target.value ? parseInt(e.target.value) : null } })}
                placeholder="None" className="input-base" />
            </div>
            <div>
              <label className="text-xs text-ink-500 mb-1 block">Max selections</label>
              <input type="number" min={1} max={question.options.length} value={question.maxSelections ?? ''}
                onChange={e => dispatch({ type: 'UPDATE_ITEM', id: question.id, patch: { maxSelections: e.target.value ? parseInt(e.target.value) : null } })}
                placeholder="None" className="input-base" />
            </div>
          </div>
        </>
      )}

      </div>{/* end piping-dimmed wrapper */}

      <QuestionLogicPanel
        question={question}
        dispatch={dispatch}
        allItems={allItems.length ? allItems : contextItems}
        itemIndex={itemIndex}
        contextItems={ruleContextItems}
        beforeTermination={pipingEnabled && (
          <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-2.5 py-2 mb-2">
            Options are piped dynamically — rules below use the populated option list from the source question
            {sourceQ ? ` (Q${availableQuestions.indexOf(sourceQ) + 1})` : ''}.
          </p>
        )}
        branchHint="Jump respondents to a later page when their answer matches a rule. Otherwise they continue to the next page in order."
        redirectHint="Send respondents to an external site when their answer matches a rule. They leave the survey immediately — no further pages are shown."
      />

      <Divider label="Display" />
      <div className="flex items-center justify-between p-2.5 bg-ink-50 rounded-lg">
        <div>
          <p className="text-sm font-medium text-ink-700">Randomize options</p>
          <p className="text-xs text-ink-400">Anchored options stay fixed</p>
        </div>
        <Toggle checked={question.randomizeOptions} onChange={val => dispatch({ type: 'UPDATE_ITEM', id: question.id, patch: { randomizeOptions: val } })} />
      </div>
    </div>
  )
}

export default ChoiceEditor
