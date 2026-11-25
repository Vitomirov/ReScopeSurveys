import { isChoiceType } from '@/utils/survey/questions/questionHelpers'
import { OPEN_TEXT_PLACEHOLDER, SPECIFY_PLACEHOLDER } from '@/constants/survey/placeholders'
import { makeNavigationLock } from '@/constants/survey/navigationLock'
import { createQuestionConfigBundle } from '@shared/survey/questionConfigDefaults.js'
import { newId } from './id'

// ─── Factory helpers ───────────────────────────────────────────────────────
export const makeOption = (text = '') => ({
  id: newId(),
  text,
  anchorPosition: null,
  isExclusive: false,
  terminates: false,
  openText: { enabled: false, required: false, placeholder: SPECIFY_PLACEHOLDER },
})

export const makeMatrixRow = (text = '') => ({ id: newId(), text })
export const makeMatrixCol = (text = '') => ({ id: newId(), text })
export const makeMaxDiffItem      = (text = '') => ({ id: newId(), text })
export const makeCardSortCard     = (text = '', description = '') => ({ id: newId(), text, description })
export const makeCardSortCategory = (label = 'Category', color = '#6366f1') => ({ id: newId(), label, color })
export const makeConstantSumItem  = (label = '') => ({ id: newId(), label })
export const makeSliderLabel      = (value, label = '') => ({ id: newId(), value, label })
export const makeRankingItem      = (text = '') => ({ id: newId(), text })
export const makeTextboxRow       = (label = '') => ({ id: newId(), label })
export const makeImageOption      = (text = '') => ({
  id:          newId(),
  text,
  image:       null,
  imageAlt:    '',
  terminates:  false,
  isExclusive: false,
  openText:    { enabled: false, placeholder: SPECIFY_PLACEHOLDER },
})
export const makeSemanticRow      = (leftLabel = '', rightLabel = '') => ({ id: newId(), leftLabel, rightLabel })
export const makeCascadeItem      = (label = '', level = 0, parentId = null) => ({ id: newId(), label, level, parentId })

export const makeVisibilityCondition = (isFirst = false) => ({
  id: newId(),
  join: isFirst ? null : 'AND',
  questionId: '',
  conditionType: 'any_of',
  optionIds: [],
  matrixRowId: '',
  matrixColumnIds: [],
  textOperator: 'contains',
  textValue: '',
  textValue2: '',
})

export const makeVisibilityConfig = () => ({
  enabled: false,
  mode: 'show_if',
  conditions: [],
})

export const makeQuestion = (questionType = 'single_select') => {
  const isChoice = isChoiceType(questionType)
  const typeConfigs = createQuestionConfigBundle(newId, {
    openTextPlaceholder: OPEN_TEXT_PLACEHOLDER,
    specifyPlaceholder: SPECIFY_PLACEHOLDER,
  })

  return {
    id: newId(),
    itemType: 'question',
    questionType,
    text: '',
    required: true,
    groupId: null,
    isEmailField: false,

    pipedOptionsConfig: {
      enabled:          false,
      sourceQuestionId: null,
      matrixRowId:      null,
      matrixPipeMode:   'rows',
    },
    visibility: makeVisibilityConfig(),

    options: isChoice
      ? [makeOption()]
      : [],
    minSelections: null,
    maxSelections: null,
    randomizeOptions: false,
    terminationRules: [],
    terminationLogic: 'if_any',
    branchRules: [],
    branchLogic: 'if_any',
    branchNoneTargetPageBreakId: '',
    externalRedirectRules: [],
    externalRedirectLogic: 'if_any',
    externalRedirectNoneUrl: '',

    ...typeConfigs,
  }
}

export const makePageBreak = () => ({
  id: newId(),
  itemType: 'page_break',
  visibility: makeVisibilityConfig(),
  navigationLock: makeNavigationLock(),
})

export const makeGroup = (title = 'New Group') => ({
  id: newId(),
  itemType: 'group',
  title,
  collapsed: false,
  color: null,
  visibility: makeVisibilityConfig(),
  navigationLock: makeNavigationLock(),
})

export const makeTerminationCondition = (isFirst = false) => ({
  id: newId(),
  join: isFirst ? null : 'AND',
  questionId: '',
  conditionType: 'any_of',
  optionIds: [],
  matrixRowId: '',
  matrixColumnIds: [],
  textOperator: 'contains',
  textValue: '',
  textValue2: '',
})

export const makeTerminationBlock = () => ({
  id: newId(),
  itemType: 'termination_block',
  title: '',
  conditions: [],
})

export const makeTextBlock = () => ({
  id: newId(),
  itemType: 'text_block',
  title: '',
  content: '',
  image: null,
  imageCaption: '',
  visibility: makeVisibilityConfig(),
})