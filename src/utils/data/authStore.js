// ─── Auth store ────────────────────────────────────────────────────────────
// Local mode: credentials in localStorage (self-hosted / offline).
// API mode:   httpOnly cookies via POST /api/auth/login; session metadata in sessionStorage.

import { useApi } from '@/config/api'
import { apiFetch } from '@/api/client'
import { AUTH_ERRORS } from '@/constants/authCopy'
import { newPrefixedId } from '@/store/id'

const USERS_KEY   = 'sf_users'
const SESSION_KEY = 'sf_session'

export const DEFAULT_CREDENTIALS = { email: 'admin@rescopesurveys.local', password: 'admin123' }

const DEFAULT_USERS = [
  {
    id: 'u_admin',
    email: DEFAULT_CREDENTIALS.email,
    username: 'admin',
    password: DEFAULT_CREDENTIALS.password,
    role: 'admin',
    name: 'Admin',
  },
]

function loadUsers() {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    return raw ? JSON.parse(raw) : DEFAULT_USERS
  } catch { return DEFAULT_USERS }
}

function saveUsers(users) {
  try { localStorage.setItem(USERS_KEY, JSON.stringify(users)) } catch {}
}

function readSessionStorage() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function writeSessionStorage(session) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)) } catch {}
}

// ─── Session ───────────────────────────────────────────────────────────────
export function getSession() {
  if (useApi) {
    return readSessionStorage()
  }
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export async function login(email, password, code) {
  if (useApi) {
    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          ...(code ? { code } : {}),
        }),
      })
      writeSessionStorage(data.session)
      return { ok: true, session: data.session }
    } catch (err) {
      if (err.body?.code === 'TOTP_REQUIRED') {
        return { ok: false, code: 'TOTP_REQUIRED', error: err.message }
      }
      return { ok: false, error: err.message || AUTH_ERRORS.invalidCredentials }
    }
  }

  // Local mode: match by email (or legacy username field).
  const users = loadUsers()
  const normalized = email.toLowerCase().trim()
  const user = users.find(
    u => (u.email?.toLowerCase() === normalized || u.username?.toLowerCase() === normalized) &&
         u.password === password
  )
  if (!user) return { ok: false, error: AUTH_ERRORS.invalidCredentials }
  const session = {
    userId: user.id, username: user.username || user.email, name: user.name,
    avatarUrl: user.avatarUrl || null,
    role: user.role, loginAt: new Date().toISOString(),
  }
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)) } catch {}
  return { ok: true, session }
}

export async function signup({ organizationName, name, email, password, intendedPlanId }) {
  if (useApi) {
    try {
      const data = await apiFetch('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ organizationName, name, email, password, intendedPlanId }),
      })
      writeSessionStorage(data.session)
      return { ok: true, session: data.session }
    } catch (err) {
      return { ok: false, error: err.message || AUTH_ERRORS.signupFailed }
    }
  }

  // Local (offline) mode has no org concept — create the admin user locally.
  const users = loadUsers()
  const normalized = email.toLowerCase().trim()
  if (users.find(u => u.email?.toLowerCase() === normalized)) {
    return { ok: false, error: AUTH_ERRORS.emailTakenSignup }
  }
  const localPart = normalized.split('@')[0] || 'user'
  const user = {
    id: newPrefixedId('u'), email: normalized, username: localPart, password,
    name: name.trim(), role: 'admin',
  }
  saveUsers([...users, user])
  const session = {
    userId: user.id, username: user.username, name: user.name,
    avatarUrl: user.avatarUrl || null,
    role: user.role, organizationName: organizationName?.trim(),
    loginAt: new Date().toISOString(),
  }
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)) } catch {}
  return { ok: true, session }
}

export async function logout() {
  if (useApi) {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST', skipAuthInvalidate: true })
    } catch { /* noop */ }
    try {
      sessionStorage.removeItem(SESSION_KEY)
      sessionStorage.removeItem('sf_token')
    } catch {}
    return
  }
  try { localStorage.removeItem(SESSION_KEY) } catch {}
}

// ─── User management (admin only — local mode until B4 API) ────────────────
export function getUsers()              { return loadUsers() }

export function addUser({ email, username, password, name, role = 'editor' }) {
  const users = loadUsers()
  const normalized = email?.toLowerCase().trim()
  if (normalized && users.find(u => u.email?.toLowerCase() === normalized)) {
    return { ok: false, error: AUTH_ERRORS.emailTakenAdmin }
  }
  const localPart = normalized?.split('@')[0] || username?.trim() || 'user'
  const newUser = {
    id: newPrefixedId('u'),
    email: normalized || `${localPart}@local.dev`,
    username: username?.trim() || localPart,
    password,
    name: name.trim(),
    role,
  }
  saveUsers([...users, newUser])
  return { ok: true, user: newUser }
}

export function updateUser(id, patch) {
  const users   = loadUsers()
  const updated = users.map(u => u.id === id ? { ...u, ...patch } : u)
  saveUsers(updated)
  return updated
}

export function deleteUser(id) {
  const updated = loadUsers().filter(u => u.id !== id)
  saveUsers(updated)
  return updated
}

export function updateSession(session) {
  if (useApi) {
    writeSessionStorage(session)
    return session
  }
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)) } catch {}
  return session
}

/** Refresh profile from the server (API mode). Auth is the httpOnly cookie. */
export async function refreshSessionFromApi() {
  if (!useApi) return null
  try {
    const data = await apiFetch('/api/auth/me', { skipAuthInvalidate: true })
    if (data.session) writeSessionStorage(data.session)
    return data.session
  } catch {
    try { sessionStorage.removeItem(SESSION_KEY) } catch {}
    return null
  }
}

/** Self-service profile update (local mode). */
export function updateProfileLocal(userId, patch) {
  const users = loadUsers()
  const user = users.find(u => u.id === userId)
  if (!user) return { ok: false, error: 'User not found.' }

  if (patch.username && users.some(u => u.id !== userId && u.username.toLowerCase() === patch.username.toLowerCase())) {
    return { ok: false, error: AUTH_ERRORS.usernameTakenSignup }
  }
  if (patch.newPassword) {
    if (!patch.currentPassword || patch.currentPassword !== user.password) {
      return { ok: false, error: 'Current password is incorrect.' }
    }
    patch.password = patch.newPassword
    delete patch.newPassword
    delete patch.currentPassword
  }

  const { newPassword: _np, currentPassword: _cp, ...safePatch } = patch
  const updatedUsers = users.map(u => u.id === userId ? { ...u, ...safePatch } : u)
  saveUsers(updatedUsers)
  const updated = updatedUsers.find(u => u.id === userId)
  const session = {
    userId: updated.id,
    username: updated.username,
    name: updated.name,
    avatarUrl: updated.avatarUrl || null,
    role: updated.role,
    loginAt: new Date().toISOString(),
  }
  updateSession(session)
  return { ok: true, user: updated, session }
}
