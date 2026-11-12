/** Question-type predicates with no UI imports, so Node can evaluate conditions. */

export const isChoiceType = (type) =>
  ['single_select', 'multi_select', 'dropdown'].includes(type)

export const isMatrixType = (type) => type === 'matrix'
