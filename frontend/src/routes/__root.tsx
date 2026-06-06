import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { SuspenseLoader } from '~components/SuspenseLoader/SuspenseLoader'
import { Toaster } from '@/components/ui/sonner'

export const Route = createRootRoute({
  component: () => (
    <>
      <SuspenseLoader>
        <Outlet />
      </SuspenseLoader>
      <Toaster />
      <TanStackRouterDevtools />
    </>
  ),
})
