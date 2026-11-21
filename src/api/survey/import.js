import { apiFetch } from '../client'

export async function fetchImportCapabilities() {
  return apiFetch('/api/surveys/import/capabilities')
}

export async function importSurveyFormData(formData) {
  return apiFetch('/api/surveys/import', {
    method: 'POST',
    body: formData,
  })
}

export async function importSurveyJson(body) {
  return apiFetch('/api/surveys/import', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function listIntegrationKeys() {
  return apiFetch('/api/platform/integration-keys')
}

export async function createIntegrationKey(name) {
  return apiFetch('/api/platform/integration-keys', {
    method: 'POST',
    body: { name },
  })
}

export async function revokeIntegrationKey(id) {
  return apiFetch(`/api/platform/integration-keys/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}