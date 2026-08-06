import * as React from 'react'

import { cn } from '@/lib/utils'

const Input = ({ className, type, ref, ...props }: React.ComponentProps<'input'>) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-[10px] bg-[var(--surface-grouped)] px-[14px] py-[11px] text-sm text-[var(--text)] placeholder:text-[var(--text-secondary)] transition-[background-color,border-color,opacity] duration-[var(--dur-short)] ease-[var(--ease-out)]',
        'border border-transparent',
        'hover:bg-[var(--surface-grouped)]/80',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--system-blue)]/18 focus-visible:border-transparent',
        'disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-[var(--system-red)] aria-invalid:ring-[var(--system-red)]/20',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--text)]',
        className,
      )}
      ref={ref}
      {...props}
    />
  )
}
Input.displayName = 'Input'

export { Input }
