'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'default' | 'alt'
const STORAGE_KEY = 'jt-theme'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'default', toggleTheme: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('default')

  // Read persisted theme on mount and apply to <html>
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    if (stored === 'alt') {
      document.documentElement.classList.add('alt-theme')
      setTheme('alt')
    }
  }, [])

  function toggleTheme() {
    setTheme(prev => {
      const next: Theme = prev === 'default' ? 'alt' : 'default'
      if (next === 'alt') {
        document.documentElement.classList.add('alt-theme')
      } else {
        document.documentElement.classList.remove('alt-theme')
      }
      localStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}
