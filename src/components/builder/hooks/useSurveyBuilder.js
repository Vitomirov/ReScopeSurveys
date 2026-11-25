import { useReducer, useState, useMemo, useCallback, useEffect } from 'react'
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable'

import { surveyReducer, INITIAL_STATE } from '@/store/surveyStore'
import { useAutosave } from '@/hooks/useAutosave'
import { useSurveyBranding } from '@/hooks/useSurveyBranding'
import { buildItemMeta, buildAvailableQuestionsByIndex, buildGroupQuestionCounts } from '@/utils/format/builderLayout'
import { generateTemplateCSV, downloadCSV } from '@/utils/csvExport'
import { resolveNavigationLockSeconds } from '@/constants/survey/navigationLock'
import { prefetchCommonEditors, prefetchModule } from '@/utils/routing/routePrefetch'
import { isChoiceType } from '@/utils/survey/questions/questionHelpers'
import { EDITOR_LOADERS, loadChoiceEditor } from '@/components/builder/editors/editorLoaders'

export function useSurveyBuilder({ initialState, initialRevision = null, openExport = false }) {
  const [state, dispatch] = useReducer(surveyReducer, initialState || INITIAL_STATE)

  const [dragActiveId, setDragActiveId] = useState(null)
  const [showTest, setShowTest] = useState(false)
  const [showExport, setShowExport] = useState(() => Boolean(openExport))
  const [showMobilePanel, setShowMobilePanel] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  useEffect(() => {
    prefetchCommonEditors()
    const items = initialState?.items ?? []
    const types = new Set(
      items.filter(i => i.itemType === 'question').map(i => i.questionType)
    )
    for (const type of types) {
      const loader = isChoiceType(type) ? loadChoiceEditor : EDITOR_LOADERS[type]
      if (loader) prefetchModule(loader)
    }
  }, [initialState])

  useEffect(() => {
    if (openExport) setShowExport(true)
  }, [openExport])

  const { saveStatus } = useAutosave({
    survey: state.survey,
    items: state.items,
    revision: initialRevision,
    onSaved: (result, payload) => {
      if (result.publicPath && result.publicPath !== payload.survey.publicPath) {
        dispatch({ type: 'SET_SURVEY_FIELD', field: 'publicPath', value: result.publicPath })
      }
    },
    onConflict: (remote) => {
      if (!remote?.survey) return
      dispatch({
        type: 'HYDRATE_FROM_SERVER',
        survey: remote.survey,
        items: remote.items || [],
      })
    },
  })

  const handleActivateItem = useCallback((id) => {
    dispatch({ type: 'TOGGLE_ACTIVE_ITEM', id })
  }, [])

  const sortableItemIds = useMemo(
    () => state.items.map(i => i.id),
    [state.items]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const itemMeta = useMemo(() => buildItemMeta(state.items), [state.items])

  const availableQuestionsByIndex = useMemo(
    () => buildAvailableQuestionsByIndex(state.items),
    [state.items]
  )

  const groupQuestionCounts = useMemo(
    () => buildGroupQuestionCounts(state.items, itemMeta),
    [state.items, itemMeta]
  )

  const allPagesLockEnabled = useMemo(
    () => resolveNavigationLockSeconds(state.survey.settings?.navigationLockAllPages) > 0,
    [state.survey.settings?.navigationLockAllPages]
  )

  const addActions = useMemo(() => ({
    onAddQuestion: (qtype) => dispatch({ type: 'ADD_QUESTION', qtype }),
    onAddPageBreak: () => dispatch({ type: 'ADD_PAGE_BREAK' }),
    onAddGroup: () => dispatch({ type: 'ADD_GROUP' }),
    onAddTerminationBlock: () => dispatch({ type: 'ADD_TERMINATION_BLOCK' }),
    onAddTextBlock: () => dispatch({ type: 'ADD_TEXT_BLOCK' }),
  }), [])

  const handleDragStart = useCallback((e) => setDragActiveId(e.active.id), [])

  const handleDragEnd = useCallback((event) => {
    setDragActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = state.items.findIndex(i => i.id === active.id)
    const newIdx = state.items.findIndex(i => i.id === over.id)
    dispatch({ type: 'REORDER_ITEMS', items: arrayMove(state.items, oldIdx, newIdx) })
  }, [state.items])

  const handleSave = useCallback(() => {
    const blob = new Blob(
      [JSON.stringify({
        survey: state.survey,
        items: state.items,
        exportedAt: new Date().toISOString(),
      }, null, 2)],
      { type: 'application/json' }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(state.survey.title || 'survey').replace(/\s+/g, '_')}.json`
    a.click()
    URL.revokeObjectURL(url)
    dispatch({ type: 'MARK_SAVED' })
  }, [state.survey, state.items])

  const handleExportCSVTemplate = useCallback(() => {
    const csv = generateTemplateCSV(state.items, state.survey)
    downloadCSV(csv, `${(state.survey.title || 'survey').replace(/\s+/g, '_')}_template.csv`)
  }, [state.items, state.survey])

  const openPreview = useCallback(() => {
    dispatch({ type: 'SET_PREVIEW', show: true })
  }, [])

  const closePreview = useCallback(() => {
    dispatch({ type: 'SET_PREVIEW', show: false })
  }, [])

  const draggedItem = state.items.find(i => i.id === dragActiveId)
  const previewBranding = useSurveyBranding(state.survey, { enabled: state.showPreview })
  const hasItems = state.items.length > 0

  return {
    state,
    dispatch,
    saveStatus,
    itemMeta,
    availableQuestionsByIndex,
    groupQuestionCounts,
    allPagesLockEnabled,
    sortableItemIds,
    sensors,
    draggedItem,
    previewBranding,
    hasItems,
    showTest,
    setShowTest,
    showExport,
    setShowExport,
    showMobilePanel,
    setShowMobilePanel,
    showMobileMenu,
    setShowMobileMenu,
    handleActivateItem,
    handleDragStart,
    handleDragEnd,
    handleSave,
    handleExportCSVTemplate,
    openPreview,
    closePreview,
    addActions,
  }
}
