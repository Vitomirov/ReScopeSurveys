import { useState, memo, useRef, useEffect } from 'react'
import React from 'react'
import {
  ChevronDown, ChevronRight, Copy, Trash2, GripVertical,
} from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Toggle, IconBtn } from '@/components/ui'
import { QuestionTypeEditor } from '@/components/builder/editors'
import { VisibilityEditor } from '@/components/shared'
import { makeToken } from '@/utils/survey/questions/piping'
import { getTypeMeta, TYPE_COLORS, TYPE_ICONS, isChoiceType, isMatrixType, QUESTION_TYPES } from '@/utils/survey/questions/questionHelpers'
import { makeOption } from '@/store/surveyStore'
import { DEFAULT_DATE_FORMAT } from '@/constants/surveyDefaults'

// ─── Token Picker — insert piping reference into question text ─────────────
function TokenPicker({ availableQuestions, onInsert }) {
  const [open, setOpen] = useState(false)
  const [expandedMatrix, setExpandedMatrix] = useState(null)
  const ref = React.useRef(null)

  React.useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Insert answer from a previous question"
        className={`text-xs font-semibold px-2 py-1 rounded-lg border transition-all flex items-center gap-1 ${
          open ? 'bg-brand-600 text-white border-brand-600' : 'border-ink-200 text-ink-500 hover:border-brand-400 hover:text-brand-600'
        }`}
      >
        ⟨Q⟩ Pipe answer
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 sm:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 sm:absolute sm:inset-auto sm:right-0 sm:left-auto sm:top-8 sm:w-72 bg-white border border-ink-200 rounded-t-2xl sm:rounded-xl shadow-2xl sm:shadow-xl py-1.5 max-h-[min(70vh,14rem)] sm:max-h-56 overflow-y-auto safe-bottom">
            <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider px-3 pb-1.5 pt-2 sm:pt-0.5">
              Insert answer from…
            </p>
            {availableQuestions.map((q, idx) => (
            <div key={q.id}>
              {isMatrixType(q.questionType) ? (
                <>
                  <button
                    onClick={() => setExpandedMatrix(expandedMatrix === q.id ? null : q.id)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-brand-50 hover:text-brand-700 transition-all flex items-center justify-between"
                  >
                    <span>
                      <span className="font-semibold text-brand-600 mr-1.5">Q{idx + 1}</span>
                      <span className="text-ink-600 truncate">{q.text || '(untitled)'}</span>
                    </span>
                    <ChevronDown size={12} className={`shrink-0 transition-transform ${expandedMatrix === q.id ? 'rotate-180' : ''}`} />
                  </button>
                  {expandedMatrix === q.id && (
                    <div className="pl-4 pb-1">
                      <button
                        onClick={() => { onInsert(makeToken(q.id)); setOpen(false) }}
                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-brand-50 text-ink-600"
                      >
                        Entire matrix
                      </button>
                      {(q.matrixConfig?.rows || []).map(row => (
                        <button
                          key={row.id}
                          onClick={() => { onInsert(makeToken(q.id, row.id)); setOpen(false) }}
                          className="w-full text-left px-3 py-1.5 text-xs hover:bg-brand-50 text-ink-600"
                        >
                          Row: {row.text || '(untitled)'}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <button
                  onClick={() => { onInsert(makeToken(q.id)); setOpen(false) }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-brand-50 hover:text-brand-700 transition-all"
                >
                  <span className="font-semibold text-brand-600 mr-1.5">Q{idx + 1}</span>
                  <span className="text-ink-600 truncate">{q.text || '(untitled)'}</span>
                </button>
              )}
            </div>
          ))}
          </div>
        </>
      )}
    </div>
  )
}

export const QuestionCard = memo(function QuestionCard({
  question, questionNumber, isActive, dispatch, onActivateItem, focusOptionId,
  surveyDateFormat, availableQuestions = [], contextItems = [], itemIndex = 0,
}) {
  const [showTypeMenu, setShowTypeMenu] = useState(false)
  const typeMenuRef = React.useRef(null)
  const textRef = useRef(null)
  const meta   = getTypeMeta(question.questionType)
  const colors = TYPE_COLORS[question.questionType] || TYPE_COLORS.single_select
  const TypeIcon = TYPE_ICONS[question.questionType] || TYPE_ICONS.single_select

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  React.useEffect(() => {
    if (!showTypeMenu) return
    const close = (e) => {
      if (typeMenuRef.current && !typeMenuRef.current.contains(e.target)) {
        setShowTypeMenu(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [showTypeMenu])

  useEffect(() => {
    if (isActive) textRef.current?.focus({ preventScroll: true })
  }, [isActive])

  const handleTypeChange = (newType) => {
    setShowTypeMenu(false)
    if (newType === question.questionType) return
    const wasChoice  = isChoiceType(question.questionType)
    const willChoice = isChoiceType(newType)
    const patch = { questionType: newType }

    if (!willChoice && wasChoice) {
      patch.options = []
    } else if (willChoice && !wasChoice) {
      patch.options = [makeOption()]
    }
    dispatch({ type: 'UPDATE_ITEM', id: question.id, patch })
  }

  // Collapsed summary stats
  const optionCount    = question.options?.length ?? 0
  const anchorCount    = question.options?.filter(o => o.anchorPosition).length ?? 0
  const exclusiveSet   = question.options?.some(o => o.isExclusive) ?? false
  const openTextSet    = question.options?.some(o => o.openText?.enabled) ?? false
  const matrixRows     = question.matrixConfig?.rows?.length ?? question.bipolarConfig?.rows?.length ?? 0
  const matrixCols     = question.matrixConfig?.columns?.length ?? 0

  return (
    <div ref={setNodeRef} style={style} className={`question-enter ${isDragging ? 'opacity-40' : ''}`}>
      <div className={`card transition-all duration-150 shadow-sm ${isActive ? 'border-brand-400 shadow-md shadow-brand-100/80' : 'hover:border-ink-300 hover:shadow-md hover:shadow-ink-900/[0.04]'}`}>

        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 cursor-pointer" onClick={() => onActivateItem(question.id)}>

          {/* Drag handle */}
          <div {...attributes} {...listeners} className="drag-handle mt-0.5 text-ink-400 hover:text-ink-600 hover:bg-ink-100 rounded p-0.5 -ml-0.5 transition-colors shrink-0" onClick={e => e.stopPropagation()}>
            <GripVertical size={16} />
          </div>

          {/* Number */}
          <span className={`shrink-0 mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold ${colors.bg} ${colors.text}`}>
            {questionNumber}
          </span>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                {/* Type badge */}
                <div
                  ref={typeMenuRef}
                  className="relative shrink-0"
                  onClick={e => { e.stopPropagation(); setShowTypeMenu(v => !v) }}
                >
                  <button
                    type="button"
                    className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md min-h-[28px] ${colors.bg} ${colors.text} hover:opacity-80`}
                  >
                    <TypeIcon size={11} />
                    {meta.shortLabel}
                    <ChevronDown size={9} />
                  </button>

                  {showTypeMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-40 bg-black/30 sm:hidden"
                        onClick={(e) => { e.stopPropagation(); setShowTypeMenu(false) }}
                      />
                      <div
                        className="fixed inset-x-0 bottom-0 z-50 sm:absolute sm:inset-auto sm:left-0 sm:top-full sm:mt-1 sm:w-56 bg-white border border-ink-200 rounded-t-2xl sm:rounded-xl shadow-2xl sm:shadow-lg p-2 max-h-[min(70vh,20rem)] overflow-y-auto safe-bottom"
                        onClick={e => e.stopPropagation()}
                      >
                        <p className="sm:hidden text-xs font-semibold text-ink-400 uppercase tracking-wider px-2 py-2 border-b border-ink-100 mb-1">
                          Question type
                        </p>
                        {QUESTION_TYPES.map(qt => {
                          const Icon = TYPE_ICONS[qt.type]
                          const c    = TYPE_COLORS[qt.type]
                          return (
                            <button
                              key={qt.type}
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleTypeChange(qt.type) }}
                              className={`w-full flex items-center gap-2 px-3 py-2.5 sm:py-2 rounded-lg text-sm hover:bg-ink-50 transition-colors min-h-[44px] sm:min-h-0 ${question.questionType === qt.type ? 'font-semibold' : ''}`}
                            >
                              <span className={`p-1 rounded ${c.bg} ${c.text}`}><Icon size={12} /></span>
                              <span className="text-left">{qt.label}</span>
                              {question.questionType === qt.type && <span className="ml-auto text-brand-500 text-xs">✓</span>}
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* Required */}
                {question.required
                  ? <span className="text-xs text-rose-500 font-medium">Required</span>
                  : <span className="text-xs text-ink-400">Optional</span>
                }

                {/* Badges */}
                {anchorCount > 0 && <span className="text-xs text-brand-500 bg-brand-50 px-1.5 py-0.5 rounded">⚓ {anchorCount}</span>}
                {exclusiveSet    && <span className="text-xs text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">⊘</span>}
                {openTextSet     && <span className="text-xs text-brand-500 bg-brand-50 px-1.5 py-0.5 rounded">💬</span>}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-0.5 sm:gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                <IconBtn icon={Copy} onClick={() => dispatch({ type: 'DUPLICATE_ITEM', id: question.id })} title="Duplicate" />
                <IconBtn icon={Trash2} onClick={() => dispatch({ type: 'DELETE_ITEM', id: question.id })} variant="danger" title="Delete" />
                <div className="hidden sm:block w-px h-4 bg-ink-100 mx-0.5" />
                <div className={`transition-transform duration-150 ${isActive ? 'rotate-90' : ''}`}>
                  <ChevronRight size={16} className="text-ink-400" />
                </div>
              </div>
            </div>

            <p className={`text-sm leading-snug break-words ${question.text ? 'text-ink-800' : 'text-ink-400 italic'}`}>
              {question.text || 'Untitled question — click to edit'}
            </p>

            {!isActive && (
              <p className="text-xs text-ink-400 mt-0.5">
                {isChoiceType(question.questionType) && `${optionCount} option${optionCount !== 1 ? 's' : ''}`}
                {(question.questionType === 'matrix' || question.questionType === 'bipolar_matrix') && `${matrixRows} rows`}
                {question.questionType === 'date' && (question.dateConfig?.format || surveyDateFormat || DEFAULT_DATE_FORMAT)}
                {question.questionType === 'open_text' && question.openTextConfig?.validation?.type !== 'none' && (
                  `Validation: ${question.openTextConfig.validation.type}`
                )}
              </p>
            )}
          </div>
        </div>

        {/* ── Expanded editor ───────────────────────────────────────── */}
        {isActive && (
          <div className="border-t border-ink-100 px-3 sm:px-4 pt-4 pb-5 space-y-4">
            {/* Question text + piping token picker */}
            <div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-1.5">
                <label className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Question Text</label>
                {availableQuestions.length > 0 && (
                  <TokenPicker
                    availableQuestions={availableQuestions}
                    onInsert={(token) => {
                      const el = document.activeElement
                      const current = question.text || ''
                      if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') && el.dataset.qid === question.id) {
                        const start = el.selectionStart ?? current.length
                        const end   = el.selectionEnd   ?? current.length
                        const next  = current.slice(0, start) + token + current.slice(end)
                        dispatch({ type: 'UPDATE_ITEM', id: question.id, patch: { text: next } })
                        setTimeout(() => { el.selectionStart = el.selectionEnd = start + token.length }, 0)
                      } else {
                        dispatch({ type: 'UPDATE_ITEM', id: question.id, patch: { text: current + token } })
                      }
                    }}
                  />
                )}
              </div>
              <textarea
                ref={textRef}
                rows={2}
                data-qid={question.id}
                value={question.text}
                onChange={e => dispatch({ type: 'UPDATE_ITEM', id: question.id, patch: { text: e.target.value } })}
                placeholder="Type your question... use the {Q} button to insert a piped answer"
                className="input-base resize-none"
              />
              {question.text?.includes('{{qid:') && (
                <p className="text-xs text-brand-600 mt-1 flex items-center gap-1">
                  ⟨Q⟩ Contains piping tokens — will be replaced with live answers in preview
                </p>
              )}
            </div>

            {/* Required toggle */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 bg-ink-50 rounded-lg">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-700">Required</p>
                <p className="text-xs text-ink-400">Respondent must answer before continuing</p>
              </div>
              <Toggle
                checked={question.required}
                onChange={val => dispatch({ type: 'UPDATE_ITEM', id: question.id, patch: { required: val } })}
              />
            </div>

            <QuestionTypeEditor
              question={question}
              dispatch={dispatch}
              focusOptionId={focusOptionId}
              availableQuestions={availableQuestions}
              contextItems={contextItems}
              surveyDateFormat={surveyDateFormat}
              allItems={contextItems}
              itemIndex={itemIndex}
            />

            {/* Email capture field — for DNC matching */}
            {question.questionType === 'open_text' && (
              <div className="mt-2 mb-2">
                <label className="flex items-start gap-3 p-2.5 bg-ink-50 rounded-lg cursor-pointer hover:bg-ink-100 transition-all">
                  <div
                    onClick={() => dispatch({
                      type: 'SET_EMAIL_FIELD',
                      id: question.isEmailField ? null : question.id,
                    })}
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                      question.isEmailField
                        ? 'border-rose-500 bg-rose-500'
                        : 'border-ink-300 hover:border-rose-400'
                    }`}
                  >
                    {question.isEmailField && (
                      <svg viewBox="0 0 10 10" fill="none" className="w-2.5 h-2.5">
                        <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink-700">📧 Email capture field</p>
                    <p className="text-xs text-ink-400">Responses matching the survey's DNC list will be flagged automatically. Only one question per survey can be marked.</p>
                  </div>
                </label>
              </div>
            )}

            {/* Conditional visibility */}
            <div className="mt-4 pt-4 border-t border-ink-100">
              <VisibilityEditor
                itemId={question.id}
                vis={question.visibility}
                availableQuestions={availableQuestions}
                contextItems={contextItems}
                dispatch={dispatch}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
})
