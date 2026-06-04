import { Link, useNavigate } from '@tanstack/react-router'
import {
  BarChart3,
  ChefHat,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
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
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { getStaffSession, logoutStaff, type StaffRole } from '@/lib/auth'
import { cn } from '@/lib/utils'

interface StaffShellProps {
  role: StaffRole
  title: string
  subtitle?: string
  eyebrow?: string
  brandName?: string
  headerCenter?: ReactNode
  headerActions?: ReactNode
  sidebar?: boolean
  contentClassName?: string
  children: ReactNode
}

interface NavItem {
  label: string
  href: '/admin' | '/cashier' | '/waiter' | '/kitchen'
  icon: LucideIcon
  roles: StaffRole[]
  description: string
}

const roleLabels: Record<StaffRole, string> = {
  admin: 'Quản trị',
  cashier: 'Thu ngân',
  waiter: 'Phục vụ',
  kitchen: 'Bếp',
}

const roleTint: Record<StaffRole, string> = {
  admin: 'var(--system-purple)',
  cashier: 'var(--system-green)',
  waiter: 'var(--system-blue)',
  kitchen: 'var(--system-orange)',
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
    roles: ['admin'],
    description: 'Tổng quan vận hành',
  },
  {
    label: 'Thanh toán',
    href: '/cashier',
    icon: CreditCard,
    roles: ['admin', 'cashier'],
    description: 'Hóa đơn và POS',
  },
  {
    label: 'Sơ đồ bàn',
    href: '/waiter',
    icon: Table2,
    roles: ['admin', 'waiter'],
    description: 'Phòng ăn và yêu cầu',
  },
  {
    label: 'Bếp KDS',
    href: '/kitchen',
    icon: ChefHat,
    roles: ['admin', 'kitchen'],
    description: 'Hàng đợi món',
  },
]

const adminTools = [
  { label: 'Danh mục món', icon: ClipboardList, description: 'Ẩn/hiện món và cập nhật giá' },
  { label: 'Nhân sự', icon: UsersRound, description: 'Vai trò và ca trực' },
  { label: 'Báo cáo', icon: BarChart3, description: 'Doanh thu và vận hành' },
  { label: 'Cài đặt', icon: Settings, description: 'Nhà hàng và giao diện' },
]

type CommandItem = NavItem | (typeof adminTools)[number]

export function StaffShell({
  role,
  title,
  subtitle,
  eyebrow,
  brandName = 'Quán Cơm Tấm Sài Gòn',
  headerCenter,
  headerActions,
  sidebar = true,
  contentClassName,
  children,
}: StaffShellProps) {
  const navigate = useNavigate()
  const session = getStaffSession()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [query, setQuery] = useState('')

  const nav = useMemo(() => navItems.filter((item) => item.roles.includes(role)), [role])
  const commandItems = useMemo(
    () =>
      ([...nav, ...(role === 'admin' ? adminTools : [])] as CommandItem[]).filter((item) =>
        `${item.label} ${item.description}`.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [nav, query, role],
  )

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

  const handleCommand = (item: CommandItem) => {
    if ('href' in item) navigate({ to: item.href })
    setSearchOpen(false)
    setMobileOpen(false)
  }

  const shellStyle = { '--staff-tint': roleTint[role] } as CSSProperties

  return (
    <div className="min-h-dvh bg-[var(--bg)] font-sans text-[var(--text)]" style={shellStyle}>
      <div className="flex min-h-dvh">
        {sidebar && (
          <aside className="safe-left hidden w-[264px] shrink-0 border-r border-[var(--separator)] bg-[var(--material-thin)] backdrop-blur-2xl lg:block">
            <SidebarContent nav={nav} role={role} brandName={brandName} />
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
                  aria-label="Mở điều hướng nhân viên"
                >
                  <Menu />
                </Button>
              )}

              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--staff-tint)]">
                  {eyebrow ?? roleLabels[role]}
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
                  <span>Tìm kiếm</span>
                  <kbd className="rounded-md bg-[var(--bg-elevated)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-tertiary)]">
                    ⌘K
                  </kbd>
                </Button>
                <ThemeToggle />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="size-10 rounded-full border border-[var(--separator)] bg-[var(--material-thin)] backdrop-blur-md"
                  onClick={() => setConfigOpen(true)}
                  aria-label="Mở cài đặt giao diện"
                >
                  <SlidersHorizontal />
                </Button>
                <div className="relative">
                  <button
                    type="button"
                    className="flex size-10 cursor-pointer items-center justify-center rounded-full bg-[var(--staff-tint)] text-sm font-bold text-white transition-opacity duration-[220ms] hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--staff-tint)]/20"
                    onClick={() => setProfileOpen((open) => !open)}
                    aria-label="Mở menu hồ sơ"
                    aria-expanded={profileOpen}
                  >
                    {(session?.name ?? roleLabels[role]).slice(0, 1).toUpperCase()}
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
                              {session?.name ?? 'Nhân viên'}
                            </div>
                            <div className="truncate text-[12px] text-[var(--text-tertiary)]">
                              {session?.code ?? roleLabels[role]} · {roleLabels[role]}
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
                        Đăng xuất
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
            brandName={brandName}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={configOpen} onOpenChange={setConfigOpen}>
        <SheetContent side="right" className="bg-[var(--material-thick)] text-[var(--text)]">
          <SheetHeader title="Cấu hình giao diện" subtitle="Apple Glass tokens được giữ nguyên." />
          <div className="space-y-4 px-5 pb-5 pt-2">
            <div className="rounded-[18px] bg-[var(--surface-grouped)]/70 p-4">
              <div className="mb-3 text-sm font-semibold text-[var(--text)]">Chế độ hiển thị</div>
              <ThemeToggle />
            </div>
            <div className="rounded-[18px] bg-[var(--surface-grouped)]/70 p-4 text-sm leading-6 text-[var(--text-secondary)]">
              Sidebar, header và command search dùng token blur 30px, radius mềm và một tint theo
              vai trò.
            </div>
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
                Tìm kiếm tác vụ
              </label>
              <input
                id="staff-command-search"
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm trang, báo cáo, thao tác..."
                className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-[var(--text)] outline-none placeholder:text-[var(--text-tertiary)]"
              />
              <button
                type="button"
                className="flex size-9 cursor-pointer items-center justify-center rounded-full text-[var(--text-tertiary)] transition-colors duration-[220ms] hover:bg-[var(--surface-grouped)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--staff-tint)]/20"
                onClick={() => setSearchOpen(false)}
                aria-label="Đóng tìm kiếm"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="max-h-[52dvh] overflow-auto p-2">
              {commandItems.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-[var(--text-secondary)]">
                  Không tìm thấy tác vụ phù hợp.
                </div>
              ) : (
                commandItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.label}
                      type="button"
                      className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-[16px] px-3 text-left transition-colors duration-[220ms] hover:bg-[var(--surface-grouped)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--staff-tint)]/20"
                      onClick={() => handleCommand(item)}
                    >
                      <span className="flex size-10 items-center justify-center rounded-[14px] bg-[var(--staff-tint)]/10 text-[var(--staff-tint)]">
                        <Icon className="size-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-[var(--text)]">{item.label}</span>
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
    </div>
  )
}

function SidebarContent({
  nav,
  role,
  brandName,
  onNavigate,
}: {
  nav: NavItem[]
  role: StaffRole
  brandName: string
  onNavigate?: () => void
}) {
  return (
    <div
      className="flex h-full flex-col p-4"
      style={{ '--staff-tint': roleTint[role] } as CSSProperties}
    >
      <div className="mb-6 flex items-center gap-3 px-2 pt-2">
        <div className="flex size-11 items-center justify-center rounded-[16px] bg-[var(--text)] text-[13px] font-black tracking-tight text-[var(--bg)]">
          CS
        </div>
        <div className="min-w-0">
          <div className="truncate text-[17px] font-semibold text-[var(--text)]">{brandName}</div>
          <div className="truncate text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--staff-tint)]">
            Staff OS
          </div>
        </div>
      </div>

      <nav className="space-y-1" aria-label="Điều hướng nhân viên">
        {nav.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onNavigate}
              activeProps={{ className: 'bg-[var(--staff-tint)]/12 text-[var(--staff-tint)]' }}
              inactiveProps={{
                className:
                  'text-[var(--text-secondary)] hover:bg-[var(--surface-grouped)] hover:text-[var(--text)]',
              }}
              className="group flex min-h-12 items-center gap-3 rounded-[16px] px-3 text-[15px] font-semibold transition-colors duration-[220ms] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--staff-tint)]/20"
            >
              <Icon className="size-5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto rounded-[20px] bg-[var(--surface-grouped)]/70 p-4 text-[12px] leading-5 text-[var(--text-secondary)]">
        Nav lọc theo vai trò {roleLabels[role].toLowerCase()}. Guest /order không bị chạm.
      </div>
    </div>
  )
}
