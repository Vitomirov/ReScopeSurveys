/**
 * Public finishes go straight to Postgres while a write slot is free.
 * When the database is busy, the same upsert is appended to a Redis stream
 * and drained by one worker. Nothing here deletes a stored response.
 */
import { randomUUID } from 'node:crypto'
import { hashWriteKey, newWriteKey } from './responseWriteKey.js'
import { upsertResponse } from '../../routes/responses.js'
import { isDatabaseUnavailable } from '../httpErrors.js'

function wait(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms) })
}

const STREAM_KEY = 'rescope:response-inbox'
const GROUP = 'writers'
const DEFAULT_SLOTS = 8
const READ_BLOCK_MS = 2_000
const CLAIM_IDLE_MS = 1_000

function ensureEntryId(entry) {
  const next = { ...entry }
  const id = typeof next.id === 'string' ? next.id.trim() : ''
  next.id = id || randomUUID()
  return next
}

function messageField(message, name) {
  if (!message) return null
  if (typeof message.get === 'function') return message.get(name)
  return message[name]
}

function parseJob(raw) {
  if (!raw) return null
  try {
    const job = JSON.parse(raw)
    if (!job || typeof job !== 'object' || !job.entry) return null
    return job
  } catch {
    return null
  }
}

function firstStreamMessage(streams) {
  const message = streams?.[0]?.messages?.[0]
  if (!message?.id) return null
  return {
    id: message.id,
    job: parseJob(messageField(message.message, 'job')),
  }
}

function firstClaimedMessage(claimed) {
  const message = claimed?.messages?.find((entry) => entry && entry.id)
  if (!message?.id) return null
  return {
    id: message.id,
    job: parseJob(messageField(message.message, 'job')),
  }
}

async function applyJob(app, job) {
  let surveyItems = job.surveyItems
  if (!surveyItems) {
    const row = await app.prisma.survey.findUnique({
      where: { id: job.surveyId },
      select: { items: true },
    })
    surveyItems = row?.items || []
  }
  return upsertResponse(app, {
    surveyId: job.surveyId,
    organizationId: job.organizationId,
    entry: job.entry,
    surveyItems,
    publicWriter: job.publicWriter,
  })
}

export function createResponseInbox({
  redis = null,
  log = null,
  upsert,
  maxSlots = DEFAULT_SLOTS,
} = {}) {
  let active = 0
  let stopped = false
  let running = null
  const consumer = `api-${process.pid}`

  async function enqueue(job) {
    if (!redis?.isOpen) return null
    const issuedWriteKey = job.presentedKey ? null : newWriteKey()
    const rawKey = job.presentedKey || issuedWriteKey
    try {
      await redis.xAdd(STREAM_KEY, '*', {
        job: JSON.stringify({
          surveyId: job.surveyId,
          organizationId: job.organizationId,
          entry: job.entry,
          trustedHash: hashWriteKey(rawKey),
        }),
      })
    } catch (err) {
      log?.warn?.({ err }, 'Response inbox append failed')
      return null
    }
    return { queued: true, id: job.entry.id, issuedWriteKey }
  }

  async function saveDirect(job) {
    const result = await upsert({
      ...job,
      publicWriter: { presentedKey: job.presentedKey || null },
    })
    return { queued: false, result, id: result?.row?.id || job.entry.id }
  }

  async function savePublic(input) {
    const job = { ...input, entry: ensureEntryId(input.entry) }
    if (active < maxSlots) {
      active += 1
      try {
        return await saveDirect(job)
      } catch (err) {
        if (!isDatabaseUnavailable(err)) throw err
        const queued = await enqueue(job)
        if (queued) return queued
        throw err
      } finally {
        active -= 1
      }
    }
    const queued = await enqueue(job)
    if (queued) return queued
    return saveDirect(job)
  }

  async function ack(id) {
    await redis.xAck(STREAM_KEY, GROUP, id)
  }

  async function deliver(message) {
    if (!message?.job) {
      if (message?.id) await ack(message.id)
      return
    }
    try {
      await upsert({
        surveyId: message.job.surveyId,
        organizationId: message.job.organizationId,
        entry: message.job.entry,
        publicWriter: { trustedHash: message.job.trustedHash },
      })
      await ack(message.id)
    } catch (err) {
      log?.warn?.({ err }, 'Response inbox delivery will retry')
      await wait(CLAIM_IDLE_MS)
    }
  }

  async function readNext() {
    const streams = await redis.xReadGroup(
      GROUP,
      consumer,
      { key: STREAM_KEY, id: '>' },
      { COUNT: 1, BLOCK: READ_BLOCK_MS },
    )
    const fresh = firstStreamMessage(streams)
    if (fresh || stopped) return fresh
    const claimed = await redis.xAutoClaim(
      STREAM_KEY,
      GROUP,
      consumer,
      CLAIM_IDLE_MS,
      '0-0',
      { COUNT: 1 },
    )
    return firstClaimedMessage(claimed)
  }

  async function run() {
    try {
      await redis.xGroupCreate(STREAM_KEY, GROUP, '0', { MKSTREAM: true })
    } catch (err) {
      if (!String(err?.message || '').includes('BUSYGROUP')) {
        log?.warn?.({ err }, 'Response inbox group was not created')
      }
    }
    log?.info?.('Response inbox listening')
    while (!stopped) {
      try {
        const message = await readNext()
        if (!message) continue
        await deliver(message)
      } catch (err) {
        if (stopped) return
        log?.warn?.({ err }, 'Response inbox read failed')
        await wait(CLAIM_IDLE_MS)
      }
    }
  }

  return {
    savePublic,
    deliver,
    async start() {
      if (!redis?.isOpen || running) return
      stopped = false
      running = run().finally(() => { running = null })
    },
    async stop() {
      stopped = true
      if (running) await running.catch(() => {})
    },
  }
}

export async function registerResponseInbox(app) {
  const inbox = createResponseInbox({
    redis: app.redis,
    log: app.log,
    upsert: (job) => applyJob(app, job),
  })
  app.decorate('responseInbox', inbox)
  app.addHook('onClose', async () => { await inbox.stop() })
  await inbox.start()
}
