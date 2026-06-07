import { useNavigate } from '@tanstack/react-router'
import type { CSSProperties } from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { shellStrings } from '@/components/shell-i18n'
import type { StaffRole } from '@/lib/auth'
import { BRAND } from '@/lib/brand'
import { cn } from '@/lib/utils'
import { roleTint, adminTools, type NavItem, type StaffView } from '@/components/admin-config'

interface SidebarContentProps {
  nav: NavItem[]
  role: StaffRole
  activeView: StaffView
  brandName: string
  s: ReturnType<typeof shellStrings>
  onNavigate?: () => void
}

export function SidebarContent({
  nav,
  role,
  activeView,
  brandName,
  s,
  onNavigate,
}: SidebarContentProps) {
  const navigate = useNavigate()

  const handleNavigate = (item: NavItem) => {
    if (item.href === '/admin') {
      navigate({ to: '/admin', search: { view: item.view } })
    } else {
      navigate({ to: item.href })
    }
    onNavigate?.()
  }

  return (
    <div
      className="flex h-full flex-col p-4"
      style={{ '--staff-tint': roleTint[role] } as CSSProperties}
    >
      <div className="mb-6 flex items-center gap-3 px-2 pt-2">
        <div className="flex size-11 items-center justify-center rounded-[16px] bg-[var(--text)] text-[13px] font-black tracking-tight text-[var(--bg)]">
          {BRAND.shortName}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[17px] font-semibold text-[var(--text)]">{brandName}</div>
          <div className="truncate text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--staff-tint)]">
            {s.staffOs}
          </div>
        </div>
      </div>

      <nav className="space-y-1" aria-label={s.navAria}>
        {nav.map((item) => {
          const Icon = item.icon
          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => handleNavigate(item)}
                  className={cn(
                    'group flex min-h-12 w-full items-center gap-3 rounded-[16px] px-3 text-left text-[15px] font-semibold transition-colors duration-[220ms] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--staff-tint)]/20',
                    (item.href === '/admin' && item.view === activeView) ||
                      (item.href === '/admin/table-qrs' && activeView === 'table-qrs')
                      ? 'bg-[var(--staff-tint)]/12 text-[var(--staff-tint)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-grouped)] hover:text-[var(--text)]',
                  )}
                >
                  <Icon className="size-5 shrink-0" />
                  <span>{s.navLabel[item.id]}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{s.navDesc[item.id]}</TooltipContent>
            </Tooltip>
          )
        })}
      </nav>

      {role === 'admin' && (
        <div className="mt-8">
          <div className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
            {s.settingsTitle || 'Management'}
          </div>
          <nav className="space-y-1">
            {adminTools.map((tool) => {
              const Icon = tool.icon
              return (
                <Tooltip key={tool.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => navigate({ to: '/admin' })} // Stub for now until real routes exist
                      className="group flex min-h-12 w-full items-center gap-3 rounded-[16px] px-3 text-left text-[15px] font-semibold text-[var(--text-secondary)] transition-colors duration-[220ms] hover:bg-[var(--surface-grouped)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--staff-tint)]/20"
                    >
                      <Icon className="size-5 shrink-0" />
                      <span>{s.toolLabel[tool.id]}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{s.toolDesc[tool.id]}</TooltipContent>
                </Tooltip>
              )
            })}
          </nav>
        </div>
      )}
    </div>
  )
}
