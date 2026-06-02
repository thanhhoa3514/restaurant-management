import type { FC } from 'react'
import { useOrdering } from '../hooks/use-ordering'
import { DICT } from '../data/i18n'
import { Button } from '../../../components/ui/button'
import { Badge } from '../../../components/ui/badge'

export const QRLanding: FC = () => {
  const { state, dispatch } = useOrdering()
  const t = DICT[state.lang]

  const handleStart = () => {
    dispatch({
      type: 'SET_SESSION',
      payload: {
        token: crypto.randomUUID().slice(0, 8),
        table: 7,
        startedAt: new Date(),
      },
    })
    dispatch({ type: 'SET_SCREEN', payload: 'menu' })
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 gap-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="size-32 rounded-full bg-system-blue/10 flex items-center justify-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-system-blue">
            <path d="M3 3h18v18H3z" />
            <path d="M9 9h6v6H9z" />
            <path d="M3 9h6" />
            <path d="M15 9h6" />
            <path d="M3 15h6" />
            <path d="M15 15h6" />
            <path d="M9 3v6" />
            <path d="M9 15v6" />
            <path d="M15 3v6" />
            <path d="M15 15v6" />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">
            {t.restaurant}
          </h1>
          <p className="text-sm text-secondary mt-1">{t.tagline}</p>
        </div>
      </div>

      <div className="w-full max-w-xs rounded-xl bg-elevated p-6 flex flex-col items-center gap-3">
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
          {t.table} 7
        </Badge>
        <div className="size-40 rounded-xl bg-surface-grouped flex items-center justify-center">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-quaternary">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="6" cy="6" r="1" fill="currentColor" />
            <circle cx="10" cy="6" r="1" fill="currentColor" />
            <circle cx="14" cy="6" r="1" fill="currentColor" />
            <circle cx="18" cy="6" r="1" fill="currentColor" />
            <circle cx="6" cy="10" r="1" fill="currentColor" />
            <circle cx="10" cy="10" r="1" fill="currentColor" />
            <circle cx="14" cy="10" r="1" fill="currentColor" />
            <circle cx="18" cy="10" r="1" fill="currentColor" />
            <circle cx="6" cy="14" r="1" fill="currentColor" />
            <circle cx="10" cy="14" r="1" fill="currentColor" />
            <circle cx="14" cy="14" r="1" fill="currentColor" />
            <circle cx="18" cy="14" r="1" fill="currentColor" />
            <circle cx="6" cy="18" r="1" fill="currentColor" />
            <circle cx="10" cy="18" r="1" fill="currentColor" />
            <circle cx="14" cy="18" r="1" fill="currentColor" />
            <circle cx="18" cy="18" r="1" fill="currentColor" />
          </svg>
        </div>
        <p className="text-xs text-tertiary text-center">{t.session_hint}</p>
      </div>

      <Button
        size="lg"
        className="w-full max-w-xs rounded-xl text-base font-semibold h-14"
        onClick={handleStart}
      >
        {t.start_ordering}
      </Button>

      <p className="text-xs text-quaternary">
        {t.now}: {new Date().toLocaleTimeString()}
      </p>
    </div>
  )
}
