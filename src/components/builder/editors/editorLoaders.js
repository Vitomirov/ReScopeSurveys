/** Dynamic import loaders for question-type editors — one chunk per type. */
export const EDITOR_LOADERS = {
  open_text:           () => import('./basic/OpenTextEditor.jsx'),
  date:                () => import('./basic/DateEditor.jsx'),
  phone:               () => import('./basic/PhoneEditor.jsx'),
  matrix:              () => import('./matrix/MatrixEditor.jsx'),
  bipolar_matrix:      () => import('./matrix/BipolarMatrixEditor.jsx'),
  maxdiff:             () => import('./structured/MaxDiffEditor.jsx'),
  card_sort:           () => import('./structured/CardSortEditor.jsx'),
  constant_sum:        () => import('./structured/ConstantSumEditor.jsx'),
  slider:              () => import('./scale/SliderEditor.jsx'),
  nps:                 () => import('./scale/NpsEditor.jsx'),
  star_rating:         () => import('./scale/StarRatingEditor.jsx'),
  ranking:             () => import('./structured/RankingEditor.jsx'),
  textbox_list:        () => import('./structured/TextboxListEditor.jsx'),
  semantic_diff:       () => import('./scale/SemanticDiffEditor.jsx'),
  cascade:             () => import('./structured/CascadeEditor.jsx'),
  image_choice_single: () => import('./structured/ImageChoiceEditor.jsx'),
  image_choice_multi:  () => import('./structured/ImageChoiceEditor.jsx'),
}

/** Choice types (single/multi/dropdown) share one editor chunk. */
export const loadChoiceEditor = () => import('./choice/ChoiceEditor.jsx')
