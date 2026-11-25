import {
  QuestionCard,
  PageBreakItem, PageOneLockBar, GroupItem, TerminationBlockItem, TextBlockItem,
} from '@/components/builder/items'
import { PAGE_ONE_LOCK_ID } from '@/components/builder/items/PageOneLockBar'
import { DEFAULT_DATE_FORMAT } from '@/constants/survey/surveyDefaults'

export function SurveyItemRow({
  item,
  idx,
  meta,
  state,
  dispatch,
  availableQuestions,
  groupQuestionCounts,
  allPagesLockEnabled,
  onActivateItem,
}) {
  if (item.itemType === 'page_break') {
    return (
      <PageBreakItem
        item={item}
        pageNumber={meta.pageNum}
        dispatch={dispatch}
        isActive={state.activeItemId === item.id}
        onActivateItem={onActivateItem}
        allPagesLockEnabled={allPagesLockEnabled}
      />
    )
  }

  if (item.itemType === 'group') {
    return (
      <GroupItem
        item={item}
        questionCount={groupQuestionCounts[item.id] || 0}
        dispatch={dispatch}
        availableQuestions={availableQuestions}
        contextItems={state.items}
        isActive={state.activeItemId === item.id}
        onActivateItem={onActivateItem}
        allPagesLockEnabled={allPagesLockEnabled}
      />
    )
  }

  if (item.itemType === 'termination_block') {
    return (
      <TerminationBlockItem
        item={item}
        availableQuestions={availableQuestions}
        contextItems={state.items}
        isActive={state.activeItemId === item.id}
        onActivateItem={onActivateItem}
        dispatch={dispatch}
      />
    )
  }

  if (item.itemType === 'text_block') {
    return (
      <TextBlockItem
        item={item}
        dispatch={dispatch}
        availableQuestions={availableQuestions}
        contextItems={state.items}
        isActive={state.activeItemId === item.id}
        onActivateItem={onActivateItem}
      />
    )
  }

  if (meta.hidden) return null

  const inGroup = !!meta.currentGroupId
  return (
    <div className={inGroup ? 'ml-2 sm:ml-4 border-l-2 border-ink-200 pl-2 sm:pl-3' : ''}>
      <QuestionCard
        question={item}
        questionNumber={meta.questionNumber}
        isActive={state.activeItemId === item.id}
        dispatch={dispatch}
        onActivateItem={onActivateItem}
        focusOptionId={state.activeItemId === item.id ? state.focusOptionId : null}
        surveyDateFormat={state.survey.defaultDateFormat || DEFAULT_DATE_FORMAT}
        availableQuestions={availableQuestions}
        contextItems={state.items}
        itemIndex={idx}
      />
    </div>
  )
}

export function PageOneLockBarRow({ survey, dispatch, activeItemId, onActivateItem }) {
  return (
    <PageOneLockBar
      survey={survey}
      dispatch={dispatch}
      isActive={activeItemId === PAGE_ONE_LOCK_ID}
      onActivate={onActivateItem}
    />
  )
}

export function getDragOverlayLabel(item) {
  if (item.itemType === 'question') return item.text || 'Untitled question'
  if (item.itemType === 'page_break') return '— Page Break —'
  return item.title || 'Group'
}
