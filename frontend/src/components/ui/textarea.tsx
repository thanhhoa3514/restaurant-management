import * as React from 'react'

import { cn } from '@/lib/utils'

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[60px] w-full rounded-[10px] bg-[var(--surface-grouped)] px-[14px] py-[11px] text-sm text-[var(--text)] placeholder:text-[var(--text-tertiary)] transition-all duration-[220ms] ease-out resize-none',
          'border border-transparent',
          'hover:bg-[var(--surface-grouped)]/80',
          'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--system-blue)]/18 focus-visible:border-transparent',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Textarea.displayName = 'Textarea'

export { Textarea }
