import { Toggle } from '@/components/ui'

export function BackButtonSettings({ survey, dispatch }) {
  const disabled = survey.settings?.disableBackButton === true

  return (
    <div className="mt-3 border-t border-ink-100 pt-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Back button</p>
          <p className="text-xs text-ink-400 mt-0.5">
            Turn off so respondents cannot return to a previous page and change an answer.
          </p>
        </div>
        <Toggle
          size="sm"
          checked={disabled}
          onChange={val => dispatch({ type: 'SET_SURVEY_SETTING', key: 'disableBackButton', value: val })}
          label={disabled ? 'Disabled' : 'Allowed'}
        />
      </div>
    </div>
  )
}

export default BackButtonSettings
