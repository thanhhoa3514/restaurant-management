import * as React from 'react'

import { cn } from '@/lib/utils'

interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical'
  decorative?: boolean
}

const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className, orientation = 'horizontal', decorative, ...props }, ref) => {
    const orientationClass = orientation === 'vertical' ? 'w-px h-full' : 'h-px w-full'
    return (
      <div
        ref={ref}
        role={decorative ? 'none' : 'separator'}
        aria-orientation={decorative ? undefined : orientation}
        className={cn('shrink-0 bg-[var(--separator)]', orientationClass, className)}
        {...props}
      />
    )
  },
)
Separator.displayName = 'Separator'

export { Separator }
