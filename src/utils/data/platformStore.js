// ─── Platform-level settings (shared across all surveys) ──────────────────
import { newPrefixedId } from '@/store/id'
// Org-wide classification labels: clients, topics, and audience types.
// Admins manage these in Platform Settings; surveys reference them by id.

const CLIENTS_KEY      = 'sf_platform_clients'
const TOPICS_KEY       = 'sf_platform_topics'
const SURVEY_TYPES_KEY = 'sf_platform_survey_types'

export const SURVEY_STATUSES = [
  { id: 'draft',  label: 'Draft',  color: 'text-ink-600  bg-ink-100  border-ink-200' },
  { id: 'pending_review', label: 'Pending', color: 'text-violet-700 bg-violet-100 border-violet-200' },
  { id: 'live',   label: 'Live',   color: 'text-emerald-700 bg-emerald-100 border-emerald-200' },
  { id: 'paused', label: 'Paused', color: 'text-amber-700 bg-amber-100 border-amber-200' },
  { id: 'closed', label: 'Closed', color: 'text-rose-700  bg-rose-100  border-rose-200' },
]

function load(key, defaults = []) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : defaults
  } catch { return defaults }
}

function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* noop */ }
}

const newId = () => newPrefixedId('pid')

// ─── Clients ───────────────────────────────────────────────────────────────
export function loadClients()             { return load(CLIENTS_KEY) }
function saveClients(clients)      { save(CLIENTS_KEY, clients) }
export function addClient(name)           {
  const updated = [...loadClients(), { id: newId(), name: name.trim() }]
  saveClients(updated); return updated
}
export function updateClient(id, name)    {
  const updated = loadClients().map(c => c.id === id ? { ...c, name: name.trim() } : c)
  saveClients(updated); return updated
}
export function deleteClient(id)          {
  const updated = loadClients().filter(c => c.id !== id)
  saveClients(updated); return updated
}

// ─── Topics ────────────────────────────────────────────────────────────────
export function loadTopics()              { return load(TOPICS_KEY) }
function saveTopics(topics)        { save(TOPICS_KEY, topics) }
export function addTopic(name)            {
  const updated = [...loadTopics(), { id: newId(), name: name.trim() }]
  saveTopics(updated); return updated
}
export function updateTopic(id, name)     {
  const updated = loadTopics().map(t => t.id === id ? { ...t, name: name.trim() } : t)
  saveTopics(updated); return updated
}
export function deleteTopic(id)           {
  const updated = loadTopics().filter(t => t.id !== id)
  saveTopics(updated); return updated
}

// ─── Survey types (audience / client type) ─────────────────────────────────
export function loadSurveyTypes()         { return load(SURVEY_TYPES_KEY) }
function saveSurveyTypes(types)    { save(SURVEY_TYPES_KEY, types) }
export function addSurveyType(name)       {
  const updated = [...loadSurveyTypes(), { id: newId(), name: name.trim() }]
  saveSurveyTypes(updated); return updated
}
export function updateSurveyType(id, name) {
  const updated = loadSurveyTypes().map(t => t.id === id ? { ...t, name: name.trim() } : t)
  saveSurveyTypes(updated); return updated
}
export function deleteSurveyType(id)      {
  const updated = loadSurveyTypes().filter(t => t.id !== id)
  saveSurveyTypes(updated); return updated
}
