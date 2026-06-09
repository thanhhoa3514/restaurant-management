import * as React from 'react'

import { cn } from '@/lib/utils'

const Textarea = ({ className, ref, ...props }: React.ComponentProps<'textarea'>) => {
  return (
    <textarea
      className={cn(
        'flex min-h-[100px] w-full rounded-[14px] bg-[var(--surface-grouped)] px-[18px] py-[14px] text-[15px] text-[var(--text)] placeholder:text-[var(--text-tertiary)] transition-all duration-[220ms] ease-out',
        'border border-transparent',
        'hover:bg-[var(--surface-grouped)]/80',
        'focus-visible:outline-none focus-visible:ring-[4px] focus-visible:ring-[var(--system-blue)]/20 focus-visible:border-transparent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'resize-y',
        className,
      )}
      ref={ref}
      {...props}
    />
  )
}
Textarea.displayName = 'Textarea'

export { Textarea }
