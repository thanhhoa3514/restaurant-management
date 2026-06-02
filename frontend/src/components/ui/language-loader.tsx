import { type FC, useEffect, useState } from 'react'

interface LanguageLoaderProps {
  open: boolean
  targetLang: 'vi' | 'en'
}

export const LanguageLoader: FC<LanguageLoaderProps> = ({ open, targetLang }) => {
  const [shouldRender, setShouldRender] = useState(open)
  const [animationClass, setAnimationClass] = useState('opacity-0 scale-95 pointer-events-none')

  useEffect(() => {
    if (open) {
      setShouldRender(true)
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
        {/* Simple & Clean Stripe/Vercel style spinner */}
        <div className="relative flex size-10 items-center justify-center select-none">
          <svg 
            className="animate-spin text-[var(--system-blue)] size-full" 
            fill="none" 
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* The transparent circular track */}
            <circle 
              className="opacity-15" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="3" 
            />
            {/* The elegant spinning arc */}
            <path 
              className="opacity-85" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
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
