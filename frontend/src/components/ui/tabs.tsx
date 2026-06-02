import * as React from 'react'

import { cn } from '@/lib/utils'

const TabsContext = React.createContext<{
  value: string
  onValueChange: (value: string) => void
} | null>(null)

interface TabsProps {
  value: string
  onValueChange: (value: string) => void
  className?: string
  children: React.ReactNode
}

function Tabs({ value, onValueChange, className, children }: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn('inline-flex gap-1 p-0.5', className)}>{children}</div>
    </TabsContext.Provider>
  )
}

function useTabs() {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error('Tabs components must be used within <Tabs />')
  return ctx
}

interface TabsTriggerProps {
  value: string
  className?: string
  children: React.ReactNode
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ value, className, children, ...props }, ref) => {
    const { value: selected, onValueChange } = useTabs()
    const active = value === selected
    return (
      <button
        ref={ref}
        role="tab"
        aria-selected={active}
        onClick={() => onValueChange(value)}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-[220ms] ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--system-blue)] focus-visible:ring-offset-2 cursor-pointer',
          active
            ? 'bg-white text-[var(--text)] shadow-sm'
            : 'text-[var(--text-secondary)] hover:text-[var(--text)]',
          className,
        )}
        {...props}
      >
        {children}
      </button>
    )
  },
)
TabsTrigger.displayName = 'TabsTrigger'

interface TabsListProps {
  className?: string
  children: React.ReactNode
}

const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1 rounded-full bg-[var(--surface-grouped)] p-0.5',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    )
  },
)
TabsList.displayName = 'TabsList'

interface TabsContentProps {
  value: string
  className?: string
  children: React.ReactNode
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ value, className, children, ...props }, ref) => {
    const { value: selected } = useTabs()
    if (value !== selected) return null
    return (
      <div ref={ref} className={cn('mt-2', className)} {...props}>
        {children}
      </div>
    )
  },
)
TabsContent.displayName = 'TabsContent'

export { Tabs, TabsList, TabsTrigger, TabsContent }
