import { useEffect, useRef } from 'react'
import {
  DndContext, closestCenter, DragOverlay,
} from '@dnd-kit/core'
import { scrollChildToTop } from '@/utils/dom/scrollChildToTop'
import {
  SortableContext, verticalListSortingStrategy,
} from '@dnd-kit/sortable'

import { EmptyState } from '@/components/builder/panels'
import {
  SurveyItemRow, PageOneLockBarRow, getDragOverlayLabel,
} from '@/components/builder/canvas/SurveyItemRow'

export function SurveyItemList({
  state,
  dispatch,
  sensors,
  sortableItemIds,
  itemMeta,
  availableQuestionsByIndex,
  groupQuestionCounts,
  allPagesLockEnabled,
  draggedItem,
  onActivateItem,
  onDragStart,
  onDragEnd,
  scrollContainerRef,
}) {
  const prevItemCount = useRef(state.items.length)

  useEffect(() => {
    if (state.items.length <= prevItemCount.current || !state.activeItemId) {
      prevItemCount.current = state.items.length
      return
    }
    prevItemCount.current = state.items.length

    const id = state.activeItemId
    const container = scrollContainerRef?.current
    const timers = []

    const scrollToItem = () => {
      const el = document.getElementById(`survey-item-${id}`)
      if (el) scrollChildToTop(container, el)
    }

    requestAnimationFrame(() => requestAnimationFrame(scrollToItem))
    timers.push(setTimeout(scrollToItem, 50), setTimeout(scrollToItem, 150))

    let ro
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(scrollToItem)
      requestAnimationFrame(() => {
        const el = document.getElementById(`survey-item-${id}`)
        if (el) ro.observe(el)
      })
      timers.push(setTimeout(() => ro?.disconnect(), 500))
    }

    return () => {
      timers.forEach(clearTimeout)
      ro?.disconnect()
    }
  }, [state.items.length, state.activeItemId, scrollContainerRef])

  if (state.items.length === 0) {
    return <EmptyState onAdd={type => dispatch({ type: 'ADD_QUESTION', qtype: type })} />
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={sortableItemIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {!allPagesLockEnabled && (
            <PageOneLockBarRow
              survey={state.survey}
              dispatch={dispatch}
              activeItemId={state.activeItemId}
              onActivateItem={onActivateItem}
            />
          )}
          {state.items.map((item, idx) => (
            <div key={item.id} id={`survey-item-${item.id}`}>
              <SurveyItemRow
                item={item}
                idx={idx}
                meta={itemMeta[idx]}
                state={state}
                dispatch={dispatch}
                availableQuestions={availableQuestionsByIndex[idx]}
                groupQuestionCounts={groupQuestionCounts}
                allPagesLockEnabled={allPagesLockEnabled}
                onActivateItem={onActivateItem}
              />
            </div>
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {draggedItem && (
          <div className="card drag-overlay px-4 py-3 flex items-center gap-3">
            <span className="text-sm font-medium text-ink-600 truncate">
              {getDragOverlayLabel(draggedItem)}
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
