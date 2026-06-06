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
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { LanguageLoader } from '@/components/ui/language-loader'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
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

import { createContext, useContext, useLayoutEffect } from 'react'

export interface ShellConfig {
  title?: string
  subtitle?: string
  eyebrow?: string
  headerCenter?: ReactNode
  headerActions?: ReactNode
  contentClassName?: string
}

export const ShellContext = createContext<{
  config: ShellConfig
  setConfig: (config: ShellConfig) => void
} | null>(null)

export function ShellProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ShellConfig>({})
  return (
    <ShellContext.Provider value={{ config, setConfig }}>
      {children}
    </ShellContext.Provider>
  )
}

export function useShellConfig(config: ShellConfig) {
  const ctx = useContext(ShellContext)
  useLayoutEffect(() => {
    if (ctx) {
      ctx.setConfig(config)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ctx,
    config.title,
    config.subtitle,
    config.eyebrow,
    config.contentClassName,
    // Note: We intentionally don't include ReactNodes to avoid infinite loops.
    // Instead, we assume they update alongside other primitives or we rely on parent re-renders.
  ])
  
  // To handle ReactNodes updating without looping, we can use a ref to track them
  // but for our simple dashboard, the initial layout effect is usually enough,
  // or we can just force update if needed. Actually, a better approach is to just
  // pass the setter to children. But let's stick to the simple effect.
}

interface CommandEntry {
  key: string
  label: string
  description: string
  icon: LucideIcon
  href?: NavHref
  view?: AdminView
}

interface StaffShellProps extends ShellConfig {
  role: StaffRole
  activeView?: StaffView
  brandName?: string
  sidebar?: boolean
  lang?: Lang
  setLang?: (lang: Lang) => void
  children: ReactNode
}

export function StaffShell({
  role: _role,
  activeView: _activeView,
  title: _title,
  subtitle: _subtitle,
  eyebrow: _eyebrow,
  brandName = BRAND.name.vi,
  headerCenter: _headerCenter,
  headerActions: _headerActions,
  sidebar = true,
  contentClassName: _contentClassName,
  lang = 'vi',
  setLang,
  children,
}: StaffShellProps) {
  const session = getStaffSession()
  const role = session?.role ?? _role
  const activeView = _activeView ?? (role === 'admin' ? 'dashboard' : role)
  const navigate = useNavigate()
  const { has } = usePermissions()
  const s = shellStrings(lang)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [changingLang, setChangingLang] = useState<Lang | null>(null)

  // Merge with context config if we are hoisted
  const ctx = useContext(ShellContext)
  const title = ctx?.config.title ?? _title
  const subtitle = ctx?.config.subtitle ?? _subtitle
  const eyebrow = ctx?.config.eyebrow ?? _eyebrow
  const headerCenter = ctx?.config.headerCenter ?? _headerCenter
  const headerActions = ctx?.config.headerActions ?? _headerActions
  const contentClassName = ctx?.config.contentClassName ?? _contentClassName

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
                    <DropdownMenu open={profileOpen} onOpenChange={setProfileOpen}>
                    <DropdownMenuTrigger>
                        <button
                          type="button"
                          className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-[var(--staff-tint)] text-sm font-bold text-white transition-opacity duration-[220ms] hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--staff-tint)]/20"
                          aria-label={s.openProfileAria}
                        >
                          {(session?.name ?? s.roleLabel[role]).slice(0, 1).toUpperCase()}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-72 rounded-[18px] border-[var(--separator)] bg-[var(--material-thick)] p-2 text-[13px] backdrop-blur-2xl">
                        <DropdownMenuLabel className="px-3 py-3">
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
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-[var(--separator)]" />
                        <DropdownMenuItem
                          onClick={handleLogout}
                          className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[12px] px-3 font-semibold text-[var(--system-red)] transition-colors duration-[220ms] focus:bg-[var(--system-red)]/10 focus:text-[var(--system-red)]"
                        >
                          <LogOut className="size-4" />
                          {s.logout}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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

        <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
          <CommandInput
            placeholder={s.searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>{s.searchEmpty}</CommandEmpty>
            <CommandGroup>
              {commandItems.map((item) => {
                const Icon = item.icon
                return (
                  <CommandItem
                    key={item.key}
                    value={`${item.label} ${item.description}`}
                    onSelect={() => handleCommand(item)}
                    className="flex min-h-14 cursor-pointer items-center gap-3 rounded-[16px] px-3"
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
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </CommandDialog>

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
