import { apiFetch } from './client'
import type { Application, ApplicationStatus, TailoredResume, ExtractedData } from '@/types'

export interface ListApplicationsParams {
  status?: ApplicationStatus
  search?: string
  page?: number
  limit?: number
}

export interface ListApplicationsResult {
  items: Application[]
  total: number
  page: number
  limit: number
}

export async function listApplications(params: ListApplicationsParams = {}): Promise<ListApplicationsResult> {
  const q = new URLSearchParams()
  if (params.status) q.set('status', params.status)
  if (params.search) q.set('search', params.search)
  if (params.page) q.set('page', String(params.page))
  if (params.limit) q.set('limit', String(params.limit))
  const res = await apiFetch(`/api/v1/applications?${q}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch applications')
  return json.data as ListApplicationsResult
}

export async function getApplication(id: string): Promise<Application> {
  const res = await apiFetch(`/api/v1/applications/${id}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'Application not found')
  return json.data as Application
}

export interface CreateApplicationData {
  companyName: string
  jobTitle: string
  status?: ApplicationStatus
  location?: string
  employmentType?: string
  isRemote?: boolean
  appliedDate?: string
  deadline?: string
  jobDescription?: string
  jobUrl?: string
  resumeId?: string | null // null explicitly detaches the resume (server accepts nullish)
  salaryMin?: number
  salaryMax?: number
  notes?: string
}

export async function createApplication(data: CreateApplicationData): Promise<Application> {
  const res = await apiFetch('/api/v1/applications', { method: 'POST', body: JSON.stringify(data) })
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'Failed to create application')
  return json.data as Application
}

export async function updateApplication(id: string, data: Partial<CreateApplicationData>): Promise<Application> {
  const res = await apiFetch(`/api/v1/applications/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'Failed to update application')
  return json.data as Application
}

export async function updateStatus(id: string, status: ApplicationStatus, note?: string): Promise<Application> {
  const res = await apiFetch(`/api/v1/applications/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, ...(note ? { note } : {}) }),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'Failed to update status')
  return json.data as Application
}

export async function deleteApplication(id: string): Promise<void> {
  const res = await apiFetch(`/api/v1/applications/${id}`, { method: 'DELETE' })
  if (res.status !== 204 && !res.ok) {
    const json = await res.json()
    throw new Error(json.error?.message ?? 'Failed to delete application')
  }
}

export async function analyzeApplication(id: string): Promise<{
  score: number; matched: string[]; missing: string[]; suggestions: string[]
}> {
  const res = await apiFetch(`/api/v1/applications/${id}/analyze`, { method: 'POST' })
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'AI analysis failed')
  return json.data
}

export async function generateCoverLetter(id: string, tone?: string): Promise<{
  id: string; content: string; version: number; isActive: boolean; tone: string | null; createdAt: string
}> {
  const res = await apiFetch(`/api/v1/applications/${id}/cover-letter`, {
    method: 'POST',
    body: JSON.stringify(tone ? { tone } : {}),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'Cover letter generation failed')
  return json.data
}

export async function updateCoverLetter(id: string, content: string): Promise<void> {
  const res = await apiFetch(`/api/v1/cover-letters/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  })
  if (!res.ok) {
    const json = await res.json()
    throw new Error(json.error?.message ?? 'Failed to save cover letter')
  }
}

export async function generateTailoredResume(id: string): Promise<TailoredResume> {
  const res = await apiFetch(`/api/v1/applications/${id}/tailored-resume`, { method: 'POST' })
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'Tailored resume generation failed')
  return json.data
}

export async function updateTailoredResume(id: string, data: ExtractedData): Promise<TailoredResume> {
  const res = await apiFetch(`/api/v1/tailored-resumes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'Failed to save tailored resume')
  return json.data
}

export async function generateInterviewPrep(id: string): Promise<{
  applicationId: string
  questions: Array<{ question: string; category: string; tips: string }>
}> {
  const res = await apiFetch(`/api/v1/applications/${id}/interview-prep`, { method: 'POST' })
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'Interview prep generation failed')
  return json.data
}

export async function addContact(
  applicationId: string,
  data: { name: string; role?: string; email?: string; phone?: string; linkedInUrl?: string; notes?: string }
): Promise<void> {
  const res = await apiFetch(`/api/v1/applications/${applicationId}/contacts`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const json = await res.json()
    throw new Error(json.error?.message ?? 'Failed to add contact')
  }
}
