import * as React from 'react'
import { cn } from '@/lib/utils'

interface SwitchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        ref={ref}
        className={cn(
          'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--system-blue)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 shadow-inner',
          checked 
            ? 'bg-[var(--system-blue)] shadow-[0_0_12px_rgba(0,122,255,0.25)]' 
            : 'bg-zinc-200 dark:bg-zinc-800',
          className
        )}
        onClick={() => onCheckedChange(!checked)}
        {...props}
      >
        <span
          className={cn(
            'pointer-events-none block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] border border-zinc-200/10',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    )
  }
)

Switch.displayName = 'Switch'

export default Switch
