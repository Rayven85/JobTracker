import { apiFetch } from './client'
import type { Resume, ExtractedData, ProfileSuggestion } from '@/types'

export async function listResumes(): Promise<Resume[]> {
  const res = await apiFetch('/api/v1/resumes')
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch resumes')
  return json.data as Resume[]
}

export async function getPresignedUrl(fileName: string, contentType: string): Promise<{
  presignedUrl: string
  s3Key: string
}> {
  const res = await apiFetch('/api/v1/resumes/presigned-url', {
    method: 'POST',
    body: JSON.stringify({ fileName, contentType }),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'Failed to get upload URL')
  return json.data
}

// Direct PUT to S3 — bypasses apiFetch (no auth header, different host)
export async function uploadToS3(presignedUrl: string, file: File): Promise<void> {
  const res = await fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  if (!res.ok) throw new Error('Upload to S3 failed')
}

export async function confirmUpload(data: {
  s3Key: string
  fileName: string
  fileSize: number
  name: string
}): Promise<Resume> {
  const res = await apiFetch('/api/v1/resumes/confirm', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'Failed to confirm upload')
  return json.data as Resume
}

export async function setDefaultResume(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/resumes/${id}/set-default`, { method: 'POST' })
  if (!res.ok) {
    const json = await res.json()
    throw new Error(json.error?.message ?? 'Failed to set default')
  }
}

export async function deleteResume(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/resumes/${id}`, { method: 'DELETE' })
  if (res.status !== 204 && !res.ok) {
    const json = await res.json()
    throw new Error(json.error?.message ?? 'Failed to delete resume')
  }
}

export async function getResume(id: string): Promise<Resume> {
  const res = await apiFetch(`/api/v1/resumes/${id}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch resume')
  return json.data as Resume
}

export async function updateParsedText(id: string, parsedText: string): Promise<void> {
  const res = await apiFetch(`/api/v1/resumes/${id}/parsed-text`, {
    method: 'PATCH',
    body: JSON.stringify({ parsedText }),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'Failed to update text')
}

type ExtractedDataResult = {
  resume: Pick<Resume, 'id' | 'name' | 'extractedData' | 'extractionStatus'>
  suggestion: ProfileSuggestion | null
}

export async function updateExtractedData(id: string, data: ExtractedData): Promise<ExtractedDataResult> {
  const res = await apiFetch(`/api/v1/resumes/${id}/extracted-data`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'Failed to update resume data')
  return json.data
}

// Re-run AI extraction on the resume's stored text, overwriting extractedData.
export async function reExtractResume(id: string): Promise<ExtractedDataResult> {
  const res = await apiFetch(`/api/v1/resumes/${id}/re-extract`, { method: 'POST' })
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'Failed to re-extract')
  return json.data
}
