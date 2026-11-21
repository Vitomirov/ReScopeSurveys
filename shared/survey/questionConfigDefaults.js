/**
 * Default *Config fields for builder questions — single source for client factories and server import.
 * @param {() => string} newId
 * @param {{ openTextPlaceholder?: string, specifyPlaceholder?: string }} [placeholders]
 */
export function createQuestionConfigBundle(newId, placeholders = {}) {
  const openPh = placeholders.openTextPlaceholder ?? 'Your answer'
  const specPh = placeholders.specifyPlaceholder ?? 'Please specify'

  const matrixRow = (text) => ({ id: newId(), text })
  const matrixCol = (text) => ({ id: newId(), text })
  const CATEGORY_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']

  return {
    openTextConfig: {
      multiline: false,
      placeholder: openPh,
      minLength: null,
      maxLength: null,
      validation: { type: 'none', numberMin: null, numberMax: null },
    },

    dateConfig: {
      format: 'inherit',
      minDate: '',
      maxDate: '',
    },

    matrixConfig: {
      subType: 'single',
      rows: [matrixRow('Row 1'), matrixRow('Row 2'), matrixRow('Row 3')],
      columns: [matrixCol('Column 1'), matrixCol('Column 2'), matrixCol('Column 3')],
      randomizeRows: false,
    },

    bipolarConfig: {
      rows: [matrixRow('Item 1'), matrixRow('Item 2'), matrixRow('Item 3')],
      leftColumns: [matrixCol('Strongly Disagree'), matrixCol('Disagree')],
      rightColumns: [matrixCol('Agree'), matrixCol('Strongly Agree')],
      showCenter: true,
      centerLabel: 'Neutral',
      leftLabel: 'Negative',
      rightLabel: 'Positive',
      leftSelectType: 'single',
      rightSelectType: 'single',
    },

    maxDiffConfig: {
      items: [
        { id: newId(), text: 'Item 1' },
        { id: newId(), text: 'Item 2' },
        { id: newId(), text: 'Item 3' },
        { id: newId(), text: 'Item 4' },
        { id: newId(), text: 'Item 5' },
      ],
      itemsPerTrial: 4,
      trialsPerRespondent: null,
      bestLabel: 'Most Important',
      worstLabel: 'Least Important',
      instruction: '',
      randomizeTrials: true,
    },

    cardSortConfig: {
      mode: 'closed',
      cards: [
        { id: newId(), text: 'Card 1', description: '' },
        { id: newId(), text: 'Card 2', description: '' },
        { id: newId(), text: 'Card 3', description: '' },
        { id: newId(), text: 'Card 4', description: '' },
        { id: newId(), text: 'Card 5', description: '' },
      ],
      categories: [
        { id: newId(), label: 'Category A', color: CATEGORY_COLORS[0] },
        { id: newId(), label: 'Category B', color: CATEGORY_COLORS[1] },
        { id: newId(), label: 'Category C', color: CATEGORY_COLORS[2] },
      ],
      allowUncategorized: true,
      randomizeCards: true,
      instruction: '',
    },

    constantSumConfig: {
      targetSum: 100,
      items: [
        { id: newId(), label: 'Item 1' },
        { id: newId(), label: 'Item 2' },
        { id: newId(), label: 'Item 3' },
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
        { id: newId(), value: 1, label: '' },
        { id: newId(), value: 7, label: '' },
      ],
      instruction: '',
    },

    npsConfig: {
      minLabel: 'Not at all likely',
      maxLabel: 'Extremely likely',
      instruction: 'How likely are you to recommend us to a friend or colleague?',
      showScore: true,
    },

    rankingConfig: {
      items: [
        { id: newId(), text: 'Item 1' },
        { id: newId(), text: 'Item 2' },
        { id: newId(), text: 'Item 3' },
        { id: newId(), text: 'Item 4' },
      ],
      instruction: '',
      rankAll: true,
      topN: 3,
    },

    starRatingConfig: {
      stars: 5,
      allowHalf: false,
      defaultValue: null,
      icon: 'star',
      minLabel: '',
      maxLabel: '',
      instruction: '',
    },

    textboxListConfig: {
      rows: [
        { id: newId(), label: 'Brand 1' },
        { id: newId(), label: 'Brand 2' },
        { id: newId(), label: 'Brand 3' },
      ],
      placeholder: openPh,
      instruction: '',
    },

    semanticDiffConfig: {
      rows: [
        { id: newId(), leftLabel: 'Bad', rightLabel: 'Good' },
        { id: newId(), leftLabel: 'Weak', rightLabel: 'Strong' },
        { id: newId(), leftLabel: 'Slow', rightLabel: 'Fast' },
      ],
      points: 7,
      defaultValue: null,
      showNumbers: true,
      instruction: '',
    },

    cascadeConfig: {
      levelLabels: ['Level 1', 'Level 2', 'Level 3'],
      items: [
        { id: newId(), label: 'Option A', level: 0, parentId: null },
        { id: newId(), label: 'Option B', level: 0, parentId: null },
      ],
      instruction: '',
    },

    imageChoiceConfig: {
      columns: 3,
      showLabels: true,
      imageOptions: [{
        id: newId(),
        text: '',
        image: null,
        imageAlt: '',
        terminates: false,
        isExclusive: false,
        openText: { enabled: false, placeholder: specPh },
      }],
      instruction: '',
    },
  }
}