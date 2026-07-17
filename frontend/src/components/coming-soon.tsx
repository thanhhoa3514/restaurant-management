import { Construction, type LucideIcon } from 'lucide-react'

import { useShellConfig } from '@/components/admin-shell'
import { useLang } from '@/hooks/use-lang'

interface ComingSoonProps {
  /** Localized page title, also pushed to the shell header. */
  title: string
  /** Localized one-line description for the shell subtitle. */
  subtitle?: string
  icon?: LucideIcon
}

const COPY = {
  vi: { badge: 'Đang phát triển', body: 'Màn quản lý này sẽ sớm ra mắt.' },
  en: { badge: 'In development', body: 'This management screen is coming soon.' },
} as const

/**
 * Honest placeholder for manage routes whose UI is not built yet. Replaces the
 * dead `navigate({ to: '/admin' })` stubs so nav items lead somewhere real.
 */
export function ComingSoon({ title, subtitle, icon: Icon = Construction }: ComingSoonProps) {
  const { lang } = useLang()
  const copy = COPY[lang]

  useShellConfig({ title, subtitle, contentClassName: 'bg-[var(--surface-grouped)]/45' })

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 px-6 py-20 text-center">
      <div className="flex size-16 items-center justify-center rounded-[20px] bg-[var(--surface-grouped)] text-[var(--text-secondary)]">
        <Icon className="size-8" />
      </div>
      <div className="space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--system-purple)]">
          {copy.badge}
        </div>
        <h2 className="text-[22px] font-semibold text-[var(--text)]">{title}</h2>
        <p className="text-sm text-[var(--text-secondary)]">{copy.body}</p>
      </div>
    </div>
  )
}
