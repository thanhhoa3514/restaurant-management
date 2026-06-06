import { useNavigate } from '@tanstack/react-router'
import {
  BarChart3,
  ChefHat,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  QrCode,
  Search,
  Settings,
  SlidersHorizontal,
  Table2,
  UserRound,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { LanguageLoader } from '@/components/ui/language-loader'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { shellStrings } from '@/components/shell-i18n'
import {
  getStaffSession,
  logoutStaff,
  type PermissionCode,
  type StaffRole,
} from '@/lib/auth'
import { BRAND } from '@/lib/brand'
import { usePermissions } from '@/lib/permission-context'
import type { Lang } from '@/lib/use-lang'
import { cn } from '@/lib/utils'

type NavHref = '/admin' | '/admin/table-qrs'
type AdminView = 'dashboard' | 'cashier' | 'waiter' | 'kitchen'
export type StaffView = AdminView | 'table-qrs'

interface StaffShellProps {
  role: StaffRole
  activeView?: StaffView
  title: string
  subtitle?: string
  eyebrow?: string
  brandName?: string
  headerCenter?: ReactNode
  headerActions?: ReactNode
  sidebar?: boolean
  contentClassName?: string
  /** When provided, the header renders a language switcher wired to this state. */
  lang?: Lang
  setLang?: (lang: Lang) => void
  children: ReactNode
}

interface NavItem {
  id: string
  href: NavHref
  view?: AdminView
  icon: LucideIcon
  permission: PermissionCode
}

interface ToolItem {
  id: string
  icon: LucideIcon
  permission: PermissionCode
}

const roleTint: Record<StaffRole, string> = {
  admin: 'var(--system-purple)',
  cashier: 'var(--system-green)',
  waiter: 'var(--system-blue)',
  kitchen: 'var(--system-orange)',
}

const navItems: NavItem[] = [
  { id: 'dashboard', href: '/admin', view: 'dashboard', icon: LayoutDashboard, permission: 'identity.manage' },
  { id: 'table-qrs', href: '/admin/table-qrs', icon: QrCode, permission: 'dining.manage' },
  { id: 'cashier', href: '/admin', view: 'cashier', icon: CreditCard, permission: 'billing.process' },
  { id: 'waiter', href: '/admin', view: 'waiter', icon: Table2, permission: 'dining.serve' },
  { id: 'kitchen', href: '/admin', view: 'kitchen', icon: ChefHat, permission: 'kitchen.operate' },
]

const adminTools: ToolItem[] = [
  { id: 'catalog', icon: ClipboardList, permission: 'catalog.manage' },
  { id: 'staff', icon: UsersRound, permission: 'identity.manage' },
  { id: 'reports', icon: BarChart3, permission: 'identity.manage' },
  { id: 'settings', icon: Settings, permission: 'identity.manage' },
]

interface CommandEntry {
  key: string
  label: string
  description: string
  icon: LucideIcon
  href?: NavHref
  view?: AdminView
}

export function StaffShell({
  role,
  activeView = role === 'admin' ? 'dashboard' : role,
  title,
  subtitle,
  eyebrow,
  brandName = BRAND.name.vi,
  headerCenter,
  headerActions,
  sidebar = true,
  contentClassName,
  lang = 'vi',
  setLang,
  children,
}: StaffShellProps) {
  const navigate = useNavigate()
  const session = getStaffSession()
  const { has } = usePermissions()
  const s = shellStrings(lang)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [changingLang, setChangingLang] = useState<Lang | null>(null)

  const nav = useMemo(() => navItems.filter((item) => has(item.permission)), [has])

  const commandItems = useMemo<CommandEntry[]>(() => {
    const navEntries: CommandEntry[] = nav.map((item) => ({
      key: item.id,
      label: s.navLabel[item.id],
      description: s.navDesc[item.id],
      icon: item.icon,
      href: item.href,
      view: item.view,
    }))
    const toolEntries: CommandEntry[] = adminTools
      .filter((tool) => has(tool.permission))
      .map((tool) => ({
            key: tool.id,
            label: s.toolLabel[tool.id],
            description: s.toolDesc[tool.id],
            icon: tool.icon,
          }))
    return [...navEntries, ...toolEntries].filter((item) =>
      `${item.label} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase()),
    )
  }, [has, nav, query, s])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
      if (event.key === 'Escape') {
        setSearchOpen(false)
        setProfileOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleLogout = () => {
    logoutStaff()
    navigate({ to: '/login' })
  }

  const handleCommand = (item: CommandEntry) => {
    if (item.href === '/admin') navigate({ to: '/admin', search: { view: item.view } })
    else if (item.href) navigate({ to: item.href })
    setSearchOpen(false)
    setMobileOpen(false)
  }

  const handleLangChange = (next: Lang) => {
    if (!setLang) return
    setChangingLang(next)
    setTimeout(() => {
      setLang(next)
      setChangingLang(null)
    }, 750)
  }

  const shellStyle = { '--staff-tint': roleTint[role] } as CSSProperties

  return (
    <TooltipProvider>
      <div className="min-h-dvh bg-[var(--bg)] font-sans text-[var(--text)]" style={shellStyle}>
        <div className="flex min-h-dvh">
          {sidebar && (
            <aside className="safe-left hidden w-[264px] shrink-0 border-r border-[var(--separator)] bg-[var(--material-thin)] backdrop-blur-2xl lg:block">
              <SidebarContent
                nav={nav}
                role={role}
                activeView={activeView}
                brandName={brandName}
                s={s}
              />
            </aside>
          )}

          <div className="flex min-w-0 flex-1 flex-col">
            <header className="safe-top sticky top-0 z-[var(--z-sticky)] border-b border-[var(--separator)] bg-[var(--material-regular)] backdrop-blur-2xl">
              <div className="flex min-h-16 items-center gap-3 px-4 py-3 sm:px-5 lg:px-6">
                {sidebar && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="size-11 shrink-0 rounded-full border border-[var(--separator)] bg-[var(--material-thin)] lg:hidden"
                    onClick={() => setMobileOpen(true)}
                    aria-label={s.openNavAria}
                  >
                    <Menu />
                  </Button>
                )}

                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--staff-tint)]">
                    {eyebrow ?? s.roleLabel[role]}
                  </p>
                  <h1 className="truncate text-[22px] font-semibold leading-tight text-[var(--text)]">
                    {title}
                  </h1>
                  {subtitle && (
                    <p className="truncate text-[13px] font-medium text-[var(--text-secondary)]">
                      {subtitle}
                    </p>
                  )}
                </div>

                {headerCenter && (
                  <div className="hidden min-w-0 flex-1 items-center justify-center xl:flex">
                    {headerCenter}
                  </div>
                )}

                <div className="ml-auto flex shrink-0 items-center gap-2">
                  {headerActions}
                  <Button
                    type="button"
                    variant="secondary"
                    className="hidden h-10 rounded-full border border-[var(--separator)] bg-[var(--surface-grouped)]/70 px-3 text-[13px] text-[var(--text-secondary)] backdrop-blur-md sm:inline-flex"
                    onClick={() => setSearchOpen(true)}
                  >
                    <Search className="size-4" />
                    <span>{s.search}</span>
                    <kbd className="rounded-md bg-[var(--bg-elevated)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-tertiary)]">
                      ⌘K
                    </kbd>
                  </Button>
                  {setLang && (
                    <LanguageSwitcher
                      currentLang={lang}
                      onLangChange={handleLangChange}
                      className="hidden sm:inline-flex"
                    />
                  )}
                  <ThemeToggle />
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="size-10 rounded-full border border-[var(--separator)] bg-[var(--material-thin)] backdrop-blur-md"
                    onClick={() => setConfigOpen(true)}
                    aria-label={s.openSettingsAria}
                  >
                    <SlidersHorizontal />
                  </Button>
                  <div className="relative">
                    <button
                      type="button"
                      className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-[var(--staff-tint)] text-sm font-bold text-white transition-opacity duration-[220ms] hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--staff-tint)]/20"
                      onClick={() => setProfileOpen((open) => !open)}
                      aria-label={s.openProfileAria}
                      aria-expanded={profileOpen}
                    >
                      {(session?.name ?? s.roleLabel[role]).slice(0, 1).toUpperCase()}
                    </button>
                    {profileOpen && (
                      <div className="absolute right-0 top-12 z-[var(--z-dropdown)] w-72 overflow-hidden rounded-[18px] border border-[var(--separator)] bg-[var(--material-thick)] p-2 text-[13px] backdrop-blur-2xl">
                        <div className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-full bg-[var(--surface-grouped)] text-[var(--text-secondary)]">
                              <UserRound className="size-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-[var(--text)]">
                                {session?.name ?? s.staffFallback}
                              </div>
                              <div className="truncate text-[12px] text-[var(--text-tertiary)]">
                                {session?.code ?? s.roleLabel[role]} · {s.roleLabel[role]}
                              </div>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-[12px] px-3 text-left font-semibold text-[var(--system-red)] transition-colors duration-[220ms] hover:bg-[var(--system-red)]/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--system-red)]/20"
                        >
                          <LogOut className="size-4" />
                          {s.logout}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </header>

            <main
              className={cn(
                'safe-bottom min-h-0 flex-1 overflow-auto p-4 sm:p-5 lg:p-6',
                contentClassName,
              )}
            >
              {children}
            </main>
          </div>
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            className="max-w-[288px] bg-[var(--material-thick)] text-[var(--text)]"
            hideClose
          >
            <SidebarContent
              nav={nav}
              role={role}
              activeView={activeView}
              brandName={brandName}
              s={s}
              onNavigate={() => setMobileOpen(false)}
            />
          </SheetContent>
        </Sheet>

        <Sheet open={configOpen} onOpenChange={setConfigOpen}>
          <SheetContent side="right" className="bg-[var(--material-thick)] text-[var(--text)]">
            <SheetHeader title={s.settingsTitle} />
            <div className="space-y-4 px-5 pb-5 pt-2">
              <div className="rounded-[18px] bg-[var(--surface-grouped)]/70 p-4">
                <div className="mb-3 text-sm font-semibold text-[var(--text)]">{s.displayMode}</div>
                <ThemeToggle />
              </div>
              {setLang && (
                <div className="rounded-[18px] bg-[var(--surface-grouped)]/70 p-4">
                  <LanguageSwitcher currentLang={lang} onLangChange={handleLangChange} />
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {searchOpen && (
          <div
            className="fixed inset-0 z-[var(--z-modal)] flex items-start justify-center bg-black/30 px-4 pt-[12dvh] backdrop-blur-[30px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-command-title"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSearchOpen(false)
            }}
          >
            <div className="w-full max-w-2xl overflow-hidden rounded-[24px] border border-[var(--separator)] bg-[var(--material-thick)] backdrop-blur-2xl">
              <div className="flex items-center gap-3 border-b border-[var(--separator)] px-4">
                <Search className="size-5 text-[var(--text-tertiary)]" />
                <label className="sr-only" htmlFor="staff-command-search" id="staff-command-title">
                  {s.searchAria}
                </label>
                <input
                  id="staff-command-search"
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={s.searchPlaceholder}
                  className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-[var(--text)] outline-none placeholder:text-[var(--text-tertiary)]"
                />
                <button
                  type="button"
                  className="flex size-9 cursor-pointer items-center justify-center rounded-full text-[var(--text-tertiary)] transition-colors duration-[220ms] hover:bg-[var(--surface-grouped)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--staff-tint)]/20"
                  onClick={() => setSearchOpen(false)}
                  aria-label={s.closeSearchAria}
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="max-h-[52dvh] overflow-auto p-2">
                {commandItems.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-[var(--text-secondary)]">
                    {s.searchEmpty}
                  </div>
                ) : (
                  commandItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <button
                        key={item.key}
                        type="button"
                        className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-[16px] px-3 text-left transition-colors duration-[220ms] hover:bg-[var(--surface-grouped)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--staff-tint)]/20"
                        onClick={() => handleCommand(item)}
                      >
                        <span className="flex size-10 items-center justify-center rounded-[14px] bg-[var(--staff-tint)]/10 text-[var(--staff-tint)]">
                          <Icon className="size-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold text-[var(--text)]">
                            {item.label}
                          </span>
                          <span className="block truncate text-[12px] text-[var(--text-secondary)]">
                            {item.description}
                          </span>
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {setLang && (
          <LanguageLoader open={changingLang !== null} targetLang={changingLang ?? lang} />
        )}
      </div>
    </TooltipProvider>
  )
}

function SidebarContent({
  nav,
  role,
  activeView,
  brandName,
  s,
  onNavigate,
}: {
  nav: NavItem[]
  role: StaffRole
  activeView: StaffView
  brandName: string
  s: ReturnType<typeof shellStrings>
  onNavigate?: () => void
}) {
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
    </div>
  )
}
