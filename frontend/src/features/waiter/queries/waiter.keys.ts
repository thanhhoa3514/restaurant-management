export const waiterKeys = {
  all: ['staff'] as const,
  tables: () => [...waiterKeys.all, 'tables'] as const,
}
