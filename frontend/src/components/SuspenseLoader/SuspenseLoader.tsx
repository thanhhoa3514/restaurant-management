import React, { Suspense } from 'react'

import { Loader2 } from 'lucide-react'

interface SuspenseLoaderProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

const DefaultFallback = () => (
  <div className="flex min-h-[200px] items-center justify-center">
    <Loader2 className="animate-spin size-5 text-[var(--system-purple)]" />
  </div>
)

export const SuspenseLoader: React.FC<SuspenseLoaderProps> = ({
  children,
  fallback = <DefaultFallback />,
}) => <Suspense fallback={fallback}>{children}</Suspense>
