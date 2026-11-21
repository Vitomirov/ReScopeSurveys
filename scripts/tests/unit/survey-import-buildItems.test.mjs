import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRuntimeItems } from '../../../server/src/lib/survey/import/buildItems.js'
import { mapCodesToIds } from '../../../server/src/lib/survey/import/mapCodes.js'

test('imported cascade and slider include builder configs', () => {
  const items = [
    { code: 'Q1', itemType: 'question', questionType: 'cascade', text: 'Pick region' },
    { code: 'Q2', itemType: 'question', questionType: 'slider', text: 'Willingness to pay' },
  ]
  const { codeToId } = mapCodesToIds(items)
  const warnings = []
  const runtime = buildRuntimeItems(items, codeToId, { warnings })

  assert.equal(runtime.length, 2)
  assert.ok(Array.isArray(runtime[0].cascadeConfig?.items))
  assert.ok(runtime[0].cascadeConfig.items.length >= 1)
  assert.ok(runtime[1].sliderConfig?.labels)
  assert.ok(warnings.some(w => w.code === 'PARTIAL_TYPE'))
})