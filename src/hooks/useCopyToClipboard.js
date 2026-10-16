import { useState, useCallback } from 'react'
import { useToast } from '@/components/ui/Toast'

/** Clipboard API exists in Opera and Safari but often rejects. Fall back then. */
function copyWithCommand(text) {
  const field = document.createElement('textarea')
  field.value = text
  field.setAttribute('readonly', '')
  field.style.position = 'fixed'
  field.style.top = '0'
  field.style.left = '0'
  field.style.opacity = '0'
  document.body.appendChild(field)
  field.focus()
  field.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } finally {
    document.body.removeChild(field)
  }
  if (!ok) throw new Error('copy failed')
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }
  } catch {
    // Permission or a blocked call. The command below still works from a click.
  }
  copyWithCommand(text)
}

export function useCopyToClipboard({ successMessage = 'Copied to clipboard', errorMessage = 'Failed to copy' } = {}) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  const copy = useCallback(async (text) => {
    try {
      await copyText(text)
      setCopied(true)
      toast({ message: successMessage, type: 'success' })
      setTimeout(() => setCopied(false), 2000)
      return true
    } catch {
      toast({ message: errorMessage, type: 'error' })
      return false
    }
  }, [toast, successMessage, errorMessage])

  return { copy, copied }
}
