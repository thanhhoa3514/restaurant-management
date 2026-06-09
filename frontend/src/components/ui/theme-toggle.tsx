import { type FC, useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import { Button } from './button'

export const ThemeToggle: FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light'
    const saved = localStorage.getItem('rest_theme')
    if (saved === 'dark' || saved === 'light') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
      localStorage.setItem('rest_theme', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('rest_theme', 'light')
    }
  }, [theme])

  return (
    <Button
      variant="secondary"
      size="icon"
      className="relative size-10 rounded-full border border-[var(--separator)] bg-[var(--material-thin)] backdrop-blur-md overflow-hidden active:scale-95 transition-all cursor-pointer hover:bg-[var(--surface-grouped)]/85"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label="Toggle theme"
      type="button"
    >
      {/* Sun icon: rotates and scales out when dark */}
      <Sun 
        className={`absolute size-[18px] text-[var(--system-yellow)] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          theme === 'dark' 
            ? 'rotate-90 scale-0 opacity-0' 
            : 'rotate-0 scale-100 opacity-100'
        }`} 
      />
      {/* Moon icon: rotates and scales in when dark */}
      <Moon 
        className={`absolute size-[18px] text-[var(--system-purple)] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          theme === 'dark' 
            ? 'rotate-0 scale-100 opacity-100' 
            : '-rotate-90 scale-0 opacity-0'
        }`} 
      />
    </Button>
  )
}


