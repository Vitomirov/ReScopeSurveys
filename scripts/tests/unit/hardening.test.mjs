/**
 * Behavior-safe hardening: write cookie, optional TOTP, audit insert,
 * edge files, and backup/probe dry-runs. No database.
 */
import { createRequire } from 'node:module'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { appendAudit } from '../../../server/src/lib/audit.js'
import {
  assertTotpIfEnabled,
  generateTotpSecret,
  sealTotpSecret,
  verifyTotpToken,
} from '../../../server/src/lib/auth/totp.js'
import {
  newWriteKey,
  presentedKeyFor,
  rememberWriteKey,
  writeKeyMatches,
  hashWriteKey,
} from '../../../server/src/lib/survey/responseWriteKey.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

function read(rel) {
  return readFileSync(resolve(root, rel), 'utf8')
}

test('new public write keys match only the browser that received them', () => {
  const id = '11111111-1111-4111-8111-111111111111'
  const key = newWriteKey()
  const cookie = rememberWriteKey('', id, key)
  assert.equal(presentedKeyFor(cookie, id), key)
  assert.equal(writeKeyMatches(hashWriteKey(key), presentedKeyFor(cookie, id)), true)
  assert.equal(writeKeyMatches(hashWriteKey(key), 'other'), false)
  assert.equal(writeKeyMatches(null, key), false)
  const second = '22222222-2222-4222-8222-222222222222'
  const next = rememberWriteKey(cookie, second, newWriteKey())
  assert.equal(presentedKeyFor(next, id), key)
})

test('password login does not read the authenticator key', () => {
  const previous = process.env.TOTP_ENCRYPTION_KEY
  delete process.env.TOTP_ENCRYPTION_KEY
  try {
    assert.deepEqual(assertTotpIfEnabled({ totpEnabled: false }, undefined), { ok: true })
    const required = assertTotpIfEnabled({ totpEnabled: true, totpSecret: 'v1.x.y.z' }, '')
    assert.equal(required.ok, false)
    assert.equal(required.code, 'TOTP_REQUIRED')
  } finally {
    if (previous === undefined) delete process.env.TOTP_ENCRYPTION_KEY
    else process.env.TOTP_ENCRYPTION_KEY = previous
  }
})

test('enrolled authenticator accepts only the current code', () => {
  const { authenticator } = createRequire(resolve(root, 'server/package.json'))('otplib')
  process.env.TOTP_ENCRYPTION_KEY = 'test-totp-key-at-least-16'
  const secret = generateTotpSecret()
  const user = { totpEnabled: true, totpSecret: sealTotpSecret(secret) }
  const code = authenticator.generate(secret)
  assert.equal(verifyTotpToken(code, secret), true)
  assert.deepEqual(assertTotpIfEnabled(user, code).ok, true)
  assert.equal(assertTotpIfEnabled(user, '000000').code, 'TOTP_INVALID')
})

test('audit insert stores ids and not answer text', async () => {
  const calls = []
  const prisma = {
    auditEvent: {
      create: async (args) => { calls.push(args) },
    },
  }
  await appendAudit(prisma, {
    organizationId: 'org-1',
    actorId: 'user-1',
    action: 'login',
    targetEntity: 'User',
    targetId: 'user-1',
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].data.action, 'login')
  assert.equal(JSON.stringify(calls[0].data).includes('responses'), false)
})

test('nginx hides public embed-csp and keeps the internal embed check', () => {
  const nginx = read('docker/nginx.conf')
  assert.match(nginx, /location = \/api\/internal\/embed-csp/)
  assert.match(nginx, /return 404/)
  assert.match(nginx, /location = \/internal\/embed-csp/)
  assert.match(nginx, /auth_request \/internal\/embed-csp/)
  const caddy = read('docker/caddy/Caddyfile')
  const panel = read('docker/caddy/panel.caddy')
  assert.match(caddy, /import panel\.caddy/)
  assert.match(panel, /X-Content-Type-Options nosniff/)
  assert.match(panel, /Content-Security-Policy-Report-Only/)
  assert.match(panel, /127\.0\.0\.1:3010/)
  const deploy = read('scripts/deploy/deploy.sh')
  assert.match(deploy, /install_panel_caddy_if_missing/)
  assert.match(deploy, /if \[\[ -f "\$dest" \]\]; then\s*return 0/)
})

test('backup and public check dry-runs do not open the network', () => {
  const backup = execFileSync('bash', ['scripts/deploy/backup.sh', '--dry-run'], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      OFFSITE_BACKUP_TARGET: 'backupuser@backup.example:/srv/rescopesurveys',
      ALERT_WEBHOOK_URL: 'https://hooks.example/backup',
    },
  })
  assert.match(backup, /offsite=backupuser@backup\.example:\/srv\/rescopesurveys/)
  assert.match(backup, /webhook=set/)
  assert.match(backup, /rsync=on-failure-exit/)
  assert.match(read('scripts/deploy/backup.sh'), /rsync -a/)

  const probe = execFileSync('bash', ['scripts/deploy/check-public.sh', '--dry-run'], {
    cwd: root,
    encoding: 'utf8',
  })
  assert.match(probe, /https:\/\/app\.rescopesurveys\.com/)
  assert.match(probe, /https:\/\/surveys\.rescopesurveys\.com/)
  assert.match(probe, /https:\/\/panel\.rescopesurveys\.com/)
})
