import { isChoiceType } from '@/utils/survey/questions/questionHelpers'
import { OPEN_TEXT_PLACEHOLDER, SPECIFY_PLACEHOLDER } from '@/constants/placeholders'
import { makeNavigationLock } from '@/constants/navigationLock'
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

const CATEGORY_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16']

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
      ? [makeOption('Option 1'), makeOption('Option 2'), makeOption('Option 3')]
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

    openTextConfig: {
      multiline: true,
      placeholder: OPEN_TEXT_PLACEHOLDER,
      minLength: null,
      maxLength: null,
      validation: {
        type: 'none',
        numberMin: null,
        numberMax: null,
      },
    },

    dateConfig: {
      format: 'MM/DD/YYYY',
      minDate: '',
      maxDate: '',
    },

    matrixConfig: {
      subType: 'single',
      rows: [makeMatrixRow('Row 1'), makeMatrixRow('Row 2'), makeMatrixRow('Row 3')],
      columns: [makeMatrixCol('Column 1'), makeMatrixCol('Column 2'), makeMatrixCol('Column 3')],
      randomizeRows: false,
    },

    bipolarConfig: {
      rows: [makeMatrixRow('Item 1'), makeMatrixRow('Item 2'), makeMatrixRow('Item 3')],
      leftColumns: [makeMatrixCol('Strongly Disagree'), makeMatrixCol('Disagree')],
      rightColumns: [makeMatrixCol('Agree'), makeMatrixCol('Strongly Agree')],
      showCenter: true,
      centerLabel: 'Neutral',
      leftLabel: 'Negative',
      rightLabel: 'Positive',
      leftSelectType: 'single',
      rightSelectType: 'single',
    },

    maxDiffConfig: {
      items: [
        makeMaxDiffItem('Item 1'), makeMaxDiffItem('Item 2'), makeMaxDiffItem('Item 3'),
        makeMaxDiffItem('Item 4'), makeMaxDiffItem('Item 5'),
      ],
      itemsPerTrial: 4,
      trialsPerRespondent: null,
      bestLabel:  'Most Important',
      worstLabel: 'Least Important',
      instruction: '',
      randomizeTrials: true,
    },

    cardSortConfig: {
      mode: 'closed',
      cards: [
        makeCardSortCard('Card 1'), makeCardSortCard('Card 2'),
        makeCardSortCard('Card 3'), makeCardSortCard('Card 4'),
        makeCardSortCard('Card 5'),
      ],
      categories: [
        makeCardSortCategory('Category A', CATEGORY_COLORS[0]),
        makeCardSortCategory('Category B', CATEGORY_COLORS[1]),
        makeCardSortCategory('Category C', CATEGORY_COLORS[2]),
      ],
      allowUncategorized: true,
      randomizeCards: true,
      instruction: '',
    },

    constantSumConfig: {
      targetSum: 100,
      items: [
        makeConstantSumItem('Item 1'),
        makeConstantSumItem('Item 2'),
        makeConstantSumItem('Item 3'),
      ],
      allowDecimals: false,
      showRemaining: true,
      unit: '%',
      instruction: '',
    },

    sliderConfig: {
      min: 1,
      max: 7,
      step: 1,
      defaultValue: null,
      showNumbers: true,
      labels: [
        makeSliderLabel(1, ''),
        makeSliderLabel(7, ''),
      ],
      instruction: '',
    },

    npsConfig: {
      minLabel:    'Not at all likely',
      maxLabel:    'Extremely likely',
      instruction: 'How likely are you to recommend us to a friend or colleague?',
      showScore:   true,
    },

    rankingConfig: {
      items: [
        makeRankingItem('Item 1'),
        makeRankingItem('Item 2'),
        makeRankingItem('Item 3'),
        makeRankingItem('Item 4'),
      ],
      instruction: '',
      rankAll:   true,
      topN:      3,
    },

    starRatingConfig: {
      stars:         5,
      allowHalf:     false,
      defaultValue:  null,
      icon:          'star',
      minLabel:      '',
      maxLabel:      '',
      instruction:   '',
    },

    textboxListConfig: {
      rows: [
        makeTextboxRow('Brand 1'),
        makeTextboxRow('Brand 2'),
        makeTextboxRow('Brand 3'),
      ],
      placeholder:  OPEN_TEXT_PLACEHOLDER,
      instruction:  '',
    },

    semanticDiffConfig: {
      rows: [
        makeSemanticRow('Bad', 'Good'),
        makeSemanticRow('Weak', 'Strong'),
        makeSemanticRow('Slow', 'Fast'),
      ],
      points:       7,
      defaultValue: null,
      showNumbers:  true,
      instruction:  '',
    },

    cascadeConfig: {
      levelLabels: ['Level 1', 'Level 2', 'Level 3'],
      items: [
        makeCascadeItem('Option A', 0, null),
        makeCascadeItem('Option B', 0, null),
      ],
      instruction: '',
    },

    imageChoiceConfig: {
      columns:      3,
      showLabels:   true,
      imageOptions: [
        makeImageOption('Option 1'),
        makeImageOption('Option 2'),
        makeImageOption('Option 3'),
      ],
      instruction: '',
    },
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
