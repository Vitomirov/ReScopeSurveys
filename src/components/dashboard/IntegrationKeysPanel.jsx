import { useState, useEffect, useCallback } from 'react'
import { Key, Plus, Trash2 } from 'lucide-react'
import {
  listIntegrationKeys,
  createIntegrationKey,
  revokeIntegrationKey,
} from '@/api/survey/import'

export function IntegrationKeysPanel() {
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [newKey, setNewKey] = useState(null)
  const [name, setName] = useState('n8n import')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listIntegrationKeys()
      setKeys(data.keys || [])
    } catch {
      setKeys([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCreate(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await createIntegrationKey(name)
      setNewKey(data.apiKey)
      setName('n8n import')
      await load()
    } catch (err) {
      setError(err.message || 'Could not create key')
    } finally {
      setBusy(false)
    }
  }

  async function handleRevoke(id) {
    await revokeIntegrationKey(id)
    await load()
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-500">
        API keys authenticate webhook imports. Store the key securely — it is shown only once.
      </p>

      {newKey && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="font-semibold text-amber-900 mb-1">Copy this key now</p>
          <code className="block break-all text-xs bg-white border border-amber-100 rounded p-2">{newKey}</code>
        </div>
      )}

      <form onSubmit={handleCreate} className="flex flex-wrap gap-2 items-end">
        <label className="flex-1 min-w-[12rem] text-sm">
          Label
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="mt-1 w-full border border-ink-200 rounded-lg px-3 py-2"
          />
        </label>
        <button type="submit" disabled={busy} className="btn-primary h-10 px-4">
          <Plus size={15} /> Create key
        </button>
      </form>
      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="border border-ink-200 rounded-xl overflow-hidden">
        {loading ? (
          <p className="p-4 text-sm text-ink-400">Loading…</p>
        ) : keys.length === 0 ? (
          <p className="p-4 text-sm text-ink-400 flex items-center gap-2">
            <Key size={16} /> No active keys
          </p>
        ) : (
          <ul>
            {keys.map(k => (
              <li key={k.id} className="flex items-center justify-between gap-3 px-4 py-3 border-b border-ink-100 last:border-0 text-sm">
                <div>
                  <p className="font-medium text-ink-800">{k.name}</p>
                  <p className="text-xs text-ink-400 font-mono">{k.keyPrefix}…</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRevoke(k.id)}
                  className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg"
                  aria-label="Revoke key"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}