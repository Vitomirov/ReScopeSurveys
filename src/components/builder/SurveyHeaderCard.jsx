import { useState, useRef } from 'react'
import { Settings2 } from 'lucide-react'
import { RichTextEditor, NavigationLockEditor } from '@/components/shared'
import {
  CoverPageSettings, BrandingSettings, ProgressBarSettings, BackButtonSettings,
  FingerprintSettings, DNCManager, SurveyMetadata,
} from '@/components/builder'
import { DEFAULT_SCREEN_MESSAGES } from '@/constants/surveyDefaults'

export function SurveyHeaderCard({ survey, dispatch, hasItems = false }) {
  const prevHasItemsRef = useRef(hasItems)
  const [settingsOpen, setSettingsOpen] = useState(!hasItems)

  // Close settings in the same render when the first item is added so layout is
  // stable before the new-question scroll runs (avoids landing at the card bottom).
  if (hasItems && !prevHasItemsRef.current && settingsOpen) {
    setSettingsOpen(false)
  }
  prevHasItemsRef.current = hasItems

  const showDescription = !hasItems || settingsOpen

  return (
    <div className="card p-3 sm:p-4 mb-4 sm:mb-5 shadow-md shadow-ink-900/[0.05]">
      <input
        type="text"
        value={survey.title}
        onChange={e => dispatch({ type: 'SET_SURVEY_FIELD', field: 'title', value: e.target.value })}
        placeholder="Survey Title"
        className="w-full text-lg sm:text-xl font-bold text-ink-900 bg-transparent border-none outline-none focus:bg-ink-50 px-2 py-1 rounded-lg -ml-2 mb-1 transition-colors"
      />

      {showDescription && (
        <div className="mb-1">
          <RichTextEditor
            value={survey.description}
            onChange={html => dispatch({ type: 'SET_SURVEY_FIELD', field: 'description', value: html })}
            placeholder="Survey description (optional)... use the toolbar to format it"
          />
        </div>
      )}

      {settingsOpen ? (
        <div className="mt-3 border-t border-ink-100 pt-3">
          <button
            type="button"
            onClick={() => setSettingsOpen(false)}
            className="text-xs font-semibold text-ink-500 uppercase tracking-wider hover:text-ink-800 flex items-center gap-1.5 transition-colors mb-3"
          >
            <Settings2 size={12} /> Survey settings
          </button>
          <BrandingSettings survey={survey} dispatch={dispatch} />
          <SurveyMetadata survey={survey} dispatch={dispatch} />
          <CoverPageSettings survey={survey} dispatch={dispatch} />
          <ProgressBarSettings survey={survey} dispatch={dispatch} />
          <BackButtonSettings survey={survey} dispatch={dispatch} />

          <div className="mt-3 border-t border-ink-100 pt-3">
            <NavigationLockEditor
              lock={survey.settings?.navigationLockAllPages}
              onChange={navigationLock => dispatch({
                type: 'SET_SURVEY_SETTING',
                key: 'navigationLockAllPages',
                value: navigationLock,
              })}
              pageLabel="All pages"
              allPages
              compact
            />
          </div>

          <ScreenOutMessages survey={survey} dispatch={dispatch} />

          <FingerprintSettings survey={survey} dispatch={dispatch} />
          <DNCManager surveyId={survey.id} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="mt-3 pt-3 border-t border-ink-100 text-xs font-semibold text-ink-500 uppercase tracking-wider hover:text-ink-800 flex items-center gap-1.5 transition-colors"
        >
          <Settings2 size={12} /> Survey settings
        </button>
      )}
    </div>
  )
}

function ScreenOutMessages({ survey, dispatch }) {
  return (
    <details className="mt-3 border-t border-ink-100 pt-3">
      <summary className="text-xs font-semibold text-ink-500 uppercase tracking-wider cursor-pointer hover:text-ink-800 select-none flex items-center gap-1.5 transition-colors">
        <span>⚙</span> Screen-out &amp; closed survey messages
      </summary>
      <div className="mt-3 space-y-4">
        <MessageSection
          title="Screen-out page"
          titleField="terminateTitle"
          messageField="terminateMessage"
          titlePlaceholder={DEFAULT_SCREEN_MESSAGES.terminateTitle}
          messagePlaceholder={DEFAULT_SCREEN_MESSAGES.terminateMessage}
          survey={survey}
          dispatch={dispatch}
        />
        <div className="space-y-2 border-t border-ink-100 pt-3">
          <p className="text-xs font-semibold text-ink-500">Closed survey page</p>
          <p className="text-xs text-ink-400">Shown when status is set to Closed and someone visits the survey URL.</p>
          <MessageFields
            titleField="closedTitle"
            messageField="closedMessage"
            titlePlaceholder={DEFAULT_SCREEN_MESSAGES.closedTitle}
            messagePlaceholder={DEFAULT_SCREEN_MESSAGES.closedMessage}
            survey={survey}
            dispatch={dispatch}
          />
        </div>
      </div>
    </details>
  )
}

function MessageSection({ title, survey, dispatch, ...fieldProps }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-ink-500">{title}</p>
      <MessageFields survey={survey} dispatch={dispatch} {...fieldProps} />
    </div>
  )
}

function MessageFields({
  titleField,
  messageField,
  titlePlaceholder,
  messagePlaceholder,
  survey,
  dispatch,
}) {
  return (
    <>
      <div>
        <label className="text-xs text-ink-500 mb-1 block">Title</label>
        <input
          type="text"
          value={survey.settings?.[titleField] || ''}
          onChange={e => dispatch({ type: 'SET_SURVEY_SETTING', key: titleField, value: e.target.value })}
          placeholder={titlePlaceholder}
          className="input-base text-sm"
        />
      </div>
      <div>
        <label className="text-xs text-ink-500 mb-1 block">Message</label>
        <textarea
          rows={2}
          value={survey.settings?.[messageField] || ''}
          onChange={e => dispatch({ type: 'SET_SURVEY_SETTING', key: messageField, value: e.target.value })}
          placeholder={messagePlaceholder}
          className="input-base text-sm resize-none"
        />
      </div>
    </>
  )
}
