import { useState, useMemo, useEffect, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, Check, Fingerprint } from 'lucide-react'
import { buildVisiblePages } from '@/utils/survey/engines/visibilityEngine'
import { resolvePipingTokens } from '@/utils/survey/questions/piping'
import { generateCSV, downloadCSV } from '@/utils/csvExport'
import { saveResponse, newResponseId } from '@/utils/data/responseStore'
import {
  clearPendingResponse,
  isRetryableStatus,
  readPendingResponse,
  retryDelayMs,
  wait,
  writePendingResponse,
} from '@/utils/data/pendingResponse'
import { SAVE_REJECTED, SAVING_RESPONSE, SURVEY_BUSY_SAVE } from '@/constants/errors'
import { useApi } from '@/config/api'
import { saveResponseApi, savePublicResponse } from '@/api/survey/responses'
import { collectFingerprint } from '@/utils/format/deviceSignals'
import { DEFAULT_DATE_FORMAT } from '@/constants/surveyDefaults'
import { isOnDNCListAsync, loadDNCListAsync } from '@/utils/data/dncStore'
import { checkTermination, evalBlock, buildBlockCause } from '@/utils/survey/engines/terminationEngine'
import { resolveBranchTargetPage } from '@/utils/survey/engines/branchEngine'
import { computeBranchAwareProgress, isLastPageOnPath } from '@/utils/survey/engines/progressEngine'
import { resolvePageExternalRedirect, openExternalRedirect } from '@/utils/survey/engines/externalRedirectEngine'
import { validateAnswer } from '@/utils/survey/engines/answerValidation'
import { buildQuestionNumberById } from '@/utils/survey/questions/questionHelpers'
import { prefetchModule, prefetchCommonQuestions } from '@/utils/routing/routePrefetch'
import { usePageNavigationLock } from '@/hooks/usePageNavigationLock'
import { useEmbedMessaging } from '@/hooks/useEmbedMessaging'
import { brandThemeToCssVars, ensureBrandFontLoaded } from '@shared/brandTheme.js'
import { sanitizeHtml } from '@/utils/sanitizeHtml'
import { APP_NAME } from '@/constants/branding'
import { QUESTION_LOADERS } from './questions/questionLoaders'
import { QuestionRenderer } from './questions'
import { CoverPage, CompletionScreen, TerminationScreen, ClosedSurveyScreen, ExternalRedirectScreen } from './screens'

export function SurveyPreview({ survey, items, onClose, isPublic = false, isEmbed = false, branding = null }) {
  const [responses, setResponses]       = useState({})
  const [companions, setCompanions]     = useState({})  // { questionId: { optionId: text } }
  const [errors, setErrors]             = useState({})
  const [currentPage, setCurrentPage]   = useState(0)
  const [submitted, setSubmitted]       = useState(false)
  const [terminated, setTerminated]     = useState(false)
  const [terminatedBy, setTerminatedBy] = useState(null)
  const [redirectedTo, setRedirectedTo] = useState(null)
  const [holding, setHolding]           = useState(null) // 'saving' | 'busy' | 'rejected' | null
  const [showCover, setShowCover]       = useState(survey?.showCoverPage !== false)
  const [lockVisitKey, setLockVisitKey] = useState(0)
  const bumpLockVisit = () => setLockVisitKey(k => k + 1)
  const [fingerprint, setFingerprint]   = useState(null)
  const [fpStatus, setFpStatus]         = useState('idle') // 'idle' | 'collecting' | 'done'
  const responseIdRef = useRef(null)
  const saveGen = useRef(0)
  const saveLock = useRef(false)

  // ── Collect device/browser fingerprint once, on mount ──────────────────
  // Runs in the background regardless of cover page state, so by the time
  // the respondent reaches the end the data is already ready to attach.
  const themeVars = brandThemeToCssVars(branding?.theme)
  const buttonVariant = branding?.theme?.buttonVariant || 'solid'
  const brandFontKey = branding?.theme?.fontKey

  useEffect(() => {
    if (brandFontKey) ensureBrandFontLoaded(brandFontKey)
  }, [brandFontKey])
  const displayLogo = survey?.companyLogo || branding?.logo || null
  const showPoweredByFooter = branding?.mustShowPlatformBranding === true
    || (isPublic && branding?.hidePlatformBranding !== true && branding?.canHidePlatformBranding !== true)
    || (isPublic && !branding)
  const { rootRef, postCompleted, postTerminated } = useEmbedMessaging({
    enabled: isEmbed && isPublic,
    surveyId: survey?.id,
    allowedOrigins: branding?.embedAllowedOrigins || [],
  })
  const fpEnabled = survey?.settings?.fingerprinting?.enabled
  const fpSignals = survey?.settings?.fingerprinting?.signals
  useEffect(() => {
    if (!fpEnabled) return
    let cancelled = false
    setFpStatus('collecting')
    collectFingerprint(fpSignals).then(fp => {
      if (!cancelled) { setFingerprint(fp); setFpStatus('done') }
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fpEnabled])

  useEffect(() => {
    if (!survey?.id || !useApi || isPublic) return
    loadDNCListAsync(survey.id)
      .catch(err => console.error('Failed to load DNC list', err))
  }, [survey?.id, isPublic])

  useEffect(() => {
    prefetchCommonQuestions()
    const types = new Set(
      (items || []).filter(i => i.itemType === 'question').map(i => i.questionType)
    )
    for (const type of types) {
      const loader = QUESTION_LOADERS[type]
      if (loader) prefetchModule(loader)
    }
  }, [items])

  // Build pages + capture termination blocks, fully respecting conditional
  // show/hide logic on questions, page breaks, and groups. Must recompute
  // whenever `responses` changes, since visibility can depend on earlier answers.
  const { pages, blocksByPage, navigationLockByPage, pageTitlesByPage } = useMemo(
    () => buildVisiblePages(items, responses, survey?.settings),
    [items, responses, survey?.settings]
  )

  const questionNumberById = useMemo(
    () => buildQuestionNumberById(items),
    [items]
  )

  const currentItems     = pages[currentPage] || []
  const currentQuestions = currentItems.filter(i => i.itemType === 'question')
  const currentPageLockSeconds = navigationLockByPage[currentPage] || 0
  const isSurveyContentActive = !showCover && !submitted && !terminated && !redirectedTo && !holding
    && !(isPublic && survey?.status === 'closed')
  const { isLocked: isNavigationLocked, remainingSeconds } = usePageNavigationLock(
    currentPageLockSeconds,
    `${currentPage}-${lockVisitKey}`,
    isSurveyContentActive,
  )

  const currentPageBreakTitle = useMemo(() => {
    const raw = pageTitlesByPage[currentPage]
    if (!raw) return null
    return resolvePipingTokens(raw, responses, items)
  }, [pageTitlesByPage, currentPage, responses, items])

  // Resolve piped text once per visible page item when responses change
  const pipedDisplayByItemId = useMemo(() => {
    const map = {}
    for (const item of currentItems) {
      if (item.itemType === 'text_block') {
        map[item.id] = {
          title: item.title ? resolvePipingTokens(item.title, responses, items) : '',
          content: item.content ? resolvePipingTokens(item.content, responses, items) : '',
        }
      } else if (item.itemType === 'question') {
        map[item.id] = {
          text: resolvePipingTokens(item.text, responses, items),
        }
      }
    }
    return map
  }, [currentItems, responses, items])

  const reset = () => {
    saveGen.current += 1
    saveLock.current = false
    if (survey?.id) clearPendingResponse(survey.id)
    setResponses({}); setCompanions({}); setErrors({}); setCurrentPage(0)
    setSubmitted(false); setTerminated(false); setTerminatedBy(null); setRedirectedTo(null)
    setHolding(null)
    setShowCover(survey?.showCoverPage !== false)
    bumpLockVisit()
    responseIdRef.current = null
    if (fpEnabled) {
      setFpStatus('collecting')
      collectFingerprint(fpSignals).then(fp => { setFingerprint(fp); setFpStatus('done') })
    }
  }

  const handleCompanionChange = (questionId, optionId, text) => {
    setCompanions(c => ({
      ...c,
      [questionId]: { ...(c[questionId] || {}), [optionId]: text },
    }))
  }

  // ── Build a response entry from current state ─────────────────────────
  const buildEntry = (status, terminatedByArg = null) => {
    if (!responseIdRef.current) responseIdRef.current = newResponseId()
    return {
      id:          responseIdRef.current,
      timestamp:   new Date().toISOString(),
      status,
      pageReached: currentPage,
      responses,
      companions,
      terminatedBy: terminatedByArg,
      fingerprint: fpEnabled ? (fingerprint || {}) : null,
    }
  }

  const reveal = (record) => {
    if (record.outcome === 'terminated') {
      setTerminatedBy(record.terminatedBy || null)
      setTerminated(true)
      return
    }
    if (record.outcome === 'redirect') {
      if (record.redirectUrl) openExternalRedirect(record.redirectUrl)
      setRedirectedTo(record.redirectUrl || null)
      return
    }
    setSubmitted(true)
  }

  // A 2xx response is a confirmed handoff: 200 is stored, 202 is accepted into the inbox.
  const commitRecord = async (record) => {
    const gen = ++saveGen.current
    setHolding('saving')
    if (useApi && survey?.id) writePendingResponse(survey.id, record)
    let attempt = 0
    while (saveGen.current === gen) {
      try {
        if (survey?.id) {
          if (useApi) {
            const save = isPublic ? savePublicResponse : saveResponseApi
            await save(survey.id, record.entry)
          } else {
            saveResponse(survey.id, record.entry)
          }
        }
        if (saveGen.current !== gen) return
        if (useApi && survey?.id) clearPendingResponse(survey.id)
        setHolding(null)
        reveal(record)
        return
      } catch (err) {
        if (saveGen.current !== gen) return
        console.error('Failed to save response', err)
        if (!isRetryableStatus(err?.status)) {
          setHolding('rejected')
          return
        }
        attempt += 1
        setHolding('busy')
        await wait(retryDelayMs({ retryAfterSeconds: err?.retryAfter, attempt }))
      }
    }
  }

  const startSave = (outcome, terminatedByArg = null, redirectUrl = null, responseSnapshot = null) => {
    if (saveLock.current) return
    saveLock.current = true
    setHolding('saving')
    void (async () => {
      let finalStatus = outcome === 'terminated' ? 'terminated' : outcome === 'redirect' ? 'partial' : 'complete'
      if (finalStatus === 'complete' && survey?.id) {
        const emailQ = items.find(i => i.itemType === 'question' && i.isEmailField)
        if (emailQ) {
          const emailAnswer = responses[emailQ.id] || ''
          try {
            if (await isOnDNCListAsync(survey.id, emailAnswer, { publicMode: isPublic })) {
              finalStatus = 'dnc'
            }
          } catch (err) {
            if (!isRetryableStatus(err?.status)) throw err
          }
        }
      }
      const entry = outcome === 'redirect'
        ? { ...buildEntry('partial'), responses: responseSnapshot ?? responses, redirectedTo: redirectUrl }
        : buildEntry(finalStatus, terminatedByArg)
      await commitRecord({
        entry,
        outcome,
        terminatedBy: terminatedByArg,
        redirectUrl,
      })
    })().catch(err => {
      console.error('Failed to save response', err)
      saveLock.current = false
      setHolding('rejected')
    })
  }

  const downloadCurrent = (status, terminatedByArg, nameSuffix) => {
    const entry = buildEntry(status, terminatedByArg)
    if (redirectedTo) entry.redirectedTo = redirectedTo
    const csv = generateCSV(items, [entry], survey)
    downloadCSV(csv, `${(survey?.title || 'survey').replace(/\s+/g, '_')}_${nameSuffix}.csv`)
  }

  const handleChange = (question, val) => {
    setResponses(r => ({ ...r, [question.id]: val }))
    if (errors[question.id]) setErrors(e => ({ ...e, [question.id]: null }))
  }

  const validatePage = () => {
    const pageErrors = {}
    for (const q of currentQuestions) {
      const err = validateAnswer(q, responses[q.id])
      if (err) pageErrors[q.id] = err
    }
    setErrors(pageErrors)
    return Object.keys(pageErrors).length === 0
  }

  // All termination checked on Next: per-question rules + termination blocks
  const checkPageTermination = () => {
    // 1. Per-question termination rules
    for (const q of currentQuestions) {
      const result = checkTermination(q, responses[q.id], responses, items)
      if (result.terminated) {
        const tb = { questionText: q.text, cause: result.cause, blockTitle: null }
        startSave('terminated', tb)
        return true
      }
    }
    // 2. Termination blocks assigned to this page
    const blocks = blocksByPage[currentPage] || []
    for (const block of blocks) {
      if (block.conditions?.length && evalBlock(block, responses, items)) {
        const cause = buildBlockCause(block, responses, items)
        const tb    = { questionText: null, cause, blockTitle: block.title || 'Termination Block' }
        startSave('terminated', tb)
        return true
      }
    }
    return false
  }

  const handleBack = () => {
    setCurrentPage(p => Math.max(0, p - 1))
    bumpLockVisit()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleNext = () => {
    if (isNavigationLocked) return
    if (!validatePage()) return
    if (checkPageTermination()) return

    const redirectUrl = resolvePageExternalRedirect(currentQuestions, responses, items)
    if (redirectUrl) {
      startSave('redirect', null, redirectUrl, responses)
      return
    }

    if (!isLastPage) {
      const branchTarget = resolveBranchTargetPage(currentQuestions, responses, items, pages, currentPage)
      setCurrentPage(branchTarget ?? currentPage + 1)
      bumpLockVisit()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      startSave('complete')
    }
  }

  const commitRef = useRef(commitRecord)
  commitRef.current = commitRecord

  useEffect(() => {
    if (!survey?.id || !useApi) return undefined
    const pending = readPendingResponse(survey.id)
    if (!pending?.entry) return undefined
    responseIdRef.current = pending.entry.id || null
    setResponses(pending.entry.responses || {})
    setCompanions(pending.entry.companions || {})
    if (Number.isInteger(pending.entry.pageReached)) setCurrentPage(pending.entry.pageReached)
    if (pending.terminatedBy) setTerminatedBy(pending.terminatedBy)
    saveLock.current = true
    void commitRef.current(pending)
    return () => { saveGen.current += 1 }
  }, [survey?.id])

  useEffect(() => {
    if (submitted && isEmbed) postCompleted()
  }, [submitted, isEmbed, postCompleted])

  useEffect(() => {
    if (terminated && isEmbed) postTerminated()
  }, [terminated, isEmbed, postTerminated])

  const showProgressBar = survey?.settings?.showProgressBar !== false
  const { progress, step: progressStep, totalSteps: progressTotal } = useMemo(
    () => computeBranchAwareProgress(currentPage, pages, items, responses),
    [currentPage, pages, items, responses],
  )
  const isLastPage = isLastPageOnPath(currentPage, pages, items, responses)

  return (
    <div
      ref={rootRef}
      className="survey-theme min-h-screen flex flex-col"
      data-sf-button-variant={buttonVariant}
      style={{ ...themeVars, backgroundColor: 'var(--sf-bg)', color: 'var(--sf-text)', fontFamily: 'var(--sf-font)' }}
    >
      {/* Header — hidden in embed mode for minimal chrome */}
      {!isEmbed && (
      <header className="bg-white border-b border-ink-200 sticky top-0 z-30 safe-top">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 min-h-14 py-2 sm:py-0 flex items-center gap-2 sm:gap-3">
          {displayLogo && (
            <img src={displayLogo} alt="Logo" className="h-6 sm:h-7 w-auto max-w-[100px] sm:max-w-[120px] object-contain shrink-0" />
          )}
          <h1 className="text-sm font-semibold flex-1 truncate min-w-0" style={{ color: 'var(--sf-text)' }}>{survey?.title || 'Survey'}</h1>
          {fpEnabled && (
            <span
              title={fpStatus === 'done' ? 'Fingerprint data collected for this session' : 'Collecting fingerprint…'}
              className={`text-xs font-semibold px-2 sm:px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1 ${
                fpStatus === 'done'
                  ? 'text-violet-600 bg-violet-50 border border-violet-200'
                  : 'text-ink-400 bg-ink-50 border border-ink-200'
              }`}
            >
              <Fingerprint size={11} /> <span className="hidden sm:inline">{fpStatus === 'done' ? 'FP captured' : 'FP collecting…'}</span>
            </span>
          )}
          {!isPublic && (
            <>
              <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 sm:px-2.5 py-1 rounded-full shrink-0 hidden sm:inline-flex">
                👁 Preview Mode
              </span>
              <button onClick={onClose} className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800 font-medium px-2 sm:px-3 py-1.5 hover:bg-ink-50 rounded-lg transition-all shrink-0">
                <X size={15} /> <span className="hidden sm:inline">Exit Preview</span>
              </button>
            </>
          )}
        </div>
      </header>
      )}

      {/* Embed mode: compact title bar only */}
      {isEmbed && displayLogo && (
        <div className="px-4 py-3 flex justify-center border-b border-ink-100 bg-white/80">
          <img src={displayLogo} alt="Logo" className="h-8 max-w-[160px] object-contain" />
        </div>
      )}

      {/* Progress bar */}
      {showProgressBar && progressTotal > 1 && !terminated && !submitted && !redirectedTo && !showCover && !holding && (
        <div className="bg-white border-b border-ink-100 px-4 sm:px-6 py-2">
          <div className="max-w-2xl mx-auto">
            <div className="flex justify-between text-xs text-ink-400 mb-1.5">
              <span>Page {progressStep} of {progressTotal}</span>
              <span>{progress}% complete</span>
            </div>
            <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: 'var(--sf-primary)' }} />
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {isPublic && survey?.status === 'closed' ? (
        <ClosedSurveyScreen settings={survey?.settings} />
      ) : holding ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <p className="text-sm text-ink-500 text-center max-w-md">
            {holding === 'rejected' ? SAVE_REJECTED : holding === 'busy' ? SURVEY_BUSY_SAVE : SAVING_RESPONSE}
          </p>
        </div>
      ) : showCover ? (
        <CoverPage survey={survey} onStart={() => { setShowCover(false); bumpLockVisit() }} isPublic={isPublic} />
      ) : redirectedTo ? (
        <ExternalRedirectScreen
          settings={survey?.settings}
          redirectUrl={redirectedTo}
          onReset={reset}
          onDownload={() => downloadCurrent('partial', null, 'redirected')}
          isPublic={isPublic}
        />
      ) : terminated ? (
        <TerminationScreen settings={survey?.settings} terminatedBy={terminatedBy} onReset={reset} onDownload={() => downloadCurrent('terminated', terminatedBy, 'terminated')} isPublic={isPublic} />
      ) : submitted ? (
        <CompletionScreen settings={survey?.settings} />
      ) : (
        <>
          <div className="flex-1 py-6 sm:py-8 px-4 sm:px-6">
            <div className="max-w-2xl mx-auto space-y-4 sm:space-y-5">
              {currentPageBreakTitle && (
                <div className="text-center mb-2">
                  <h2 className="text-lg font-semibold text-ink-700">{currentPageBreakTitle}</h2>
                </div>
              )}

              {currentItems.map(item => {
                // ── Text / Media block ──────────────────────────────────
                if (item.itemType === 'text_block') {
                  const piped = pipedDisplayByItemId[item.id] || {}
                  return (
                    <div key={item.id} className="bg-white rounded-2xl border border-emerald-100 p-4 sm:p-6">
                      {item.title && (
                        <p className="text-base font-semibold text-ink-800 mb-3">{piped.title}</p>
                      )}
                      {item.image && (
                        <div className="mb-3">
                          <img src={item.image} alt={item.imageCaption || ''} className="w-full max-h-72 object-contain rounded-xl border border-ink-100 bg-ink-50" />
                          {item.imageCaption && (
                            <p className="text-xs text-ink-400 text-center mt-1.5 italic">{item.imageCaption}</p>
                          )}
                        </div>
                      )}
                      {item.content && (
                        <div className="rte-content text-ink-700 text-sm leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: sanitizeHtml(piped.content) }} />
                      )}
                      {!item.title && !item.image && !item.content && (
                        <p className="text-ink-300 italic text-sm">Empty text block</p>
                      )}
                    </div>
                  )
                }

                // ── Question ────────────────────────────────────────────
                const q     = item
                const qNum  = questionNumberById[q.id] ?? 0
                const piped = pipedDisplayByItemId[q.id]
                const error = errors[q.id]
                return (
                  <div key={q.id} className={`bg-white rounded-2xl border-2 p-4 sm:p-6 transition-all duration-200 ${error ? 'border-rose-300 shadow-sm shadow-rose-100' : 'border-ink-100 hover:border-ink-200'}`}>
                    <div className="mb-3 sm:mb-4 flex items-start gap-2 sm:gap-3">
                      <span className="inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-brand-50 text-brand-600 text-xs sm:text-sm font-bold shrink-0 mt-0.5">
                        {qNum}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm sm:text-base font-semibold text-ink-800 leading-snug">
                          {piped?.text || <span className="text-ink-300 italic">Untitled question</span>}
                          {q.required && <span className="text-rose-500 ml-1">*</span>}
                        </p>
                      </div>
                    </div>
                    <div className="sm:ml-10">
                      <QuestionRenderer
                        question={q}
                        value={responses[q.id]}
                        onChange={val => handleChange(q, val)}
                        surveyDateFormat={survey?.defaultDateFormat || DEFAULT_DATE_FORMAT}
                        companions={companions[q.id] || {}}
                        onCompanionChange={(optId, text) => handleCompanionChange(q.id, optId, text)}
                        responses={responses}
                        items={items}
                      />
                      {error && (
                        <p className="mt-2 text-sm text-rose-600 flex items-center gap-1.5">
                          <span className="w-4 h-4 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0 text-xs font-bold">!</span>
                          {error}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Page navigation — below questions so respondents need not reach the page footer */}
              <nav
                className="mt-6 sm:mt-8 pt-6 sm:pt-8 border-t border-ink-100"
                aria-label="Survey page navigation"
              >
                {isNavigationLocked && (
                  <p className="mb-4 text-center text-sm font-medium text-amber-800 bg-amber-50 border border-amber-200/80 rounded-xl px-4 py-2.5">
                    Please review this page — Next unlocks in{' '}
                    <span className="tabular-nums font-semibold">{remainingSeconds}s</span>
                  </p>
                )}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={handleBack}
                    disabled={currentPage === 0}
                    className="order-2 sm:order-1 inline-flex items-center justify-center sm:justify-start gap-2 min-h-11 px-4 text-sm font-medium text-ink-600 hover:text-ink-900 hover:bg-ink-50 rounded-xl border border-transparent hover:border-ink-200 disabled:opacity-35 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronLeft size={18} aria-hidden />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={isNavigationLocked}
                    className="order-1 sm:order-2 btn-primary w-full sm:w-auto min-h-11 px-6 sm:px-10 flex items-center justify-center gap-2 text-sm sm:text-base font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    {isLastPage ? (
                      <>
                        <Check size={18} aria-hidden />
                        Submit survey
                      </>
                    ) : (
                      <>
                        Next
                        <ChevronRight size={18} aria-hidden />
                      </>
                    )}
                  </button>
                </div>
              </nav>
            </div>
          </div>
        </>
      )}

      {showPoweredByFooter && (
        <footer className="py-3 text-center text-xs text-ink-400 border-t border-ink-100">
          Powered by {APP_NAME}
        </footer>
      )}
    </div>
  )
}

export default SurveyPreview
