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
  { topic: 'Sheets', detail: 'Required: Survey, Items, Options. Optional: Logic, Matrix. Reference: QuestionTypes, Authoring, README.' },
  { topic: 'How to use', detail: 'Fill sheets → save .xlsx → Dashboard → Import. Survey lands as pending; QA in builder before Draft/Live.' },
  { topic: 'Codes', detail: 'Stable unique codes (Q1, Q1_O1, PB1, Q8_R1). Letter first; letters, numbers, underscore.' },
  { topic: 'Screenout (simple)', detail: 'Options.terminates=Y — fires when that option is selected (any multi-select hit).' },
  { topic: 'Screenout (combo)', detail: 'Do NOT use terminates=Y. Use Items.terminationLogic=if_none + Logic rows for qualifying options (see Authoring).' },
  { topic: 'Skip-to-page', detail: 'Logic action=branch + targetPageCode= page_break code (or __start__).' },
  { topic: 'Settings', detail: 'Survey sheet keys: onePerPage, disableBackButton, showProgressBar, fingerprinting, navigationLockAllPagesSeconds, screen message titles.' },
  { topic: 'Senior builder', detail: 'Only add logic/settings the brief needs. See Authoring sheet. Docs: docs/SURVEY_IMPORT.md' },
]
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(readme), 'README')

const authoring = [
  { rule: 'Prefer option terminates=Y for hard single-choice screenouts (age, city, industry).', when: 'Screener / quota fail' },
  { rule: 'Use terminationLogic=if_none + Logic when screenout is “lacks any of X” (e.g. only Turkish/instant).', when: 'Combo multi-select screenout' },
  { rule: 'Add branch Logic only for real skips (e.g. non-buyers skip purchase block). Do not invent skips.', when: 'Main questionnaire routing' },
  { rule: 'disableBackButton=Y on screeners so respondents cannot undo a screenout path.', when: 'Most quantitative screeners' },
  { rule: 'fingerprinting=Y for online/panel; leave N for CAPI / moderated.', when: 'Fraud / duplicate control' },
  { rule: 'navigationLockAllPagesSeconds only when quality brief requires dwell time; else leave blank.', when: 'Forced stay' },
  { rule: 'onePerPage=Y for screeners; consider N for short attitudinal batteries on one page.', when: 'Page layout' },
  { rule: 'Matrix sheet for importance grids; Tier B types import as stubs — finish in builder.', when: 'Ratings / advanced types' },
  { rule: 'Do not enable every setting on every survey. Mimic a senior MR programmer: minimal correct logic.', when: 'Always' },
]
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(authoring), 'Authoring')

const questionTypes = IMPORT_TYPE_REFERENCE.map(row => ({
  questionType: row.questionType,
  tier: row.tier,
  label: row.label,
  textOutline: row.textOutline,
  workbook: row.workbook,
}))
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(questionTypes), 'QuestionTypes')

const survey = [
  { key: 'title', value: 'Import reference — logic, settings, all question types' },
  { key: 'internalName', value: 'Import template showcase' },
  { key: 'surveyCode', value: 'IMPORTREF' },
  { key: 'description', value: 'Demo workbook for ReScope survey import (Excel).' },
  { key: 'clientName', value: '' },
  { key: 'topicName', value: '' },
  { key: 'surveyTypeName', value: '' },
  { key: 'showCoverPage', value: 'Y' },
  { key: 'startButtonText', value: 'Start Survey' },
  { key: 'onePerPage', value: 'Y' },
  { key: 'disableBackButton', value: 'N' },
  { key: 'showProgressBar', value: 'Y' },
  { key: 'fingerprinting', value: 'N' },
  { key: 'navigationLockAllPagesSeconds', value: '' },
  { key: 'terminateTitle', value: 'Thank you for your time.' },
  { key: 'terminateMessage', value: 'Unfortunately, you do not qualify for this survey.' },
]
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(survey), 'Survey')

const items = [
  { code: 'TB1', itemType: 'text_block', questionType: '', text: '', required: '', title: 'Welcome', content: 'Demo workbook: settings, Logic sheet, Matrix sheet, and every import question type.', multiline: '', randomizeOptions: '', terminationLogic: '', branchLogic: '', branchNoneTargetCode: '', navigationLockSeconds: '' },
  { code: 'Q1', itemType: 'question', questionType: 'single_select', text: 'Do you currently buy this category?', required: 'Y', title: '', content: '', multiline: '', randomizeOptions: 'N', terminationLogic: '', branchLogic: 'if_any', branchNoneTargetCode: '', navigationLockSeconds: '' },
  { code: 'Q2', itemType: 'question', questionType: 'multi_select', text: 'Which formats do you use? (Select all that apply)', required: 'Y', title: '', content: '', multiline: '', randomizeOptions: 'N', terminationLogic: 'if_none', branchLogic: '', branchNoneTargetCode: '', navigationLockSeconds: '' },
  { code: 'Q3', itemType: 'question', questionType: 'dropdown', text: 'Dropdown example', required: 'Y', title: '', content: '', multiline: '', randomizeOptions: '', terminationLogic: '', branchLogic: '', branchNoneTargetCode: '', navigationLockSeconds: '' },
  { code: 'Q4', itemType: 'question', questionType: 'open_text', text: 'Short open text', required: 'N', title: '', content: '', multiline: 'N', randomizeOptions: '', terminationLogic: '', branchLogic: '', branchNoneTargetCode: '', navigationLockSeconds: '' },
  { code: 'Q5', itemType: 'question', questionType: 'open_text', text: 'Long open text', required: 'N', title: '', content: '', multiline: 'Y', randomizeOptions: '', terminationLogic: '', branchLogic: '', branchNoneTargetCode: '', navigationLockSeconds: '' },
  { code: 'PB1', itemType: 'page_break', questionType: '', text: '', required: '', title: '', content: '', multiline: '', randomizeOptions: '', terminationLogic: '', branchLogic: '', branchNoneTargetCode: '', navigationLockSeconds: '' },
  { code: 'Q6', itemType: 'question', questionType: 'matrix', text: 'How important is each factor? (1–5)', required: 'Y', title: '', content: '', multiline: '', randomizeOptions: '', terminationLogic: '', branchLogic: '', branchNoneTargetCode: '', navigationLockSeconds: '' },
  { code: 'Q7', itemType: 'question', questionType: 'nps', text: 'NPS likelihood to recommend', required: 'Y', title: '', content: '', multiline: '', randomizeOptions: '', terminationLogic: '', branchLogic: '', branchNoneTargetCode: '', navigationLockSeconds: '' },
  { code: 'Q8', itemType: 'question', questionType: 'slider', text: 'Slider confidence', required: 'Y', title: '', content: '', multiline: '', randomizeOptions: '', terminationLogic: '', branchLogic: '', branchNoneTargetCode: '', navigationLockSeconds: '' },
  { code: 'Q9', itemType: 'question', questionType: 'star_rating', text: 'Star rating', required: 'Y', title: '', content: '', multiline: '', randomizeOptions: '', terminationLogic: '', branchLogic: '', branchNoneTargetCode: '', navigationLockSeconds: '' },
  { code: 'Q10', itemType: 'question', questionType: 'date', text: 'Date last used', required: 'N', title: '', content: '', multiline: '', randomizeOptions: '', terminationLogic: '', branchLogic: '', branchNoneTargetCode: '', navigationLockSeconds: '' },
  { code: 'Q11', itemType: 'question', questionType: 'phone', text: 'Phone for follow-up', required: 'N', title: '', content: '', multiline: '', randomizeOptions: '', terminationLogic: '', branchLogic: '', branchNoneTargetCode: '', navigationLockSeconds: '' },
  { code: 'Q12', itemType: 'question', questionType: 'ranking', text: 'Ranking — order these', required: 'Y', title: '', content: '', multiline: '', randomizeOptions: '', terminationLogic: '', branchLogic: '', branchNoneTargetCode: '', navigationLockSeconds: '' },
  { code: 'Q13', itemType: 'question', questionType: 'constant_sum', text: 'Constant sum allocation', required: 'Y', title: '', content: '', multiline: '', randomizeOptions: '', terminationLogic: '', branchLogic: '', branchNoneTargetCode: '', navigationLockSeconds: '' },
  { code: 'Q14', itemType: 'question', questionType: 'card_sort', text: 'Card sort exercise', required: 'Y', title: '', content: '', multiline: '', randomizeOptions: '', terminationLogic: '', branchLogic: '', branchNoneTargetCode: '', navigationLockSeconds: '' },
  { code: 'Q15', itemType: 'question', questionType: 'maxdiff', text: 'MaxDiff priorities', required: 'Y', title: '', content: '', multiline: '', randomizeOptions: '', terminationLogic: '', branchLogic: '', branchNoneTargetCode: '', navigationLockSeconds: '' },
  { code: 'Q16', itemType: 'question', questionType: 'semantic_diff', text: 'Semantic differential', required: 'Y', title: '', content: '', multiline: '', randomizeOptions: '', terminationLogic: '', branchLogic: '', branchNoneTargetCode: '', navigationLockSeconds: '' },
  { code: 'Q17', itemType: 'question', questionType: 'bipolar_matrix', text: 'Bipolar matrix', required: 'Y', title: '', content: '', multiline: '', randomizeOptions: '', terminationLogic: '', branchLogic: '', branchNoneTargetCode: '', navigationLockSeconds: '' },
  { code: 'Q18', itemType: 'question', questionType: 'cascade', text: 'Cascading dropdown', required: 'Y', title: '', content: '', multiline: '', randomizeOptions: '', terminationLogic: '', branchLogic: '', branchNoneTargetCode: '', navigationLockSeconds: '' },
  { code: 'Q19', itemType: 'question', questionType: 'textbox_list', text: 'Textbox list (brands)', required: 'N', title: '', content: '', multiline: '', randomizeOptions: '', terminationLogic: '', branchLogic: '', branchNoneTargetCode: '', navigationLockSeconds: '' },
  { code: 'Q20', itemType: 'question', questionType: 'image_choice_single', text: 'Image choice single (add images in builder)', required: 'Y', title: '', content: '', multiline: '', randomizeOptions: '', terminationLogic: '', branchLogic: '', branchNoneTargetCode: '', navigationLockSeconds: '' },
  { code: 'Q21', itemType: 'question', questionType: 'image_choice_multi', text: 'Image choice multi', required: 'Y', title: '', content: '', multiline: '', randomizeOptions: '', terminationLogic: '', branchLogic: '', branchNoneTargetCode: '', navigationLockSeconds: '' },
]
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(items), 'Items')

const options = [
  { questionCode: 'Q1', optionCode: 'Q1_O1', text: 'Yes', terminates: 'N', isExclusive: 'N' },
  { questionCode: 'Q1', optionCode: 'Q1_O2', text: 'No — skip purchase block', terminates: 'N', isExclusive: 'N' },
  { questionCode: 'Q1', optionCode: 'Q1_O3', text: 'Screenout', terminates: 'Y', isExclusive: 'N' },
  { questionCode: 'Q2', optionCode: 'Q2_O1', text: 'Traditional only path', terminates: 'N', isExclusive: 'N' },
  { questionCode: 'Q2', optionCode: 'Q2_O2', text: 'Target format A', terminates: 'N', isExclusive: 'N' },
  { questionCode: 'Q2', optionCode: 'Q2_O3', text: 'Target format B', terminates: 'N', isExclusive: 'N' },
  { questionCode: 'Q2', optionCode: 'Q2_O4', text: 'None of the above', terminates: 'N', isExclusive: 'Y' },
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

const logic = [
  { questionCode: 'Q1', action: 'branch', optionCodes: 'Q1_O2', matchMode: 'any', targetPageCode: 'PB1', note: 'Non-buyers skip to after purchase block', ruleType: 'choice', textOperator: '', textValue: '', textValue2: '', matrixRowCode: '', matrixColumnCodes: '' },
  { questionCode: 'Q2', action: 'terminate', optionCodes: 'Q2_O2,Q2_O3', matchMode: 'any', targetPageCode: '', note: 'Must use at least one target format (if_none on question)', ruleType: 'choice', textOperator: '', textValue: '', textValue2: '', matrixRowCode: '', matrixColumnCodes: '' },
]
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(logic), 'Logic')

const matrix = [
  { questionCode: 'Q6', axis: 'row', text: 'Price', code: 'Q6_R1' },
  { questionCode: 'Q6', axis: 'row', text: 'Taste / intensity', code: 'Q6_R2' },
  { questionCode: 'Q6', axis: 'row', text: 'Bean origin', code: 'Q6_R3' },
  { questionCode: 'Q6', axis: 'col', text: '1 — Not important', code: 'Q6_C1' },
  { questionCode: 'Q6', axis: 'col', text: '2', code: 'Q6_C2' },
  { questionCode: 'Q6', axis: 'col', text: '3', code: 'Q6_C3' },
  { questionCode: 'Q6', axis: 'col', text: '4', code: 'Q6_C4' },
  { questionCode: 'Q6', axis: 'col', text: '5 — Extremely important', code: 'Q6_C5' },
]
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matrix), 'Matrix')

writeFileSync(outPath, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
console.log(`Wrote ${outPath}`)
console.log(`Wrote ${txtPath}`)
