import { useNavigate } from '@tanstack/react-router'
import type { CSSProperties } from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { shellStrings } from '@/components/shell-i18n'
import type { StaffRole } from '@/lib/auth'
import { BRAND } from '@/lib/brand'
import { cn } from '@/lib/utils'
import { roleTint, type NavGroup, type NavItem, type StaffView } from '@/components/admin-config'

interface SidebarContentProps {
  nav: NavItem[]
  role: StaffRole
  activeView: StaffView
  brandName: string
  s: ReturnType<typeof shellStrings>
  onNavigate?: () => void
}

// Render order for the grouped nav. Filtered to groups that actually have
// permitted items so a single-permission staff member sees a flat list.
const GROUP_ORDER: NavGroup[] = ['manage', 'operate']

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

  const isActive = (item: NavItem) =>
    item.view ? item.href === '/admin' && item.view === activeView : item.id === activeView

  const groups = GROUP_ORDER.map((group) => ({
    group,
    items: nav.filter((item) => item.group === group),
  })).filter((entry) => entry.items.length > 0)

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

      <div className="space-y-6">
        {groups.map(({ group, items }) => (
          <nav key={group} className="space-y-1" aria-label={s.navGroup[group]}>
            <div className="mb-1 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
              {s.navGroup[group]}
            </div>
            {items.map((item) => {
              const Icon = item.icon
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => handleNavigate(item)}
                      className={cn(
                        'group flex min-h-12 w-full items-center gap-3 rounded-[16px] px-3 text-left text-[15px] font-semibold transition-colors duration-[220ms] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--staff-tint)]/20',
                        isActive(item)
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
        ))}
      </div>
    </div>
  )
}
