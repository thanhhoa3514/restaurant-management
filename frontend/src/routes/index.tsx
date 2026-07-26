import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({
      to: '/order',
      search: { t: undefined, s: undefined, table: undefined, tableId: undefined },
    })
  },
})
