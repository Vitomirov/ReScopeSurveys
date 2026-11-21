/**
 * Writes public/templates/survey-import-template.xlsx (ReScope import workbook).
 * Re-run after changing sheet layout: node scripts/dev/generate-survey-import-template.mjs
 */
import * as XLSX from '../../server/node_modules/xlsx/xlsx.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = resolve(__dirname, '../../public/templates/survey-import-template.xlsx')

mkdirSync(dirname(outPath), { recursive: true })

const wb = XLSX.utils.book_new()

const readme = [
  { topic: 'How to use', detail: 'Fill Survey, Items, and Options sheets. Save as .xlsx and upload via Dashboard → Import.' },
  { topic: 'Status after import', detail: 'Surveys land as In review. Set Draft or Live in the builder after QA.' },
  { topic: 'Codes', detail: 'Use stable codes (Q1, Q1_O1, PB1). Must be unique. Letters, numbers, underscore.' },
  { topic: 'Docs', detail: 'See docs/SURVEY_IMPORT.md in the product repo.' },
]
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(readme), 'README')

const survey = [
  { key: 'title', value: 'Example customer satisfaction study' },
  { key: 'internalName', value: 'CSAT 2026 import demo' },
  { key: 'surveyCode', value: 'CSAT01' },
  { key: 'clientName', value: '' },
  { key: 'topicName', value: '' },
  { key: 'surveyTypeName', value: '' },
]
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(survey), 'Survey')

const items = [
  {
    code: 'Q1',
    itemType: 'question',
    questionType: 'single_select',
    text: 'How satisfied are you with our product overall?',
    required: 'Y',
  },
  {
    code: 'Q2',
    itemType: 'question',
    questionType: 'multi_select',
    text: 'Which features do you use regularly? (Select all that apply)',
    required: 'Y',
  },
  {
    code: 'Q3',
    itemType: 'question',
    questionType: 'open_text',
    text: 'What is your current job title?',
    required: 'N',
  },
  {
    code: 'Q4',
    itemType: 'question',
    questionType: 'open_text',
    text: 'Please share any additional feedback.',
    required: 'N',
  },
]
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(items), 'Items')

const options = [
  { questionCode: 'Q1', optionCode: 'Q1_O1', text: 'Very satisfied', terminates: 'N', isExclusive: 'N' },
  { questionCode: 'Q1', optionCode: 'Q1_O2', text: 'Somewhat satisfied', terminates: 'N', isExclusive: 'N' },
  { questionCode: 'Q1', optionCode: 'Q1_O3', text: 'Neutral', terminates: 'N', isExclusive: 'N' },
  { questionCode: 'Q1', optionCode: 'Q1_O4', text: 'Somewhat dissatisfied', terminates: 'N', isExclusive: 'N' },
  { questionCode: 'Q1', optionCode: 'Q1_O5', text: 'Very dissatisfied', terminates: 'Y', isExclusive: 'N' },
  { questionCode: 'Q2', optionCode: 'Q2_O1', text: 'Reporting and Analytics', terminates: 'N', isExclusive: 'N' },
  { questionCode: 'Q2', optionCode: 'Q2_O2', text: 'Automated Workflows', terminates: 'N', isExclusive: 'N' },
  { questionCode: 'Q2', optionCode: 'Q2_O3', text: 'Third-Party Integrations', terminates: 'N', isExclusive: 'N' },
  { questionCode: 'Q2', optionCode: 'Q2_O4', text: 'Custom Templates', terminates: 'N', isExclusive: 'N' },
]
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(options), 'Options')

writeFileSync(outPath, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
console.log(`Wrote ${outPath}`)