import * as React from 'react'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'

import { cn } from '@/lib/utils'

/* -------------------------------------------------------------------------- */
/*  Sheet Provider (controls open/close)                                     */
/* -------------------------------------------------------------------------- */

interface SheetContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SheetContext = React.createContext<SheetContextValue | null>(null)

interface SheetProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

function Sheet({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange: controlledOnOpenChange,
  children,
}: SheetProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen
  const onOpenChange = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next)
      controlledOnOpenChange?.(next)
    },
    [isControlled, controlledOnOpenChange],
  )

  return <SheetContext.Provider value={{ open, onOpenChange }}>{children}</SheetContext.Provider>
}

function useSheet() {
  const ctx = React.useContext(SheetContext)
  if (!ctx) throw new Error('Sheet components must be used within <Sheet />')
  return ctx
}

/* -------------------------------------------------------------------------- */
/*  SheetTrigger                                                              */
/* -------------------------------------------------------------------------- */

interface SheetTriggerProps {
  asChild?: boolean
  children: React.ReactNode
  className?: string
}

const SheetTrigger = React.forwardRef<HTMLButtonElement, SheetTriggerProps>(
  ({ asChild, children, className, ...props }, ref) => {
    const { onOpenChange } = useSheet()
    if (asChild) {
      return (
        <SheetTriggerWithoutButtonWrapper onClick={() => onOpenChange(true)} className={className}>
          {children}
        </SheetTriggerWithoutButtonWrapper>
      )
    }
    return (
      <button ref={ref} onClick={() => onOpenChange(true)} className={className} {...props}>
        {children}
      </button>
    )
  },
)
SheetTrigger.displayName = 'SheetTrigger'

/* Small helper to clone element for asChild */
function SheetTriggerWithoutButtonWrapper({
  onClick,
  className,
  children,
}: {
  onClick: () => void
  className?: string
  children: React.ReactNode
}) {
  if (React.isValidElement(children)) {
    const el = children as React.ReactElement<{ className?: string }>
    return React.cloneElement(el, {
      onClick,
      className: cn(el.props.className, className),
    } as React.HTMLAttributes<HTMLElement>)
  }
  return <>{children}</>
}

/* -------------------------------------------------------------------------- */
/*  SheetContent (the actual panel)                                           */
/* -------------------------------------------------------------------------- */

type SheetSide = 'top' | 'bottom' | 'left' | 'right'

interface SheetContentProps {
  side?: SheetSide
  className?: string
  children: React.ReactNode
  /** Hide default close button */
  hideClose?: boolean
}

const SheetContent = React.forwardRef<HTMLDivElement, SheetContentProps>(
  ({ side = 'bottom', className, children, hideClose }, ref) => {
    const { open, onOpenChange } = useSheet()
    const [mounted, setMounted] = React.useState(false)
    const [visible, setVisible] = React.useState(false)

    React.useEffect(() => {
      if (open) {
        const raf = requestAnimationFrame(() => {
          setMounted(true)
          requestAnimationFrame(() => setVisible(true))
        })
        return () => cancelAnimationFrame(raf)
      } else {
        const t = setTimeout(() => {
          setVisible(false)
          setTimeout(() => setMounted(false), 420)
        }, 0)
        return () => clearTimeout(t)
      }
    }, [open])

    /* Close on Escape */
    React.useEffect(() => {
      if (!open) return
      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onOpenChange(false)
      }
      document.addEventListener('keydown', onKey)
      return () => document.removeEventListener('keydown', onKey)
    }, [open, onOpenChange])

    /* Lock body scroll */
    React.useEffect(() => {
      if (!mounted) return
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }, [mounted])

    if (!mounted) return null

    const sideClasses: Record<SheetSide, string> = {
      bottom:
        'inset-x-0 bottom-0 rounded-t-[16px] max-h-[85dvh] translate-y-0 data-[visible=false]:translate-y-full',
      top: 'inset-x-0 top-0 rounded-b-[16px] max-h-[85dvh] data-[visible=false]:-translate-y-full',
      left: 'inset-y-0 left-0 rounded-r-[16px] max-w-sm w-full data-[visible=false]:-translate-x-full',
      right:
        'inset-y-0 right-0 rounded-l-[16px] max-w-sm w-full data-[visible=false]:translate-x-full',
    }

    return createPortal(
      <div className="fixed inset-0 z-[400] flex" role="dialog" aria-modal="true">
        {/* Backdrop with vibrancy material */}
        <div
          className="absolute inset-0 transition-opacity duration-[420ms] ease-out data-[visible=false]:opacity-0"
          data-visible={visible}
          style={{
            backgroundColor: 'rgba(0,0,0,0.3)',
            backdropFilter: 'blur(30px) saturate(180%)',
            WebkitBackdropFilter: 'blur(30px) saturate(180%)',
          }}
          onClick={() => onOpenChange(false)}
        />

        {/* Panel */}
        <div
          ref={ref}
          data-visible={visible}
          className={cn(
            'absolute bg-white/78 shadow-2xl flex flex-col overflow-hidden',
            'transition-all duration-[420ms] ease-out',
            sideClasses[side],
            className,
          )}
          style={{
            backdropFilter: 'blur(30px) saturate(180%)',
            WebkitBackdropFilter: 'blur(30px) saturate(180%)',
          }}
        >
          {!hideClose && <SheetClose onClick={() => onOpenChange(false)} />}
          {children}
        </div>
      </div>,
      document.body,
    )
  },
)
SheetContent.displayName = 'SheetContent'

/* -------------------------------------------------------------------------- */
/*  SheetHeader                                                                */
/* -------------------------------------------------------------------------- */

interface SheetHeaderProps {
  title: string
  subtitle?: string
  className?: string
}

const SheetHeader = React.forwardRef<HTMLDivElement, SheetHeaderProps>(
  ({ title, subtitle, className }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-start justify-between gap-3 px-5 pt-5 pb-3', className)}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[17px] font-semibold text-[var(--text)] truncate">{title}</div>
        {subtitle && (
          <div className="text-[13px] text-[var(--text-secondary)] mt-0.5">{subtitle}</div>
        )}
      </div>
    </div>
  ),
)
SheetHeader.displayName = 'SheetHeader'

/* -------------------------------------------------------------------------- */
/*  SheetClose                                                                 */
/* -------------------------------------------------------------------------- */

interface SheetCloseProps {
  onClick: () => void
}

function SheetClose({ onClick }: SheetCloseProps) {
  return (
    <button
      onClick={onClick}
      className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-[var(--surface-grouped)] inline-flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--surface-grouped)]/80 transition-colors duration-[150ms] cursor-pointer"
      aria-label="Close"
    >
      <X size={14} />
    </button>
  )
}

export { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetClose }
export type { SheetSide }
