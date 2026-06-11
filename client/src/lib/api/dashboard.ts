import { apiFetch } from './client'
import type { DashboardStats, RecentActivityItem } from '@/types'

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await apiFetch('/api/v1/dashboard/stats')
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch stats')
  return json.data as DashboardStats
}

export async function getRecentActivity(): Promise<RecentActivityItem[]> {
  const res = await apiFetch('/api/v1/dashboard/recent')
  const json = await res.json()
  if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch activity')
  return json.data as RecentActivityItem[]
}
