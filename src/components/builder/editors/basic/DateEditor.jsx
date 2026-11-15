import { Divider, SectionLabel } from '@/components/ui'
import { DateQ } from '@/components/taker/questions/basic/DateQ'
import { resolveDateFormat, SURVEY_DATE_FORMAT_OPTIONS } from '@/utils/format/dateSurveyFormat'
import { QuestionLogicPanel } from '../logic/QuestionLogicPanel'

export function DateEditor({ question, dispatch, surveyDateFormat, allItems = [], itemIndex = 0 }) {
  const cfg = question.dateConfig
  const inheritedDefault = resolveDateFormat('inherit', surveyDateFormat)

  const update = (patch) =>
    dispatch({ type: 'UPDATE_ITEM', id: question.id, patch: { dateConfig: { ...cfg, ...patch } } })

  return (
    <div className="space-y-4">
      {/* Format */}
      <div>
        <SectionLabel>Date Format</SectionLabel>

        {/* Inherit toggle */}
        <button
          onClick={() => update({ format: cfg.format === 'inherit' ? inheritedDefault : 'inherit' })}
          className={`w-full flex items-center justify-between p-2.5 rounded-lg border mb-2 transition-all ${
            cfg.format === 'inherit'
              ? 'border-brand-400 bg-brand-50'
              : 'border-ink-200 hover:border-ink-300'
          }`}
        >
          <div className="text-left">
            <p className="text-sm font-medium text-ink-700">Inherit survey default</p>
            <p className="text-xs text-ink-400">Currently: <span className="font-mono font-medium">{inheritedDefault}</span></p>
          </div>
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${cfg.format === 'inherit' ? 'border-brand-500 bg-brand-500' : 'border-ink-300'}`}>
            {cfg.format === 'inherit' && <div className="w-2 h-2 rounded-full bg-white" />}
          </div>
        </button>

        {/* Custom format */}
        <p className="text-xs text-ink-400 mb-2">— or choose a custom format for this question —</p>
        <div className="space-y-1.5">
          {SURVEY_DATE_FORMAT_OPTIONS.map(fmt => (
            <button
              key={fmt.value}
              onClick={() => update({ format: fmt.value })}
              className={`w-full flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                cfg.format === fmt.value
                  ? 'border-brand-400 bg-brand-50'
                  : 'border-ink-200 hover:border-ink-300'
              }`}
            >
              <div className="text-left">
                <span className="text-sm font-mono font-medium text-ink-700">{fmt.label}</span>
                <span className="text-xs text-ink-400 ml-2">{fmt.region}</span>
              </div>
              <span className="text-xs text-ink-500 font-mono">{fmt.example}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Date Range */}
      <Divider label="Date Constraints" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-ink-500 mb-1 block">Minimum date</label>
          <input
            type="date"
            value={cfg.minDate || ''}
            onChange={e => update({ minDate: e.target.value })}
            className="input-base"
          />
          {cfg.minDate && (
            <button onClick={() => update({ minDate: '' })} className="text-xs text-ink-400 hover:text-rose-500 mt-1">
              Clear
            </button>
          )}
        </div>
        <div>
          <label className="text-xs text-ink-500 mb-1 block">Maximum date</label>
          <input
            type="date"
            value={cfg.maxDate || ''}
            onChange={e => update({ maxDate: e.target.value })}
            className="input-base"
          />
          {cfg.maxDate && (
            <button onClick={() => update({ maxDate: '' })} className="text-xs text-ink-400 hover:text-rose-500 mt-1">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Preview */}
      <Divider label="Preview" />
      <div className="rounded-lg border border-dashed border-ink-200 p-3 bg-ink-50 space-y-2">
        <p className="text-xs text-ink-400">Respondent will see:</p>
        <DateQ
          question={question}
          value=""
          onChange={() => {}}
          surveyDateFormat={surveyDateFormat}
        />
        {(cfg.minDate || cfg.maxDate) && (
          <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
            {cfg.minDate && `From: ${cfg.minDate}`}{cfg.minDate && cfg.maxDate && ' · '}{cfg.maxDate && `To: ${cfg.maxDate}`}
          </p>
        )}
      </div>

      <QuestionLogicPanel
        question={question}
        dispatch={dispatch}
        allItems={allItems}
        itemIndex={itemIndex}
        tips={
          <>
            <Divider label="Logic tips" />
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 space-y-2">
              <p className="text-xs font-medium text-sky-900">Date of birth &amp; age screen-outs</p>
              <p className="text-xs text-sky-800">
                To terminate respondents <strong>under 18</strong>, add a screen-out rule with
                <strong> person is younger than → 18 years</strong>. Age is calculated from the date of birth
                at survey time — no manual cutoff date needed.
              </p>
              <p className="text-xs text-sky-700">
                Visibility rules and termination blocks on other questions also support full date comparisons
                (before/after, between, is answered, etc.) when referencing this date question.
              </p>
            </div>
          </>
        }
        terminationHint="Terminate based on the date the respondent selects. Rules are checked when they click Next."
        branchHint="Jump respondents to a later page when their date answer matches a rule."
        redirectHint="Send respondents to an external site when their date answer matches a rule (checked on Next)."
      />
    </div>
  )
}

export default DateEditor
