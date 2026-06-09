import { type FC, useEffect, useState } from 'react'

import { Loader2 } from 'lucide-react'

interface LanguageLoaderProps {
  open: boolean
  targetLang: 'vi' | 'en'
}

export const LanguageLoader: FC<LanguageLoaderProps> = ({ open, targetLang }) => {
  const [prevOpen, setPrevOpen] = useState(open)
  const [shouldRender, setShouldRender] = useState(open)
  const [animationClass, setAnimationClass] = useState(
    open ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
  )

  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setShouldRender(true)
    }
  }

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => {
        setAnimationClass('opacity-100 scale-100')
      }, 20)
      return () => clearTimeout(t)
    } else {
      setAnimationClass('opacity-0 scale-95 pointer-events-none')
      const t = setTimeout(() => {
        setShouldRender(false)
      }, 300) // matches transition duration
      return () => clearTimeout(t)
    }
  }, [open])

  if (!shouldRender) return null

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/25 backdrop-blur-xs transition-all duration-300 ${animationClass}`}
    >
      {/* Super minimal, elegant, and compact card */}
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl bg-[var(--bg-elevated)] p-6 shadow-xl border border-[var(--separator)] max-w-[180px] w-full text-center backdrop-blur-xl">
        <div className="relative flex size-10 items-center justify-center select-none">
          <Loader2 className="animate-spin size-full text-[var(--system-blue)]" />
        </div>

        {/* Minimalist translation text */}
        <p className="text-[12px] font-bold tracking-normal text-[var(--text-secondary)]">
          {targetLang === 'vi' ? 'Đang chuyển ngữ...' : 'Switching...'}
        </p>
      </div>
    </div>
  )
}

export default LanguageLoader
