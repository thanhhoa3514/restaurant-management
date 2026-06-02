import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--system-blue)] focus:ring-offset-2 cursor-default',
  {
    variants: {
      variant: {
        default: 'bg-[var(--system-blue)]/10 text-[var(--system-blue)]',
        secondary: 'bg-[var(--surface-grouped)] text-[var(--text-secondary)]',
        destructive: 'bg-[var(--system-red)]/10 text-[var(--system-red)]',
        outline: 'text-[var(--text)] border border-[var(--separator)]',
        success: 'bg-[var(--system-green)]/10 text-[var(--system-green)]',
        warning: 'bg-[var(--system-orange)]/10 text-[var(--system-orange)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
