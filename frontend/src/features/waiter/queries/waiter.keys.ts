export const waiterKeys = {
  all: ['waiter'] as const,
  tables: () => [...waiterKeys.all, 'tables'] as const,
}
