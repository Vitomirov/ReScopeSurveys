import { Plus, X } from 'lucide-react'
import { AddPanel, StatsPanel, BuilderQuickAddDock } from '@/components/builder/panels'

export function BuilderMobileChrome({
  hasItems,
  items,
  dispatch,
  showMobilePanel,
  setShowMobilePanel,
  addActions,
}) {
  const closePanel = () => setShowMobilePanel(false)

  const handleAdd = (action) => {
    action()
    closePanel()
  }

  return (
    <>
      {hasItems && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-20 px-4 pb-4 safe-bottom pointer-events-none">
          <div className="pointer-events-auto max-w-lg mx-auto">
            <BuilderQuickAddDock
              dispatch={dispatch}
              onOpenMore={() => setShowMobilePanel(true)}
            />
          </div>
        </div>
      )}

      {!hasItems && (
        <button
          onClick={() => setShowMobilePanel(true)}
          className="lg:hidden fixed bottom-6 right-4 z-20 w-14 h-14 bg-brand-600 hover:bg-brand-700 active:bg-brand-700 text-white rounded-full shadow-lg shadow-brand-900/25 hover:shadow-xl flex items-center justify-center transition-all active:scale-95 focus-ring safe-bottom"
          title="Add question or structure"
        >
          <Plus size={24} />
        </button>
      )}

      {showMobilePanel && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/40" onClick={closePanel} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col safe-bottom">
            <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100 shrink-0">
              <h3 className="text-sm font-bold text-ink-800">Add to survey</h3>
              <button
                onClick={closePanel}
                className="p-2 text-ink-500 hover:text-ink-800 hover:bg-ink-100 active:bg-ink-200 rounded-lg transition-all focus-ring"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <AddPanel
                onAddQuestion={type => handleAdd(() => addActions.onAddQuestion(type))}
                onAddPageBreak={() => handleAdd(addActions.onAddPageBreak)}
                onAddGroup={() => handleAdd(addActions.onAddGroup)}
                onAddTerminationBlock={() => handleAdd(addActions.onAddTerminationBlock)}
                onAddTextBlock={() => handleAdd(addActions.onAddTextBlock)}
              />
              {hasItems && (
                <div className="mt-4">
                  <StatsPanel items={items} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
