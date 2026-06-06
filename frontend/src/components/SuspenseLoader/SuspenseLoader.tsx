import React, { Suspense } from 'react'

import { Spinner } from '@/components/ui/spinner'

interface SuspenseLoaderProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

const DefaultFallback = () => (
  <div className="flex min-h-[200px] items-center justify-center">
    <Spinner className="size-5 text-[var(--system-purple)]" />
  </div>
)

export const SuspenseLoader: React.FC<SuspenseLoaderProps> = ({
  children,
  fallback = <DefaultFallback />,
}) => <Suspense fallback={fallback}>{children}</Suspense>

export default SuspenseLoader
