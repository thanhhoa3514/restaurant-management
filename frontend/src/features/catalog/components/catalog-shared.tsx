import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { AdminT } from '@/features/admin/data/i18n'
import type { AdminMenuItemDetailDTO } from '@/features/catalog/types'
import { errorMessage } from '@/lib/api'

export function ToggleBox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className={cn(
        'h-auto min-h-12 rounded-[14px] px-3 py-3 text-sm font-semibold whitespace-normal h-full',
        checked
          ? 'border-[var(--system-blue)]/30 bg-[var(--system-blue)]/10 text-[var(--system-blue)] hover:bg-[var(--system-blue)]/20 hover:text-[var(--system-blue)]'
          : 'border-[var(--separator)] bg-[var(--surface-grouped)] text-[var(--text-secondary)] hover:bg-[var(--surface-grouped)]/80 hover:text-[var(--text)]',
      )}
      onClick={() => onChange(!checked)}
    >
      {label}
    </Button>
  )
}

export function ReadonlyNested({ detail, t }: { detail: AdminMenuItemDetailDTO; t: AdminT }) {
  const variantCount = detail.variants?.length ?? 0
  const optionCount =
    detail.option_groups?.reduce((sum, group) => sum + (group.options?.length ?? 0), 0) ?? 0
  if (variantCount === 0 && optionCount === 0) return null
  return (
    <Card className="border border-[var(--separator)] bg-[var(--surface-grouped)]/70 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[var(--text)]">
        <AlertTriangle className="size-4 text-[var(--system-orange)]" />
        {t('catalog_readonly_variants_title')}
      </div>
      <p className="text-sm text-[var(--text-secondary)]">
        {t('catalog_readonly_variants_desc', variantCount, optionCount)}
      </p>
    </Card>
  )
}

export function ErrorCard({ error, fallback }: { error: unknown; fallback: string }) {
  return (
    <Card className="border border-[var(--system-red)]/30 bg-[var(--system-red)]/5">
      <CardContent className="p-5 text-sm text-[var(--system-red)]">
        {errorMessage(error, fallback)}
      </CardContent>
    </Card>
  )
}

export function FormError({ error, t }: { error: unknown; t: AdminT }) {
  if (!error) return null
  return (
    <div className="rounded-[16px] border border-[var(--system-red)]/30 bg-[var(--system-red)]/5 p-3 text-sm text-[var(--system-red)]">
      {errorMessage(error, t('catalog_action_failed'))}
    </div>
  )
}
