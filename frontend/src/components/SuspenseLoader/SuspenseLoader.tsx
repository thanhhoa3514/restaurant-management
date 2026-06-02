import React, { Suspense } from 'react'

interface SuspenseLoaderProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

const DefaultFallback = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 200,
      color: '#9ca3af',
      fontSize: 14,
    }}
  >
    <span
      style={{
        width: 20,
        height: 20,
        border: '2px solid #e5e4e7',
        borderTopColor: '#aa3bff',
        borderRadius: '50%',
        animation: 'spin 0.6s linear infinite',
      }}
    />
  </div>
)

export const SuspenseLoader: React.FC<SuspenseLoaderProps> = ({
  children,
  fallback = <DefaultFallback />,
}) => <Suspense fallback={fallback}>{children}</Suspense>

export default SuspenseLoader
