import { useState, useEffect } from 'react'
import { Globe, ShieldCheck } from 'lucide-react'
import { useApi } from '@/config/api'
import {
  fetchDomainVerification,
  initDomainVerification,
  checkDomainVerification,
} from '@/api/platform/billing'
import { InlineLoader, useToast } from '@/components/ui'
import { SURVEY_DNS_CNAME_HOST, SURVEY_DNS_TXT_HOST } from '@shared/domainVerification.js'

export function DomainVerificationPanel({ onClose, embedded = false }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(useApi)
  const [planFeatures, setPlanFeatures] = useState(null)
  const [surveyDomain, setSurveyDomain] = useState('')
  const [verification, setVerification] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = async () => {
    if (!useApi) { setLoading(false); return }
    setLoading(true)
    try {
      const data = await fetchDomainVerification()
      setPlanFeatures(data.planFeatures)
      setSurveyDomain(data.surveyDomain || '')
      setVerification(data.domainVerification)
    } catch (err) {
      toast({ message: err.message || 'Failed to load domain verification', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const init = async () => {
    setBusy(true)
    try {
      const data = await initDomainVerification()
      setVerification(data.domainVerification)
      toast({ message: 'Verification record created', type: 'success' })
    } catch (err) {
      toast({ message: err.message || 'Failed to initialize verification', type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const check = async () => {
    setBusy(true)
    try {
      const data = await checkDomainVerification({ forceVerified: false })
      setVerification(data.domainVerification)
      if (data.domainVerification.status === 'verified') {
        toast({ message: 'Domain verified', type: 'success' })
      } else {
        toast({ message: data.domainVerification.failureReason || 'DNS records not found yet', type: 'info' })
      }
    } catch (err) {
      toast({ message: err.message || 'Verification check failed', type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <InlineLoader label="Loading domain settings…" />

  if (!planFeatures?.customDomain) {
    return (
      <div className={embedded ? '' : 'p-6'}>
        {!embedded && <h2 className="text-lg font-bold text-ink-800 mb-2">Custom domain</h2>}
        <p className="text-sm text-ink-500">Verified custom domains are available on Enterprise plans.</p>
        {!embedded && onClose && (
          <button type="button" onClick={onClose} className="btn-ghost mt-4">Close</button>
        )}
      </div>
    )
  }

  return (
    <div className={embedded ? '' : 'p-6 max-w-xl'}>
      {!embedded && (
        <div className="flex items-center gap-2 mb-1">
          <Globe size={18} className="text-brand-600" />
          <h2 className="text-lg font-bold text-ink-800">Custom domain verification</h2>
        </div>
      )}
      <p className="text-sm text-ink-500 mb-4">
        Your survey domain must be verified before public URLs use <strong>{surveyDomain || 'your domain'}</strong>.
      </p>

      {!surveyDomain && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          Ask your platform administrator to set the survey domain in the Platform console first.
        </p>
      )}

      {verification?.txtValue && (
        <div className="text-sm bg-ink-50 border border-ink-200 rounded-lg p-3 mb-4 space-y-3">
          <p className="text-ink-700">
            Add these two records in the DNS settings for <strong>{surveyDomain}</strong>.
          </p>
          <DnsRecord
            title="Record 1"
            type="CNAME"
            host={SURVEY_DNS_CNAME_HOST}
            value={verification.cnameValue}
          />
          <DnsRecord
            title="Record 2"
            type="TXT"
            host={SURVEY_DNS_TXT_HOST}
            value={verification.txtValue}
          />
          <p className="text-ink-500">Status: <strong>{verification.status}</strong></p>
          {verification.failureReason && (
            <p className="text-rose-600">{verification.failureReason}</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={init} disabled={!surveyDomain || busy} className="btn-primary">
          <ShieldCheck size={15} /> Generate DNS record
        </button>
        <button type="button" onClick={check} disabled={!verification?.txtValue || busy} className="btn-ghost border border-ink-200">
          Check DNS
        </button>
        {!embedded && onClose && (
          <button type="button" onClick={onClose} className="btn-ghost">Close</button>
        )}
      </div>
    </div>
  )
}

function DnsRecord({ title, type, host, value }) {
  return (
    <div className="space-y-1">
      <p className="font-medium text-ink-800">{title}</p>
      <p><span className="font-medium">Type:</span> {type}</p>
      <p><span className="font-medium">Host:</span> <code>{host}</code></p>
      <p><span className="font-medium">Value:</span> <code className="break-all">{value}</code></p>
    </div>
  )
}

export default DomainVerificationPanel
