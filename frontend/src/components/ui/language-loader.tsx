import { type FC, useEffect, useReducer, useState } from 'react'

import { Loader2 } from 'lucide-react'

interface LanguageLoaderProps {
  open: boolean
  targetLang: 'vi' | 'en'
}

type LoaderState = { status: 'hidden' | 'entering' | 'visible' | 'exiting' }
type Action = { type: 'OPEN' } | { type: 'MAKE_VISIBLE' } | { type: 'CLOSE' } | { type: 'HIDE' }

function loaderReducer(state: LoaderState, action: Action): LoaderState {
  switch (action.type) {
    case 'OPEN':
      return { status: 'entering' }
    case 'MAKE_VISIBLE':
      return state.status === 'entering' ? { status: 'visible' } : state
    case 'CLOSE':
      return state.status === 'visible' || state.status === 'entering' ? { status: 'exiting' } : state
    case 'HIDE':
      return state.status === 'exiting' ? { status: 'hidden' } : state
    default:
      return state
  }
}

export const LanguageLoader: FC<LanguageLoaderProps> = ({ open, targetLang }) => {
  const [state, dispatch] = useReducer(loaderReducer, { status: open ? 'visible' : 'hidden' })
  
  // Track previous prop inline to avoid useEffect state adjustments
  const [prevOpen, setPrevOpen] = useState(() => open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    dispatch(open ? { type: 'OPEN' } : { type: 'CLOSE' })
  }

  useEffect(() => {
    if (state.status === 'entering') {
      const t = setTimeout(() => dispatch({ type: 'MAKE_VISIBLE' }), 20)
      return () => clearTimeout(t)
    } else if (state.status === 'exiting') {
      const t = setTimeout(() => dispatch({ type: 'HIDE' }), 300)
      return () => clearTimeout(t)
    }
  }, [state.status])

  if (state.status === 'hidden') return null

  const animationClass = state.status === 'visible'
    ? 'opacity-100 scale-100'
    : 'opacity-0 scale-95 pointer-events-none'

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
