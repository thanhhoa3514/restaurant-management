import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { SuspenseLoader } from '~components/SuspenseLoader/SuspenseLoader'
import { Toaster } from '@/components/ui/sonner'
import { NotFoundPage } from '@/features/not-found/components/not-found-page'

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
  notFoundComponent: NotFoundPage,
})
