/** Local panel handoff. Absent in production builds until a panel URL is set. */
export function panelStartUrl() {
  const base = import.meta.env.VITE_PANEL_URL
  if (!base) return null
  return `${String(base).replace(/\/$/, '')}/api/auth/builder/start`
}

export function productGrantLabel(grant) {
  if (grant === 'panel') return 'Panel'
  if (grant === 'both') return 'Builder and panel'
  return 'Builder'
}
