import { useState, useRef, useEffect } from 'react'
import { useApi } from '@/config/api'
import { AppShell, APP_SHELL_GRID, APP_BUILDER_PANE } from '@/components/shared/layout/AppBuilderShell.jsx'
import { AppBackSlot } from '@/components/shared/layout/AppLeadingZone.jsx'
import { AppLogo } from '@/components/shared/branding/AppLogo.jsx'
import { DEFAULT_SURVEY_TITLE } from '@/constants/surveyDefaults'
import { SURVEY_STATUSES } from '@/utils/data/platformStore'
import { prefetchPreview } from '@/utils/routing/routePrefetch'
import {
  Eye, BarChart3, Download, PlayCircle, Menu, Save, ChevronDown, Upload,
} from 'lucide-react'

export function BuilderHeader({
  survey,
  dispatch,
  saveStatus,
  isDirty,
  onBackToDashboard,
  showMobileMenu,
  setShowMobileMenu,
  onExportCSVTemplate,
  onOpenExport,
  onOpenTest,
  onOpenPreview,
  onSave,
  onImportQuestions,
}) {
  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-ink-200/80 sticky top-0 z-30 safe-top">
      <AppShell>
        <div className={`${APP_SHELL_GRID} items-center min-h-[4.25rem] py-3`}>
          <AppBackSlot showBack onBack={onBackToDashboard} />

          <div className={`${APP_BUILDER_PANE} flex flex-wrap items-center gap-y-2 gap-x-2 sm:gap-3 min-w-0`}>
            <AppLogo
              onClick={onBackToDashboard}
              size="md"
              className="shrink-0"
            />
            <BuilderDocumentBar
              survey={survey}
              dispatch={dispatch}
              saveStatus={saveStatus}
              isDirty={isDirty}
            />

            <div className="ml-auto flex items-center gap-2 sm:gap-3 shrink-0">
              <DesktopActions
                onExportCSVTemplate={onExportCSVTemplate}
                onOpenExport={onOpenExport}
                onOpenTest={onOpenTest}
                onOpenPreview={onOpenPreview}
                onSave={onSave}
                onImportQuestions={onImportQuestions}
              />

              <MobileToolbar
                survey={survey}
                saveStatus={saveStatus}
                isDirty={isDirty}
                showMobileMenu={showMobileMenu}
                setShowMobileMenu={setShowMobileMenu}
                onExportCSVTemplate={onExportCSVTemplate}
                onOpenExport={onOpenExport}
                onOpenTest={onOpenTest}
                onOpenPreview={onOpenPreview}
                onSave={onSave}
              />
            </div>
          </div>
        </div>
      </AppShell>
    </header>
  )
}

/** Center zone — what you are editing (status, title, save state, code). */
function BuilderDocumentBar({ survey, dispatch, saveStatus, isDirty }) {
  const statusMeta = SURVEY_STATUSES.find(s => s.id === (survey.status || 'draft'))
    || SURVEY_STATUSES[0]

  return (
    <div className="flex-1 min-w-0 w-full sm:max-w-2xl">
      <div
        className="flex items-center gap-2 sm:gap-3 min-w-0 w-full rounded-xl border border-ink-200/90 bg-ink-50/70 px-2.5 sm:px-3 py-1.5 focus-within:border-brand-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100 transition-all"
        title="Survey you are editing"
      >
        <span
          className={`hidden sm:inline-flex text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border shrink-0 ${statusMeta.color}`}
        >
          {statusMeta.label}
        </span>
        {survey.importMeta?.importedAt && (
          <span className="hidden md:inline text-[10px] text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded shrink-0" title="Review imported content before publishing">
            Imported
          </span>
        )}
        {survey.status === 'pending_review' && (
          <span className="hidden lg:inline text-[10px] text-violet-800 max-w-[12rem] truncate" title="Set status to Draft or Live after review">
            Review required
          </span>
        )}

        <label className="sr-only" htmlFor="builder-header-title">Survey title</label>
        <input
          id="builder-header-title"
          type="text"
          value={survey.title}
          onChange={e => dispatch({ type: 'SET_SURVEY_FIELD', field: 'title', value: e.target.value })}
          className="flex-1 min-w-0 text-sm font-semibold text-ink-800 bg-transparent border-none outline-none placeholder:text-ink-400 placeholder:font-normal"
          placeholder={DEFAULT_SURVEY_TITLE}
        />

        <SaveStatus saveStatus={saveStatus} isDirty={isDirty} />

        {survey.surveyCode && (
          <span
            className="hidden md:inline text-[10px] font-mono font-semibold text-ink-500 bg-ink-100 px-1.5 py-0.5 rounded shrink-0"
            title="Survey code"
          >
            {survey.surveyCode}
          </span>
        )}
      </div>
    </div>
  )
}

function SaveStatus({ saveStatus, isDirty, className = '' }) {
  if (useApi && saveStatus === 'saving') {
    return (
      <span className={`text-[11px] text-ink-400 font-medium shrink-0 px-1.5 py-0.5 rounded-md bg-white/80 ${className}`}>
        Saving…
      </span>
    )
  }
  if (useApi && saveStatus === 'saved') {
    return (
      <span className={`text-[11px] text-emerald-700 font-medium shrink-0 px-1.5 py-0.5 rounded-md bg-emerald-50 ${className}`}>
        Saved
      </span>
    )
  }
  if (useApi && saveStatus === 'conflict') {
    return (
      <span className={`text-[11px] text-amber-700 font-medium shrink-0 px-1.5 py-0.5 rounded-md bg-amber-50 ${className}`}>
        Updated elsewhere
      </span>
    )
  }
  if (useApi && saveStatus === 'error') {
    return (
      <span className={`text-[11px] text-rose-600 font-medium shrink-0 px-1.5 py-0.5 rounded-md bg-rose-50 ${className}`}>
        Failed
      </span>
    )
  }
  if (!useApi && isDirty) {
    return (
      <span className={`text-[11px] text-amber-700 font-medium shrink-0 px-1.5 py-0.5 rounded-md bg-amber-50 ${className}`}>
        Unsaved
      </span>
    )
  }
  return null
}

const HEADER_ACTION_BASE = 'inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-2 rounded-lg transition-colors shrink-0'

function DesktopActions({
  onExportCSVTemplate,
  onOpenExport,
  onOpenTest,
  onOpenPreview,
  onSave,
  onImportQuestions,
}) {
  return (
    <div className="hidden sm:flex items-center gap-2">
      {onImportQuestions && (
        <button
          type="button"
          onClick={onImportQuestions}
          title="Import questions (append)"
          className={`${HEADER_ACTION_BASE} border border-ink-200 text-ink-600 hover:text-ink-900 hover:bg-ink-50`}
        >
          <Upload size={16} className="text-ink-400 shrink-0" />
          <span className="hidden md:inline">Import</span>
        </button>
      )}
      <button
        type="button"
        onClick={onOpenPreview}
        onMouseEnter={prefetchPreview}
        onFocus={prefetchPreview}
        title="Open respondent preview"
        className={`${HEADER_ACTION_BASE} border border-brand-200 bg-brand-50/70 text-brand-800 hover:bg-brand-50 hover:border-brand-300`}
      >
        <Eye size={16} className="text-brand-600 shrink-0" />
        <span className="hidden md:inline">Preview</span>
      </button>

      <button
        type="button"
        onClick={onOpenTest}
        title="Run test session"
        className={`${HEADER_ACTION_BASE} border border-ink-200 text-ink-600 hover:text-ink-900 hover:bg-ink-50`}
      >
        <PlayCircle size={16} className="text-ink-400 shrink-0" />
        <span className="hidden md:inline">Test</span>
      </button>

      <ExportMenu
        onExportCSVTemplate={onExportCSVTemplate}
        onOpenExport={onOpenExport}
      />

      <button
        type="button"
        onClick={onSave}
        className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 px-3 py-2 rounded-lg transition-colors shrink-0 shadow-sm shadow-brand-600/15"
      >
        <Save size={15} />
        <span className="hidden lg:inline">Save JSON</span>
      </button>
    </div>
  )
}

function ExportMenu({ onExportCSVTemplate, onOpenExport }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const closeAnd = (fn) => () => {
    setOpen(false)
    fn?.()
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Export options"
        className={`${HEADER_ACTION_BASE} border border-ink-200 text-ink-600 hover:text-ink-900 hover:bg-ink-50 ${
          open ? 'bg-ink-50 ring-2 ring-brand-100 border-brand-200' : ''
        }`}
      >
        <Download size={16} className="text-ink-400 shrink-0" />
        <span className="hidden md:inline">Export</span>
        <ChevronDown
          size={14}
          className={`text-ink-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-56 bg-white border border-ink-200 rounded-2xl shadow-xl shadow-ink-900/10 p-1.5"
        >
          <ExportMenuItem
            icon={Download}
            label="CSV template"
            description="Download column headers"
            onClick={closeAnd(onExportCSVTemplate)}
          />
          <ExportMenuItem
            icon={BarChart3}
            label="Export manager"
            description="Scheduled and history exports"
            onClick={closeAnd(onOpenExport)}
          />
        </div>
      )}
    </div>
  )
}

function ExportMenuItem({ icon: Icon, label, description, onClick }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left rounded-xl hover:bg-ink-50 transition-colors"
    >
      <Icon size={15} className="text-ink-400 shrink-0 mt-0.5" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink-800">{label}</span>
        <span className="block text-xs text-ink-400 mt-0.5">{description}</span>
      </span>
    </button>
  )
}

function MobileToolbar({
  survey,
  saveStatus,
  isDirty,
  showMobileMenu,
  setShowMobileMenu,
  onExportCSVTemplate,
  onOpenExport,
  onOpenTest,
  onOpenPreview,
  onSave,
}) {
  const closeMenu = () => setShowMobileMenu(false)

  return (
    <div className="flex sm:hidden items-center gap-1 shrink-0">
      <button
        type="button"
        onClick={onOpenPreview}
        onMouseEnter={prefetchPreview}
        onFocus={prefetchPreview}
        className="inline-flex items-center justify-center p-2.5 text-ink-600 hover:text-ink-900 hover:bg-ink-50 rounded-lg transition-colors"
        title="Preview"
      >
        <Eye size={16} />
      </button>
      <button
        type="button"
        onClick={onSave}
        className="inline-flex items-center justify-center p-2.5 text-brand-600 hover:text-brand-700 hover:bg-brand-50 rounded-lg transition-colors"
        title="Save JSON"
      >
        <Save size={16} />
      </button>
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowMobileMenu(m => !m)}
          className="inline-flex items-center justify-center p-2.5 text-ink-600 hover:text-ink-900 hover:bg-ink-50 rounded-lg transition-colors"
          title="More actions"
        >
          <Menu size={16} />
        </button>
        {showMobileMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={closeMenu} />
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 bg-white border border-ink-200 rounded-2xl shadow-xl shadow-ink-900/10 p-2 w-52">
              <p className="px-3 py-1.5 text-xs font-semibold text-ink-400 truncate border-b border-ink-100 mb-1">
                {survey.title || DEFAULT_SURVEY_TITLE}
              </p>
              <SaveStatus saveStatus={saveStatus} isDirty={isDirty} className="mx-3 mb-2" />
              <MobileMenuItem icon={PlayCircle} label="Test runner" onClick={() => { onOpenTest(); closeMenu() }} />
              <MobileMenuItem icon={Download} label="CSV template" onClick={() => { onExportCSVTemplate(); closeMenu() }} />
              <MobileMenuItem icon={BarChart3} label="Export manager" onClick={() => { onOpenExport(); closeMenu() }} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function MobileMenuItem({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-ink-700 hover:bg-ink-50 rounded-lg transition-colors text-left"
    >
      <Icon size={15} className="text-ink-400 shrink-0" />
      {label}
    </button>
  )
}
