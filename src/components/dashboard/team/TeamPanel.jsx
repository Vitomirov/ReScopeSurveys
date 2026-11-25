import { useState, useEffect, useCallback } from 'react'
import { Users, ChevronLeft, Clock } from 'lucide-react'
import { useApi } from '@/config/api'
import { AUTH_TEAM, AUTH_ERRORS } from '@/constants/auth/authCopy'
import { fetchEmployees, fetchEmployeeDetail } from '@/api/platform/admin'
import { roleLabel } from '@/utils/platform/permissions'
import { SURVEY_STATUSES } from '@/utils/data/platformStore'
import { InlineLoader, Modal, useToast } from '@/components/ui'
import { formatDate } from '@/utils/format/format'

const fmtDate = (iso) => formatDate(iso, { fallback: AUTH_TEAM.noActivity })

function StatusBadge({ statusId }) {
  const s = SURVEY_STATUSES.find(x => x.id === statusId) || SURVEY_STATUSES[0]
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${s.color}`}>
      {s.label}
    </span>
  )
}

function StatPill({ label, value }) {
  return (
    <div className="text-center px-3 py-2 bg-ink-50 rounded-lg">
      <p className="text-lg font-bold text-ink-800 leading-none">{value}</p>
      <p className="text-[10px] text-ink-400 mt-1 uppercase tracking-wide">{label}</p>
    </div>
  )
}

function EmployeeDetail({ employeeId, onBack }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [detail, setDetail]     = useState(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetchEmployeeDetail(employeeId)
      .then(data => { if (alive) setDetail(data) })
      .catch(err => {
        if (alive) toast({ message: err.message || AUTH_ERRORS.forbidden, type: 'error' })
      })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [employeeId, toast])

  if (loading) {
    return <InlineLoader label="Loading employee…" />
  }
  if (!detail) {
    return <p className="text-sm text-ink-400 text-center py-8">Could not load employee.</p>
  }

  const { employee, surveys } = detail
  const rate = employee.completionRate != null ? `${employee.completionRate}%` : '—'

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700 mb-4"
      >
        <ChevronLeft size={16} /> Back to team
      </button>

      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-sm font-bold text-brand-600">
          {(employee.name || employee.username)[0].toUpperCase()}
        </div>
        <div>
          <h3 className="font-semibold text-ink-800">{employee.name}</h3>
          <p className="text-xs text-ink-400">@{employee.username} · {roleLabel(employee.role)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        <StatPill label="Surveys" value={employee.surveys.total} />
        <StatPill label="Live" value={employee.surveys.live} />
        <StatPill label="Responses" value={employee.responses.total} />
        <StatPill label="Complete" value={rate} />
      </div>

      <p className="text-xs font-bold text-ink-500 uppercase tracking-wider mb-2">Surveys built</p>
      {surveys.length === 0 ? (
        <p className="text-sm text-ink-400 py-4">No surveys yet.</p>
      ) : (
        <div className="border border-ink-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-ink-50/80 text-xs text-ink-500 uppercase">
                <th className="text-left px-3 py-2 font-semibold">Survey</th>
                <th className="text-left px-3 py-2 font-semibold">Status</th>
                <th className="text-right px-3 py-2 font-semibold">Responses</th>
                <th className="text-right px-3 py-2 font-semibold">Modified</th>
              </tr>
            </thead>
            <tbody>
              {surveys.map(s => (
                <tr key={s.id} className="border-t border-ink-50">
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-ink-800 truncate max-w-[200px]">{s.title}</p>
                    {s.surveyCode && (
                      <p className="text-xs font-mono text-ink-400">{s.surveyCode}</p>
                    )}
                  </td>
                  <td className="px-3 py-2.5"><StatusBadge statusId={s.status} /></td>
                  <td className="px-3 py-2.5 text-right text-ink-600">{s.stats.total}</td>
                  <td className="px-3 py-2.5 text-right text-xs text-ink-500">{fmtDate(s.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function TeamPanel({ onClose }) {
  const { toast } = useToast()
  const [loading, setLoading]       = useState(useApi)
  const [employees, setEmployees]   = useState([])
  const [selectedId, setSelectedId] = useState(null)

  const load = useCallback(async () => {
    if (!useApi) {
      setEmployees([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setEmployees(await fetchEmployees())
    } catch (err) {
      toast({ message: err.message || AUTH_ERRORS.forbidden, type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  return (
    <Modal
      icon={Users}
      title={AUTH_TEAM.teamActivity}
      subtitle={AUTH_TEAM.teamActivityHint}
      onClose={onClose}
    >
      {selectedId ? (
        <EmployeeDetail employeeId={selectedId} onBack={() => setSelectedId(null)} />
      ) : loading ? (
        <InlineLoader label="Loading team…" />
      ) : employees.length === 0 ? (
        <p className="text-sm text-ink-400 text-center py-12">No employees in this organization yet.</p>
      ) : (
        <div className="border border-ink-100 rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="bg-ink-50/80 text-xs text-ink-500 uppercase">
                <th className="text-left px-3 py-2.5 font-semibold">Employee</th>
                <th className="text-left px-3 py-2.5 font-semibold">Role</th>
                <th className="text-right px-3 py-2.5 font-semibold">Surveys</th>
                <th className="text-right px-3 py-2.5 font-semibold">Live</th>
                <th className="text-right px-3 py-2.5 font-semibold">Responses</th>
                <th className="text-right px-3 py-2.5 font-semibold">Complete</th>
                <th className="text-right px-3 py-2.5 font-semibold">Last active</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr
                  key={emp.id}
                  className="border-t border-ink-50 hover:bg-brand-50/40 cursor-pointer transition-colors"
                  onClick={() => setSelectedId(emp.id)}
                >
                  <td className="px-3 py-3">
                    <p className="font-medium text-ink-800">{emp.name}</p>
                    <p className="text-xs text-ink-400">@{emp.username}</p>
                  </td>
                  <td className="px-3 py-3 text-ink-600">{roleLabel(emp.role)}</td>
                  <td className="px-3 py-3 text-right font-semibold text-ink-700">{emp.surveys.total}</td>
                  <td className="px-3 py-3 text-right text-ink-600">{emp.surveys.live}</td>
                  <td className="px-3 py-3 text-right text-ink-600">{emp.responses.total}</td>
                  <td className="px-3 py-3 text-right text-ink-600">
                    {emp.completionRate != null ? `${emp.completionRate}%` : '—'}
                  </td>
                  <td className="px-3 py-3 text-right text-xs text-ink-500">
                    <span className="inline-flex items-center gap-1 justify-end">
                      <Clock size={11} className="text-ink-300" />
                      {fmtDate(emp.lastActivityAt)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}

export default TeamPanel
