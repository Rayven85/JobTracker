import { apiFetch } from './client'
import type { UserProfile, SyncPlan, ExperienceMergeMatch } from '@/types'

export async function getProfile(): Promise<UserProfile> {
  const res = await apiFetch('/api/v1/profile')
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch profile')
  return json.data as UserProfile
}

export async function updateProfile(data: Partial<Pick<UserProfile, 'name' | 'email' | 'phone' | 'location' | 'summary' | 'skills' | 'education' | 'experience' | 'certifications'>>): Promise<UserProfile> {
  const res = await apiFetch('/api/v1/profile', {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'Failed to update profile')
  return json.data as UserProfile
}

export async function syncResume(resumeId: string, accepted: {
  skills: string[]
  education: UserProfile['education']
  experience: UserProfile['experience']
  certifications: UserProfile['certifications']
  experienceMerges?: { existingIndex: number; merged: UserProfile['experience'][number] }[]
}): Promise<UserProfile> {
  const res = await apiFetch(`/api/v1/profile/sync/${resumeId}`, {
    method: 'POST',
    body: JSON.stringify(accepted),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'Failed to sync resume')
  return json.data as UserProfile
}

// Phase 2: AI-detected merge plan (which incoming experiences match existing profile entries).
export async function getSyncPlan(resumeId: string): Promise<SyncPlan> {
  const res = await apiFetch(`/api/v1/profile/sync-plan/${resumeId}`, { method: 'POST', body: '{}' })
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'Failed to compute sync plan')
  return json.data as SyncPlan
}

export type { ExperienceMergeMatch }

export async function buildProfile(): Promise<UserProfile> {
  const res = await apiFetch('/api/v1/profile/build', { method: 'POST', body: '{}' })
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'Failed to build profile')
  return json.data as UserProfile
}

export async function dismissResumeSuggestions(resumeId: string): Promise<void> {
  const res = await apiFetch(`/api/v1/profile/sync/${resumeId}`, { method: 'DELETE' })
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'Failed to dismiss')
}
