/**
 * Writes public/templates/survey-import-template.xlsx and text outline sample.
 * Re-run after layout changes: node scripts/dev/generate-survey-import-template.mjs
 */
import * as XLSX from '../../server/node_modules/xlsx/xlsx.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { IMPORT_TYPE_REFERENCE } from '../../shared/surveyImport/importTypeCatalog.js'
import { TEXT_OUTLINE_SAMPLE } from '../../shared/surveyImport/textOutlineSample.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const templatesDir = resolve(__dirname, '../../public/templates')
const outPath = resolve(templatesDir, 'survey-import-template.xlsx')
const txtPath = resolve(templatesDir, 'survey-import-text-outline-sample.txt')

mkdirSync(templatesDir, { recursive: true })
writeFileSync(txtPath, TEXT_OUTLINE_SAMPLE, 'utf8')

const wb = XLSX.utils.book_new()

const readme = [
  { topic: 'How to use', detail: 'Fill Survey, Items, and Options sheets. Save as .xlsx and upload via Dashboard → Import.' },
  { topic: 'Status after import', detail: 'Surveys land as pending. Set Draft or Live in the builder after QA.' },
  { topic: 'Codes', detail: 'Stable codes (Q1, Q1_O1, PB1). Unique. Letter first; letters, numbers, underscore.' },
  { topic: 'Question types', detail: 'See QuestionTypes sheet for all supported questionType values (tier A = full, B = finish in builder).' },
  { topic: 'Text outline', detail: 'See survey-import-text-outline-sample.txt — same rules as Dashboard → Import → Text.' },
  { topic: 'Docs', detail: 'docs/SURVEY_IMPORT.md' },
]
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(readme), 'README')

const questionTypes = IMPORT_TYPE_REFERENCE.map(row => ({
  questionType: row.questionType,
  tier: row.tier,
  label: row.label,
  textOutline: row.textOutline,
  workbook: row.workbook,
}))
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(questionTypes), 'QuestionTypes')

const survey = [
  { key: 'title', value: 'Import reference — all question types (demo)' },
  { key: 'internalName', value: 'Import template showcase' },
  { key: 'surveyCode', value: 'IMPORTREF' },
  { key: 'clientName', value: '' },
  { key: 'topicName', value: '' },
  { key: 'surveyTypeName', value: '' },
]
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(survey), 'Survey')

const items = [
  { code: 'TB1', itemType: 'text_block', questionType: '', text: '', required: '', title: 'Welcome', content: 'Demo workbook with every import question type.' },
  { code: 'Q1', itemType: 'question', questionType: 'single_select', text: 'Single select example', required: 'Y' },
  { code: 'Q2', itemType: 'question', questionType: 'multi_select', text: 'Multi select (select all that apply)', required: 'Y' },
  { code: 'Q3', itemType: 'question', questionType: 'dropdown', text: 'Dropdown example', required: 'Y' },
  { code: 'Q4', itemType: 'question', questionType: 'open_text', text: 'Short open text', required: 'N' },
  { code: 'Q5', itemType: 'question', questionType: 'open_text', text: 'Long open text (multiline in builder)', required: 'N' },
  { code: 'PB1', itemType: 'page_break', questionType: '', text: '', required: '' },
  { code: 'Q6', itemType: 'question', questionType: 'matrix', text: 'Matrix — configure rows/columns in builder', required: 'Y' },
  { code: 'Q7', itemType: 'question', questionType: 'nps', text: 'NPS likelihood to recommend', required: 'Y' },
  { code: 'Q8', itemType: 'question', questionType: 'slider', text: 'Slider confidence', required: 'Y' },
  { code: 'Q9', itemType: 'question', questionType: 'star_rating', text: 'Star rating', required: 'Y' },
  { code: 'Q10', itemType: 'question', questionType: 'date', text: 'Date last used', required: 'N' },
  { code: 'Q11', itemType: 'question', questionType: 'phone', text: 'Phone for follow-up', required: 'N' },
  { code: 'Q12', itemType: 'question', questionType: 'ranking', text: 'Ranking — order these', required: 'Y' },
  { code: 'Q13', itemType: 'question', questionType: 'constant_sum', text: 'Constant sum allocation', required: 'Y' },
  { code: 'Q14', itemType: 'question', questionType: 'card_sort', text: 'Card sort exercise', required: 'Y' },
  { code: 'Q15', itemType: 'question', questionType: 'maxdiff', text: 'MaxDiff priorities', required: 'Y' },
  { code: 'Q16', itemType: 'question', questionType: 'semantic_diff', text: 'Semantic differential', required: 'Y' },
  { code: 'Q17', itemType: 'question', questionType: 'bipolar_matrix', text: 'Bipolar matrix', required: 'Y' },
  { code: 'Q18', itemType: 'question', questionType: 'cascade', text: 'Cascading dropdown', required: 'Y' },
  { code: 'Q19', itemType: 'question', questionType: 'textbox_list', text: 'Textbox list (brands)', required: 'N' },
  { code: 'Q20', itemType: 'question', questionType: 'image_choice_single', text: 'Image choice single (add images in builder)', required: 'Y' },
  { code: 'Q21', itemType: 'question', questionType: 'image_choice_multi', text: 'Image choice multi', required: 'Y' },
]
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(items), 'Items')

const options = [
  { questionCode: 'Q1', optionCode: 'Q1_O1', text: 'Option A', terminates: 'N', isExclusive: 'N' },
  { questionCode: 'Q1', optionCode: 'Q1_O2', text: 'Option B', terminates: 'N', isExclusive: 'N' },
  { questionCode: 'Q1', optionCode: 'Q1_O3', text: 'Screenout', terminates: 'Y', isExclusive: 'N' },
  { questionCode: 'Q2', optionCode: 'Q2_O1', text: 'Feature one', terminates: 'N', isExclusive: 'N' },
  { questionCode: 'Q2', optionCode: 'Q2_O2', text: 'Feature two', terminates: 'N', isExclusive: 'N' },
  { questionCode: 'Q2', optionCode: 'Q2_O3', text: 'None of the above', terminates: 'N', isExclusive: 'Y' },
  { questionCode: 'Q3', optionCode: 'Q3_O1', text: 'North', terminates: 'N', isExclusive: 'N' },
  { questionCode: 'Q3', optionCode: 'Q3_O2', text: 'South', terminates: 'N', isExclusive: 'N' },
  { questionCode: 'Q12', optionCode: 'Q12_O1', text: 'Speed', terminates: 'N', isExclusive: 'N' },
  { questionCode: 'Q12', optionCode: 'Q12_O2', text: 'Cost', terminates: 'N', isExclusive: 'N' },
  { questionCode: 'Q12', optionCode: 'Q12_O3', text: 'Support', terminates: 'N', isExclusive: 'N' },
  { questionCode: 'Q13', optionCode: 'Q13_O1', text: 'Innovation', terminates: 'N', isExclusive: 'N' },
  { questionCode: 'Q13', optionCode: 'Q13_O2', text: 'Reliability', terminates: 'N', isExclusive: 'N' },
  { questionCode: 'Q14', optionCode: 'Q14_O1', text: 'Card A', terminates: 'N', isExclusive: 'N' },
  { questionCode: 'Q14', optionCode: 'Q14_O2', text: 'Card B', terminates: 'N', isExclusive: 'N' },
  { questionCode: 'Q15', optionCode: 'Q15_O1', text: 'Factor 1', terminates: 'N', isExclusive: 'N' },
  { questionCode: 'Q15', optionCode: 'Q15_O2', text: 'Factor 2', terminates: 'N', isExclusive: 'N' },
  { questionCode: 'Q19', optionCode: 'Q19_O1', text: 'Brand A', terminates: 'N', isExclusive: 'N' },
  { questionCode: 'Q19', optionCode: 'Q19_O2', text: 'Brand B', terminates: 'N', isExclusive: 'N' },
]
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(options), 'Options')

writeFileSync(outPath, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
console.log(`Wrote ${outPath}`)
console.log(`Wrote ${txtPath}`)