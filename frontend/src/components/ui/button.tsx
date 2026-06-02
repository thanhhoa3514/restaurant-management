import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-[220ms] ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[--system-blue] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 cursor-pointer active:translate-y-px',
  {
    variants: {
      variant: {
        default: 'bg-[var(--system-blue)] text-white hover:bg-[var(--system-blue)]/90',
        destructive: 'bg-[var(--system-red)] text-white hover:bg-[var(--system-red)]/90',
        outline:
          'border border-[var(--system-blue)] text-[var(--system-blue)] bg-transparent hover:bg-[var(--system-blue)]/10',
        secondary:
          'bg-[var(--surface-grouped)] text-[var(--text)] hover:bg-[var(--surface-grouped)]/80',
        ghost: 'text-[var(--system-blue)] bg-transparent hover:bg-[var(--system-blue)]/10',
        link: 'text-[var(--system-blue)] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-5 py-2',
        sm: 'h-9 rounded-[10px] px-4 text-sm',
        lg: 'h-12 rounded-[14px] px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
