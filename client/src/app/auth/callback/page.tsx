'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { setAccessToken } from '@/lib/token'
import { getMe, refreshAccessToken } from '@/lib/api/auth'

function CallbackInner() {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    async function completeSignIn() {
      // The OAuth callback sets the HttpOnly refresh cookie and redirects here with no
      // token in the URL — exchange the cookie for an access token. (Legacy ?token=
      // param still honoured during rollout.)
      let token = searchParams.get('token')
      if (!token) {
        const refreshed = await refreshAccessToken()
        token = refreshed?.accessToken ?? null
      }
      if (!token) { router.replace('/login'); return }

      setAccessToken(token)
      try {
        await getMe(token)
        router.replace('/dashboard')
      } catch {
        router.replace('/login')
      }
    }
    completeSignIn()
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

export default function AuthCallbackPage() {
  return (
    <Suspense>
      <CallbackInner />
    </Suspense>
  )
}
