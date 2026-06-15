/* eslint-disable react-refresh/only-export-components, react-doctor/only-export-components */
import { useNavigate } from '@tanstack/react-router'
import { LogOut, Search, UserRound } from 'lucide-react'
import {
  useMemo,
  useState,
  useCallback,
  useEffect,
  useReducer,
  type CSSProperties,
  type ReactNode,
} from 'react'

import { Button } from '@/components/ui/button'
import { LanguageLoader } from '@/components/ui/language-loader'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { TooltipProvider } from '@/components/ui/tooltip'
import { shellStrings } from '@/components/shell-i18n'
import { getStaffSession, logoutStaff, type StaffRole } from '@/lib/auth'
import { BRAND } from '@/lib/brand'
import { usePermissions } from '@/lib/permission-context'
import type { Lang } from '@/lib/use-lang'
import { cn } from '@/lib/utils'
import { roleTint, navItems, type StaffView, type AdminView } from './admin-config'
import { SidebarContent } from './admin-sidebar'
import { AdminCommandDialog, type CommandEntry } from './admin-search'

import { createContext, use, useLayoutEffect } from 'react'

export interface ShellConfig {
  title?: string
  subtitle?: string
  eyebrow?: string
  contentClassName?: string
}

const ShellContext = createContext<{
  config: ShellConfig
  setConfig: (config: ShellConfig) => void
} | null>(null)

export function ShellProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ShellConfig>({})
  // Memoize the context value so it only changes when `config` actually changes,
  // not on every provider render — keeps consumers from re-rendering needlessly.
  const value = useMemo(() => ({ config, setConfig }), [config])
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
}

export function useShellConfig(config: ShellConfig) {
  const ctx = use(ShellContext)
  // Depend ONLY on the stable setter (from useState) and the primitive config
  // values — never on `ctx` itself. The context value object is recreated when
  // `config` state changes, so listing `ctx` in the deps would re-fire this
  // effect on every setConfig and spin into an infinite update loop.
  const setConfig = ctx?.setConfig
  const { title, subtitle, eyebrow, contentClassName } = config
  useLayoutEffect(() => {
    setConfig?.({ title, subtitle, eyebrow, contentClassName })
  }, [setConfig, title, subtitle, eyebrow, contentClassName])
}

import { createPortal } from 'react-dom'
import { useSyncExternalStore } from 'react'

const emptySubscribe = () => () => {}

export function ShellHeaderCenter({ children }: { children: ReactNode }) {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
  const target = isClient ? document.getElementById('shell-header-center') : null
  if (!target) return null
  return createPortal(children, target)
}

export function ShellHeaderActions({ children }: { children: ReactNode }) {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
  const target = isClient ? document.getElementById('shell-header-actions') : null
  if (!target) return null
  return createPortal(children, target)
}

interface AdminShellProps extends ShellConfig {
  role: StaffRole
  activeView?: StaffView
  brandName?: string
  sidebar?: boolean
  lang?: Lang
  setLang?: (lang: Lang) => void
  children: ReactNode
}

export function AdminShell({
  role: _role,
  activeView: _activeView,
  title: _title,
  subtitle: _subtitle,
  eyebrow: _eyebrow,
  brandName = BRAND.name.vi,

  sidebar = true,
  contentClassName: _contentClassName,
  lang = 'vi',
  setLang,
  children,
}: AdminShellProps) {
  const session = getStaffSession()
  const role = session?.role ?? _role
  const activeView = _activeView ?? (role === 'admin' ? 'dashboard' : role)
  const navigate = useNavigate()
  const { has } = usePermissions()
  const s = shellStrings(lang)
  const [state, dispatch] = useReducer((s: any, a: any) => ({ ...s, ...a }), {
    mobileOpen: false,
    searchOpen: false,
    configOpen: false,
    profileOpen: false,
    query: '',
    changingLang: null as Lang | null,
  })
  const { mobileOpen, searchOpen, configOpen, profileOpen, query, changingLang } = state

  // Merge with context config if we are hoisted
  const ctx = use(ShellContext)
  const title = ctx?.config.title ?? _title
  const subtitle = ctx?.config.subtitle ?? _subtitle
  const eyebrow = ctx?.config.eyebrow ?? _eyebrow
  const contentClassName = ctx?.config.contentClassName ?? _contentClassName

  const nav = useMemo(() => navItems.filter((item) => has(item.permission)), [has])

  const handleCommand = useCallback(
    (href?: string, view?: string) => {
      if (href === '/admin')
        navigate({ to: '/admin', search: { view: view as AdminView | undefined } })
      else if (href)
        navigate({ to: href })((v: boolean) => dispatch({ searchOpen: v }))(false)((v: boolean) =>
          dispatch({ mobileOpen: v }),
        )(false)
    },
    [navigate],
  )

  const commandItems = useMemo<CommandEntry[]>(() => {
    const navEntries: CommandEntry[] = nav.map((item) => ({
      key: item.id,
      label: s.navLabel[item.id],
      description: s.navDesc[item.id],
      icon: item.icon,
      action: () => handleCommand(item.href, item.view),
    }))
    return navEntries.filter((item) =>
      `${item.label} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase()),
    )
  }, [nav, query, s, handleCommand])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()((v: boolean) => dispatch({ searchOpen: v }))(true)
      }
      if (event.key === 'Escape') {
        // ((v: boolean) => dispatch({ searchOpen: v }))(false)
        ;((v: boolean) => dispatch({ profileOpen: v }))(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const handleLogout = () => {
    logoutStaff()
    navigate({ to: '/login' })
  }

  const handleLangChange = (next: Lang) => {
    if (!setLang) return
    ;((v: Lang | null) => dispatch({ changingLang: v }))(next)
    setTimeout(() => {
      setLang(next)((v: Lang | null) => dispatch({ changingLang: v }))(null)
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
              <div className="flex min-h-16 items-center justify-end px-4 py-3 sm:px-5 lg:px-6">
                <div id="shell-header-actions" className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-10 rounded-full border border-[var(--separator)] bg-[var(--surface-grouped)]/70 px-3 text-[13px] text-[var(--text-secondary)] backdrop-blur-md"
                    onClick={() => ((v: boolean) => dispatch({ searchOpen: v }))(true)}
                  >
                    <Search className="size-4" />
                    <span className="hidden sm:inline">{s.search}</span>
                    <kbd className="hidden sm:inline rounded-md bg-[var(--bg-elevated)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-tertiary)]">
                      ⌘K
                    </kbd>
                  </Button>
                  {setLang && (
                    <LanguageSwitcher currentLang={lang} onLangChange={handleLangChange} />
                  )}
                  <div className="relative">
                    <DropdownMenu
                      open={profileOpen}
                      onOpenChange={(v: boolean) => dispatch({ profileOpen: v })}
                    >
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="relative h-10 w-10 rounded-full"
                          aria-label={s.openProfileAria}
                        >
                          <Avatar className="size-10">
                            <AvatarImage src="" />
                            <AvatarFallback className="bg-[var(--staff-tint)] text-white text-sm font-bold">
                              {(session?.name ?? s.roleLabel[role]).slice(0, 1).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-72 rounded-[18px] border-[var(--separator)] bg-[var(--material-thick)] p-2 text-[13px] backdrop-blur-2xl"
                      >
                        <div className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="size-10">
                              <AvatarImage src="" />
                              <AvatarFallback className="bg-[var(--surface-grouped)] text-[var(--text-secondary)]">
                                <UserRound className="size-5" />
                              </AvatarFallback>
                            </Avatar>
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

        <Sheet open={mobileOpen} onOpenChange={(v: boolean) => dispatch({ mobileOpen: v })}>
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
              onNavigate={() => ((v: boolean) => dispatch({ mobileOpen: v }))(false)}
            />
          </SheetContent>
        </Sheet>

        <AdminCommandDialog
          open={searchOpen}
          onOpenChange={(v: boolean) => dispatch({ searchOpen: v })}
          query={query}
          setQuery={(v: string) => dispatch({ query: v })}
          s={s}
          commandItems={commandItems}
        />

        {setLang && (
          <LanguageLoader open={changingLang !== null} targetLang={changingLang ?? lang} />
        )}
      </div>
    </TooltipProvider>
  )
}
