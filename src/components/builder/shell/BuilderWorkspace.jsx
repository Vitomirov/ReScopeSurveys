import { useRef } from 'react'
import { BuilderQuickAddDock } from '@/components/builder/panels'
import { SurveyHeaderCard } from '@/components/builder/canvas/SurveyHeaderCard'
import { SurveyItemList } from '@/components/builder/canvas/SurveyItemList'
import { BuilderSidebar } from '@/components/builder/shell/BuilderSidebar'
import { AppWorkspaceColumns } from '@/components/shared/layout/AppWorkspaceColumns.jsx'

export function BuilderWorkspace({
  state,
  dispatch,
  sensors,
  sortableItemIds,
  itemMeta,
  availableQuestionsByIndex,
  groupQuestionCounts,
  allPagesLockEnabled,
  draggedItem,
  hasItems,
  addActions,
  onActivateItem,
  onDragStart,
  onDragEnd,
  onOpenMore,
}) {
  const scrollRef = useRef(null)

  return (
    <AppWorkspaceColumns className="flex-1 min-h-0 lg:overflow-hidden" sidebar={<BuilderSidebar items={state.items} addActions={addActions} />}>
      <div className="flex-1 min-h-0 flex flex-col lg:overflow-hidden">
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto py-4 sm:py-6 lg:py-6 lg:pr-0.5">
          <SurveyHeaderCard survey={state.survey} items={state.items} dispatch={dispatch} hasItems={hasItems} />
          <SurveyItemList
            state={state}
            dispatch={dispatch}
            sensors={sensors}
            sortableItemIds={sortableItemIds}
            itemMeta={itemMeta}
            availableQuestionsByIndex={availableQuestionsByIndex}
            groupQuestionCounts={groupQuestionCounts}
            allPagesLockEnabled={allPagesLockEnabled}
            draggedItem={draggedItem}
            onActivateItem={onActivateItem}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            scrollContainerRef={scrollRef}
          />
          {hasItems && <div className="h-24 lg:hidden" aria-hidden="true" />}
        </div>

        {hasItems && (
          <div className="hidden lg:block shrink-0 pt-3 pb-4 bg-surface border-t border-ink-200/80">
            <BuilderQuickAddDock dispatch={dispatch} onOpenMore={onOpenMore} />
          </div>
        )}
      </div>
    </AppWorkspaceColumns>
  )
}
