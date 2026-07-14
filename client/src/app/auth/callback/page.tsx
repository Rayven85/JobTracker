'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

// Landing page after the Google OAuth redirect. By the time this page loads, the
// OAuth callback has already set the HttpOnly refresh cookie, and AuthProvider
// (mounted in the root layout) exchanges it for a session on mount. This page must
// NOT call /auth/refresh itself: refresh tokens rotate on use, so a second in-flight
// refresh with the same cookie loses the race and 401s — bouncing the user to /login.
export default function AuthCallbackPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    router.replace(user ? '/dashboard' : '/login')
  }, [user, isLoading, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={28} className="animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      </div>
    </div>
  )
}
