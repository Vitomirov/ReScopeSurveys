import { useState, useEffect, lazy, Suspense } from 'react'
import { ErrorBoundary } from '@/components/shared/infra/ErrorBoundary'
import { PageLoader, useToast } from '@/components/ui'
import { INITIAL_STATE } from '@/store/initialState'
import { newSurveyId } from '@/store/id'
import { getSession, logout, refreshSessionFromApi } from '@/utils/data/authStore'
import { onAuthInvalidated } from '@/api/auth/authEvents'
import { AUTH_ERRORS } from '@/constants/authCopy'
import { useApi } from '@/config/api'
import { prefetchForRoute } from '@/utils/routing/routePrefetch'
import { useRoute, nav, navMarketingHome, isMarketingRoute, isAccountLinkView } from '@/utils/routing/appRoute'
import { isMarketingSiteHost, usesSplitSiteHosts, assignAppRoute } from '@shared/siteHosts.js'
import { isNewSurveyDraft, markNewSurveyDraft } from '@/utils/data/surveyDrafts'
import { SURVEY_NOT_FOUND_MESSAGE, SURVEY_NOT_FOUND_TITLE } from '@/constants/errors'

import { useSurveyBranding } from '@/hooks/useSurveyBranding'
import { isPlatformOwner } from '@/utils/platform/permissions'

const LoginPage        = lazy(() => import('@/components/auth/LoginPage.jsx'))
const AccountLinkPage  = lazy(() => import('@/components/auth/AccountLinkPage.jsx'))
const MarketingPage    = lazy(() => import('@/website/MarketingPage.jsx'))
const Dashboard        = lazy(() => import('@/components/dashboard/Dashboard.jsx'))
const PlatformConsole  = lazy(() => import('@/components/dashboard/PlatformConsole.jsx'))
const SurveyBuilder    = lazy(() => import('@/components/builder/SurveyBuilder.jsx'))
const SurveyPreview    = lazy(() => import('@/components/taker/SurveyPreview.jsx'))

/** Load the survey named by the route — public payload for the taker link. */
async function fetchEntry(view, id, { byPath = false, clientDomain = null, isEmbed = false } = {}) {
  if (useApi) {
    const { getSurvey, getPublicSurvey, getPublicSurveyByPath, payloadToLibraryEntry } =
      await import('@/api/survey/surveys')
    const embedOpts = { embed: isEmbed }
    const payload = view === 'take'
      ? (byPath
        ? await getPublicSurveyByPath(id, clientDomain, embedOpts)
        : await getPublicSurvey(id, embedOpts))
      : await getSurvey(id)
    return payloadToLibraryEntry(id, payload)
  }
  const { loadSurvey, loadSurveyByPublicPath } = await import('@/utils/data/surveyLibrary')
  if (view === 'take' && byPath) return loadSurveyByPublicPath(id, clientDomain)
  return loadSurvey(id)
}

/** Survey for the current route: 'loading' | 'ready' | 'missing' | 'error'. */
function useSurveyEntry(view, id, { byPath = false, clientDomain = null, isEmbed = false } = {}) {
  const [state, setState] = useState(() => ({ status: id ? 'loading' : 'ready', entry: null }))

  useEffect(() => {
    if (!id) { setState({ status: 'ready', entry: null }); return }
    if (useApi && view === 'builder' && isNewSurveyDraft(id)) {
      setState({ status: 'missing', entry: null })
      return
    }
    let alive = true
    setState({ status: 'loading', entry: null })
    fetchEntry(view, id, { byPath, clientDomain, isEmbed })
      .then(entry => { if (alive) setState({ status: entry ? 'ready' : 'missing', entry }) })
      .catch(err  => { if (alive) setState({ status: err?.status === 404 ? 'missing' : 'error', entry: null }) })
    return () => { alive = false }
  }, [view, id, byPath, clientDomain, isEmbed])

  return state
}

/** Shared shell — error recovery around a lazily loaded view. */
function Page({ title, label, onReset, children }) {
  return (
    <ErrorBoundary title={title} onReset={onReset}>
      <Suspense fallback={<PageLoader label={label} />}>{children}</Suspense>
    </ErrorBoundary>
  )
}

function NotFound({ onBack }) {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="text-5xl mb-4">🔍</div>
        <h2 className="text-xl font-bold text-ink-800 mb-2">{SURVEY_NOT_FOUND_TITLE}</h2>
        <p className="text-ink-500 mb-4">{SURVEY_NOT_FOUND_MESSAGE}</p>
        {onBack && (
          <button type="button" onClick={onBack} className="text-brand-600 hover:text-brand-700 font-medium">
            Back to dashboard
          </button>
        )}
      </div>
    </div>
  )
}

/** Existing survey, or a blank draft that autosaves under the route's id. */
function builderState(id, entry) {
  return {
    ...INITIAL_STATE,
    survey: entry?.survey || { ...INITIAL_STATE.survey, id },
    items:  entry?.items || [],
  }
}

function PreviewPage({ entry, onClose }) {
  const branding = useSurveyBranding(entry?.survey, { enabled: Boolean(entry?.survey) })
  return (
    <SurveyPreview
      survey={entry.survey}
      items={entry.items || []}
      onClose={onClose}
      isPublic={false}
      branding={branding}
    />
  )
}

export default function App() {
  const [session, setSession] = useState(() => (useApi ? null : getSession()))
  const [authChecking, setAuthChecking] = useState(() => useApi)
  const { toast }             = useToast()
  const { view, id, byPath, clientDomain, isEmbed, openExport, signupPlanId, token } = useRoute()
  const isPublic              = view === 'take'
  const ownerSession          = isPlatformOwner(session)
  const { status, entry }     = useSurveyEntry(
    view,
    (isPublic || (session && !ownerSession)) ? id : null,
    { byPath, clientDomain, isEmbed },
  )

  useEffect(() => {
    if (!useApi || isPublic) {
      if (!useApi) setSession(getSession())
      setAuthChecking(false)
      return
    }
    let alive = true
    refreshSessionFromApi().then(next => {
      if (!alive) return
      setSession(next)
      setAuthChecking(false)
      prefetchForRoute({ session: next })
    })
    return () => { alive = false }
  }, [isPublic])

  useEffect(() => {
    return onAuthInvalidated((code) => {
      logout()
      setSession(null)
      if (usesSplitSiteHosts() && !isMarketingSiteHost()) nav('login')
      else navMarketingHome()
      const message = code === 'TOKEN_EXPIRED'
        ? AUTH_ERRORS.sessionExpired
        : AUTH_ERRORS.sessionInvalid
      toast({ message, type: 'error', duration: 4500 })
    })
  }, [toast])

  useEffect(() => {
    prefetchForRoute({ session, publicSurveyId: isPublic ? id : null })
  }, [session, isPublic, id])

  useEffect(() => {
    if (!session) return
    // verify-email is allowed while signed in; the page navigates on its own.
    if (view === 'login' || view === 'signup' || (isAccountLinkView(view) && view !== 'verify-email')) {
      nav('dashboard')
    }
  }, [session, view])

  useEffect(() => {
    if (!ownerSession) return
    if (view === 'builder' || view === 'preview') nav('dashboard')
  }, [ownerSession, view])

  useEffect(() => {
    if (!usesSplitSiteHosts() || session) return
    if (isMarketingSiteHost() && (view === 'login' || view === 'signup' || isAccountLinkView(view))) {
      assignAppRoute(view, null, view === 'signup' ? { plan: signupPlanId ?? 'free_trial' } : { token })
    }
  }, [session, view, signupPlanId, token])

  useEffect(() => {
    if (!usesSplitSiteHosts() || !session) return
    if (isMarketingSiteHost() && isMarketingRoute(view)) {
      assignAppRoute('dashboard')
    }
  }, [session, view])

  const goMarketing = () => navMarketingHome()
  const authMode = view === 'signup' ? 'signup' : 'login'
  const back = () => nav('dashboard')
  const onMarketingHost = isMarketingSiteHost()
  const splitHosts = usesSplitSiteHosts()

  if (isPublic) {
    if (status === 'loading') return <PageLoader label="Loading survey…" />
    if (status !== 'ready')   return <NotFound />
    return (
      <Page title="Survey error" label="Loading survey…">
        <SurveyPreview
          survey={entry.survey}
          items={entry.items || []}
          onClose={null}
          isPublic
          isEmbed={isEmbed}
          branding={entry.branding}
        />
      </Page>
    )
  }

  if (authChecking) {
    return <PageLoader label="Loading…" />
  }

  if (useApi && isAccountLinkView(view) && (!session || view === 'verify-email')) {
    if (splitHosts && onMarketingHost) {
      return <PageLoader label="Opening sign-in…" />
    }
    return (
      <Page title="Account error" label="Loading…">
        <AccountLinkPage
          view={view}
          token={token}
          session={session}
          onGoHome={goMarketing}
          onSessionUpdate={setSession}
          onLogin={(s) => { prefetchForRoute({ session: s }); setSession(s) }}
        />
      </Page>
    )
  }

  if (!session) {
    if (splitHosts && onMarketingHost && (view === 'login' || view === 'signup')) {
      return <PageLoader label="Opening sign-in…" />
    }

    const authGateViews = ['login', 'signup', 'builder', 'preview']
    if (authGateViews.includes(view) || (splitHosts && !onMarketingHost)) {
      return (
        <Page title="Sign-in error" label="Loading…">
          <LoginPage
            initialMode={authGateViews.includes(view) ? authMode : 'login'}
            onGoHome={goMarketing}
            signupPlanId={signupPlanId ?? 'free_trial'}
            onLogin={(s) => { prefetchForRoute({ session: s }); setSession(s) }}
          />
        </Page>
      )
    }

    return (
      <Page title="Marketing" label="Loading site…">
        <MarketingPage isAuthenticated={false} />
      </Page>
    )
  }

  if (session?.canUseBuilder === false && !ownerSession) {
    return (
      <Page title="Panel access" label="Loading account…" onReset={back}>
        <Dashboard
          session={session}
          onSessionUpdate={setSession}
          onLogout={() => { logout(); setSession(null); navMarketingHome() }}
          onNewSurvey={() => {}}
          onOpenSurvey={() => {}}
          onPreviewSurvey={() => {}}
          panelOnly
        />
      </Page>
    )
  }

  if (ownerSession) {
    return (
      <Page title="Platform console error" label="Loading platform console…" onReset={back}>
        <PlatformConsole
          session={session}
          onSessionUpdate={setSession}
          onLogout={() => { logout(); setSession(null); navMarketingHome() }}
        />
      </Page>
    )
  }

  if (view === 'home') {
    if (splitHosts && !onMarketingHost) {
      return (
        <Page title="Dashboard error" label="Loading dashboard…" onReset={back}>
          <Dashboard
            session={session}
            onSessionUpdate={setSession}
            onLogout={() => { logout(); setSession(null); navMarketingHome() }}
            onNewSurvey={() => {
              const surveyId = newSurveyId()
              markNewSurveyDraft(surveyId)
              nav('builder', surveyId)
            }}
            onOpenSurvey={(surveyId, opts) => nav('builder', surveyId, opts)}
            onPreviewSurvey={(surveyId) => nav('preview', surveyId)}
          />
        </Page>
      )
    }
    return (
      <Page title="Marketing" label="Loading site…">
        <MarketingPage isAuthenticated />
      </Page>
    )
  }

  if (view === 'builder') {
    if (status === 'loading') return <PageLoader label="Loading builder…" />
    if (status === 'error')   return <NotFound onBack={back} />
    return (
      <Page title="Builder error" label="Loading builder…" onReset={back}>
        <SurveyBuilder
          key={id}
          initialState={builderState(id, entry)}
          initialRevision={entry?.revision ?? null}
          onBackToDashboard={back}
          openExport={openExport}
        />
      </Page>
    )
  }

  if (view === 'preview') {
    if (status === 'loading') return <PageLoader label="Loading preview…" />
    if (status !== 'ready')   return <NotFound onBack={back} />
    return (
      <Page title="Preview error" label="Loading preview…" onReset={back}>
        <PreviewPage entry={entry} onClose={back} />
      </Page>
    )
  }

  return (
    <Page title="Dashboard error" label="Loading dashboard…" onReset={back}>
      <Dashboard
        session={session}
        onSessionUpdate={setSession}
        onLogout={() => { logout(); setSession(null); navMarketingHome() }}
        onNewSurvey={() => {
          const surveyId = newSurveyId()
          markNewSurveyDraft(surveyId)
          nav('builder', surveyId)
        }}
        onOpenSurvey={(surveyId, opts) => nav('builder', surveyId, opts)}
        onPreviewSurvey={(surveyId) => nav('preview', surveyId)}
      />
    </Page>
  )
}
