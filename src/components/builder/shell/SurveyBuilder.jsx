import { lazy, Suspense, useState, useEffect, useMemo } from 'react'
import { PageLoader } from '@/components/ui'
import { useSurveyBuilder } from '@/components/builder/hooks/useSurveyBuilder'
import { BuilderHeader } from '@/components/builder/shell/BuilderHeader'
import { BuilderWorkspace } from '@/components/builder/shell/BuilderWorkspace'
import { BuilderMobileChrome } from '@/components/builder/shell/BuilderMobileChrome'
import { BuilderModals } from '@/components/builder/shell/BuilderModals'
import { ImportQuestionsModal } from '@/components/builder/import/ImportQuestionsModal'
import { fetchImportCapabilities } from '@/api/survey/import'
import { useApi } from '@/config/api'
import { getSurvey } from '@/api/survey/surveys'
import { AppAlignedBody } from '@/components/shared/layout/AppBuilderShell.jsx'
import { ImportReviewBanner } from '@/components/builder/import/ImportReviewBanner.jsx'

const SurveyPreview = lazy(() => import('@/components/taker/SurveyPreview.jsx'))

export function SurveyBuilder({ initialState, initialRevision = null, onBackToDashboard, openExport = false }) {
  const builder = useSurveyBuilder({ initialState, initialRevision, openExport })
  const [showImportQuestions, setShowImportQuestions] = useState(false)
  const [canImport, setCanImport] = useState(false)

  useEffect(() => {
    if (!useApi) return
    fetchImportCapabilities()
      .then(d => setCanImport(Boolean(d?.surveyImport)))
      .catch(() => setCanImport(false))
  }, [])

  const importItemWarnings = useMemo(() => {
    const out = []
    for (const item of builder.state.items || []) {
      if (item.importMeta?.partial && item.itemType === 'question') {
        out.push({
          code: 'PARTIAL_TYPE',
          message: `${item.text || 'Untitled'} (${item.questionType}): finish setup in builder.`,
        })
      }
    }
    return out
  }, [builder.state.items])

  if (builder.state.showPreview) {
    return (
      <Suspense fallback={<PageLoader label="Loading preview…" />}>
        <SurveyPreview
          survey={builder.state.survey}
          items={builder.state.items}
          onClose={builder.closePreview}
          branding={builder.previewBranding}
        />
      </Suspense>
    )
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col lg:h-screen lg:overflow-hidden">
      <BuilderHeader
        survey={builder.state.survey}
        dispatch={builder.dispatch}
        saveStatus={builder.saveStatus}
        isDirty={builder.state.isDirty}
        onBackToDashboard={onBackToDashboard}
        showMobileMenu={builder.showMobileMenu}
        setShowMobileMenu={builder.setShowMobileMenu}
        onExportCSVTemplate={builder.handleExportCSVTemplate}
        onOpenExport={() => builder.setShowExport(true)}
        onOpenTest={() => builder.setShowTest(true)}
        onOpenPreview={builder.openPreview}
        onSave={builder.handleSave}
        onImportQuestions={canImport ? () => setShowImportQuestions(true) : undefined}
      />

      <ImportReviewBanner
        survey={builder.state.survey}
        itemWarnings={importItemWarnings}
      />

      <AppAlignedBody
        className="flex-1 flex flex-col min-h-0 py-4 sm:py-6 lg:py-0 lg:overflow-hidden"
        gridClassName="flex-1 min-h-0 lg:overflow-hidden"
        paneClassName="flex-1 min-h-0 flex flex-col lg:overflow-hidden"
        showBack
        withDivider={false}
        onBack={onBackToDashboard}
      >
        <BuilderWorkspace
          state={builder.state}
          dispatch={builder.dispatch}
          sensors={builder.sensors}
          sortableItemIds={builder.sortableItemIds}
          itemMeta={builder.itemMeta}
          availableQuestionsByIndex={builder.availableQuestionsByIndex}
          groupQuestionCounts={builder.groupQuestionCounts}
          allPagesLockEnabled={builder.allPagesLockEnabled}
          draggedItem={builder.draggedItem}
          hasItems={builder.hasItems}
          addActions={builder.addActions}
          onActivateItem={builder.handleActivateItem}
          onDragStart={builder.handleDragStart}
          onDragEnd={builder.handleDragEnd}
          onOpenMore={() => builder.setShowMobilePanel(true)}
        />
      </AppAlignedBody>

      <BuilderMobileChrome
        hasItems={builder.hasItems}
        items={builder.state.items}
        dispatch={builder.dispatch}
        showMobilePanel={builder.showMobilePanel}
        setShowMobilePanel={builder.setShowMobilePanel}
        addActions={builder.addActions}
      />

      <BuilderModals
        showTest={builder.showTest}
        showExport={builder.showExport}
        survey={builder.state.survey}
        items={builder.state.items}
        onCloseTest={() => builder.setShowTest(false)}
        onCloseExport={() => builder.setShowExport(false)}
      />

      <ImportQuestionsModal
        open={showImportQuestions}
        onClose={() => setShowImportQuestions(false)}
        surveyId={builder.state.survey.id}
        onAppended={async () => {
          const remote = await getSurvey(builder.state.survey.id)
          builder.dispatch({
            type: 'HYDRATE_FROM_SERVER',
            survey: remote.survey,
            items: remote.items || [],
          })
        }}
      />
    </div>
  )
}

export default SurveyBuilder
