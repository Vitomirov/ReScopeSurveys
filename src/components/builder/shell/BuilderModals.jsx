import { lazy, Suspense } from 'react'
import { InlineLoader } from '@/components/ui'

const SurveyTestRunner = lazy(() => import('@/components/builder/test-runner/SurveyTestRunner.jsx'))
const ExportManager = lazy(() => import('@/components/builder/managers/ExportManager.jsx'))

function ModalLoader({ label }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
      <InlineLoader label={label} />
    </div>
  )
}

export function BuilderModals({ showTest, showExport, survey, items, onCloseTest, onCloseExport }) {
  return (
    <>
      {showTest && (
        <Suspense fallback={<ModalLoader label="Loading test runner…" />}>
          <SurveyTestRunner survey={survey} items={items} onClose={onCloseTest} />
        </Suspense>
      )}
      {showExport && (
        <Suspense fallback={<ModalLoader label="Loading export…" />}>
          <ExportManager survey={survey} items={items} onClose={onCloseExport} />
        </Suspense>
      )}
    </>
  )
}
