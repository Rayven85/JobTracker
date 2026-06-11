'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { setAccessToken } from '@/lib/token'
import { getMe } from '@/lib/api/auth'

// Handles the Google OAuth redirect: /auth/callback?token=<accessToken>
export default function AuthCallbackPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) { router.replace('/login'); return }

    setAccessToken(token)
    getMe(token)
      .then(() => router.replace('/dashboard'))
      .catch(() => router.replace('/login'))
  }, [searchParams, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={28} className="animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      </div>
    </div>
  )
}
