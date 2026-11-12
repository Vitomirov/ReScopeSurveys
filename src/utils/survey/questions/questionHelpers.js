import {
  CircleDot, CheckSquare, ChevronDownSquare, AlignLeft,
  Calendar, Grid, ArrowLeftRight, BarChart2, Layers, Hash, SlidersHorizontal,
  RadioTower, Star, ListOrdered, AlignJustify,
  ArrowLeftRight as ArrowLR, Layers as LayersIcon, Image as ImageIcon,
} from 'lucide-react'

export { isChoiceType, isMatrixType } from './questionTypeFlags.js'

export const QUESTION_TYPES = [
  {
    type: 'single_select',
    label: 'Single Select',
    shortLabel: 'Single',
    description: 'One answer from a list',
    icon: '◉',
    group: 'Choice',
  },
  {
    type: 'multi_select',
    label: 'Multi Select',
    shortLabel: 'Multi',
    description: 'Multiple answers allowed',
    icon: '☑',
    group: 'Choice',
  },
  {
    type: 'dropdown',
    label: 'Dropdown',
    shortLabel: 'Dropdown',
    description: 'Select from a dropdown menu',
    icon: '▾',
    group: 'Choice',
  },
  {
    type: 'open_text',
    label: 'Open Text',
    shortLabel: 'Text',
    description: 'Free-form text response',
    icon: 'T',
    group: 'Text',
  },
  {
    type: 'date',
    label: 'Date',
    shortLabel: 'Date',
    description: 'Date picker with format options',
    icon: '📅',
    group: 'Input',
  },
  {
    type: 'matrix',
    label: 'Matrix Grid',
    shortLabel: 'Matrix',
    description: 'Grid of rows × columns',
    icon: '⊞',
    group: 'Grid',
  },
  {
    type: 'bipolar_matrix',
    label: 'Bipolar Matrix',
    shortLabel: 'Bipolar',
    description: 'Split grid with two poles',
    icon: '⇔',
    group: 'Grid',
  },
  {
    type: 'maxdiff',
    label: 'MaxDiff',
    shortLabel: 'MaxDiff',
    description: 'Best vs. worst across trials',
    icon: '⇕',
    group: 'Advanced',
  },
  {
    type: 'card_sort',
    label: 'Card Sort',
    shortLabel: 'Cards',
    description: 'Drag items into categories',
    icon: '≡',
    group: 'Advanced',
  },
  {
    type: 'constant_sum',
    label: 'Constant Sum',
    shortLabel: 'Sum',
    description: 'Values must total a set amount',
    icon: 'Σ',
    group: 'Advanced',
  },
  {
    type: 'slider',
    label: 'Slider',
    shortLabel: 'Slider',
    description: 'Single numeric scale with labels',
    icon: '—',
    group: 'Advanced',
  },
  {
    type: 'nps',
    label: 'NPS',
    shortLabel: 'NPS',
    description: 'Net Promoter Score (0–10)',
    icon: '◎',
    group: 'Scale',
  },
  {
    type: 'star_rating',
    label: 'Star Rating',
    shortLabel: 'Stars',
    description: 'Visual star / heart / thumb rating',
    icon: '★',
    group: 'Scale',
  },
  {
    type: 'ranking',
    label: 'Ranking',
    shortLabel: 'Rank',
    description: 'Drag items into ranked order',
    icon: '⇅',
    group: 'Advanced',
  },
  {
    type: 'textbox_list',
    label: 'Textbox List',
    shortLabel: 'Textboxes',
    description: 'Labeled rows with open text inputs',
    icon: '☰',
    group: 'Text',
  },
  {
    type: 'semantic_diff',
    label: 'Semantic Differential',
    shortLabel: 'Semantic',
    description: 'Rate between two polar opposites',
    icon: '↔',
    group: 'Scale',
  },
  {
    type: 'cascade',
    label: 'Cascading Dropdown',
    shortLabel: 'Cascade',
    description: '3-level linked dropdown menus',
    icon: '▽',
    group: 'Choice',
  },
  {
    type: 'image_choice_single',
    label: 'Image Choice (Single)',
    shortLabel: 'Img Single',
    description: 'Select one image from a grid',
    icon: '⊙',
    group: 'Choice',
  },
  {
    type: 'image_choice_multi',
    label: 'Image Choice (Multi)',
    shortLabel: 'Img Multi',
    description: 'Select multiple images from a grid',
    icon: '⊞',
    group: 'Choice',
  },
]

/** All question type keys — derived from QUESTION_TYPES (single source of truth). */
export const QUESTION_TYPE_KEYS = QUESTION_TYPES.map(t => t.type)

export const getTypeMeta = (type) =>
  QUESTION_TYPES.find(t => t.type === type) || QUESTION_TYPES[0]

export const TYPE_ICONS = {
  single_select:       CircleDot,
  multi_select:        CheckSquare,
  dropdown:            ChevronDownSquare,
  open_text:           AlignLeft,
  date:                Calendar,
  matrix:              Grid,
  bipolar_matrix:      ArrowLeftRight,
  maxdiff:             BarChart2,
  card_sort:           Layers,
  constant_sum:        Hash,
  slider:              SlidersHorizontal,
  nps:                 RadioTower,
  star_rating:         Star,
  ranking:             ListOrdered,
  textbox_list:        AlignJustify,
  semantic_diff:       ArrowLR,
  cascade:             LayersIcon,
  image_choice_single: ImageIcon,
  image_choice_multi:  ImageIcon,
}

export const TYPE_COLORS = {
  single_select:  { bg: 'bg-brand-50',    text: 'text-brand-600',    border: 'border-brand-200' },
  multi_select:   { bg: 'bg-violet-50',  text: 'text-violet-600',  border: 'border-violet-200' },
  dropdown:       { bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-200' },
  open_text:      { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  date:           { bg: 'bg-sky-50',     text: 'text-sky-600',     border: 'border-sky-200' },
  matrix:         { bg: 'bg-indigo-50',  text: 'text-indigo-600',  border: 'border-indigo-200' },
  bipolar_matrix: { bg: 'bg-fuchsia-50', text: 'text-fuchsia-600', border: 'border-fuchsia-200' },
  maxdiff:        { bg: 'bg-orange-50',  text: 'text-orange-600',  border: 'border-orange-200' },
  card_sort:      { bg: 'bg-teal-50',    text: 'text-teal-600',    border: 'border-teal-200' },
  constant_sum:   { bg: 'bg-cyan-50',    text: 'text-cyan-600',    border: 'border-cyan-200' },
  slider:         { bg: 'bg-violet-50',  text: 'text-violet-600',  border: 'border-violet-200' },
  nps:            { bg: 'bg-rose-50',    text: 'text-rose-600',    border: 'border-rose-200' },
  star_rating:    { bg: 'bg-yellow-50',  text: 'text-yellow-600',  border: 'border-yellow-200' },
  ranking:        { bg: 'bg-lime-50',    text: 'text-lime-600',    border: 'border-lime-200' },
  textbox_list:   { bg: 'bg-sky-50',     text: 'text-sky-600',     border: 'border-sky-200' },
  semantic_diff:  { bg: 'bg-fuchsia-50', text: 'text-fuchsia-600', border: 'border-fuchsia-200' },
  cascade:        { bg: 'bg-indigo-50',  text: 'text-indigo-600',  border: 'border-indigo-200' },
  image_choice_single: { bg: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-200' },
  image_choice_multi:  { bg: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-200' },
}

// Group question types by category for the Add Question panel
export const QUESTION_TYPE_GROUPS = ['Choice', 'Text', 'Input', 'Grid', 'Scale', 'Advanced']

/** Map question id → 1-based display number (single O(n) pass). */
export function buildQuestionNumberById(items) {
  const map = {}
  let n = 0
  for (const item of items) {
    if (item.itemType === 'question') {
      n++
      map[item.id] = n
    }
  }
  return map
}
