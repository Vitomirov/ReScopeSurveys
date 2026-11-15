import { useMemo } from 'react'
import { buildPipedOptions } from '@/utils/survey/questions/piping'
import { LazyComponent } from '@/components/shared/infra/LazyComponent'
import { QUESTION_LOADERS } from './questionLoaders'

const QUESTION_FALLBACK = <div className="h-8 animate-pulse bg-ink-100 rounded" />

function buildQuestionProps(questionType, question, opts, value, onChange, surveyDateFormat, companions, onCompanionChange) {
  const qWithOpts = { ...question, options: opts }

  if (questionType === 'single_select' || questionType === 'multi_select') {
    return { question: qWithOpts, value, onChange, companions, onCompanionChange }
  }
  if (questionType === 'dropdown') {
    return { question: qWithOpts, value, onChange }
  }
  if (questionType === 'date') {
    return { question, value, onChange, surveyDateFormat }
  }
  return { question, value, onChange }
}

/**
 * Renders the respondent-facing input for a survey question.
 * Central registry — add new question types in questionLoaders.js only.
 */
export function QuestionRenderer({
  question, value, onChange, surveyDateFormat, companions, onCompanionChange, responses = {}, items = [],
}) {
  const { questionType } = question
  const pipeCfg = question.pipedOptionsConfig
  const opts = useMemo(
    () => (pipeCfg?.enabled ? buildPipedOptions(question, responses, items) : question.options),
    [question, pipeCfg?.enabled, pipeCfg?.sourceQuestionId, responses, items]
  )

  const loader = QUESTION_LOADERS[questionType]
  if (!loader) {
    return <p className="text-sm text-ink-400 italic">Unknown question type.</p>
  }

  const props = buildQuestionProps(
    questionType, question, opts, value, onChange, surveyDateFormat, companions, onCompanionChange
  )

  return (
    <LazyComponent
      loader={loader}
      fallback={QUESTION_FALLBACK}
      {...props}
    />
  )
}
