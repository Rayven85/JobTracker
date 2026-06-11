'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, BriefcaseBusiness, FileText, LogOut, Loader2, Palette } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { useTheme } from '@/contexts/ThemeContext'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/applications', label: 'Applications', icon: BriefcaseBusiness },
  { href: '/resumes', label: 'Resumes', icon: FileText },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  async function handleLogout() {
    setIsLoggingOut(true)
    try {
      await logout()
      router.push('/login')
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <aside className="w-60 shrink-0 flex flex-col h-screen bg-card border-r border-border">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-border">
        <span className="text-base font-bold text-foreground tracking-tight">JobTracker</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-[--radius] text-sm font-medium transition-colors',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Theme toggle */}
      <div className="px-3 pb-1">
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-2 px-3 py-2 rounded-[--radius] text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title={theme === 'default' ? 'Switch to Rose theme' : 'Switch to Earthy theme'}
        >
          <Palette size={15} />
          {theme === 'default' ? 'Rose theme' : 'Earthy theme'}
        </button>
      </div>

      {/* User + logout */}
      <div className="border-t border-border px-4 py-4">
        {user && (
          <div className="mb-2 px-1">
            <p className="text-sm font-medium text-foreground truncate">{user.name ?? 'User'}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        )}
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex w-full items-center gap-2 px-3 py-2 rounded-[--radius] text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
        >
          {isLoggingOut ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
          Sign out
        </button>
      </div>
    </aside>
  )
}
