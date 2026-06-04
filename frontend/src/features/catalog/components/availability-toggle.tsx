import { useState, type FC } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2, AlertTriangle } from 'lucide-react'

import { SecureActionDialog } from '@/components/SecureActionDialog'
import { Switch } from '@/components/ui/switch'
import { ApiError } from '@/lib/api'
import { toggleMenuItemAvailability } from '@/features/catalog/api'
import type { MenuItemSummary } from '@/features/catalog/types'

interface AvailabilityToggleProps {
  item: Pick<MenuItemSummary, 'id' | 'name' | 'is_available'>
  // Called after a successful toggle; parent re-fetches the menu list so the UI
  // reflects server truth (this component never mirrors availability locally).
  onToggled?: (itemId: string, available: boolean) => void
  // High-friction guard: require typing the dish name to confirm. Off by default
  // because availability is reversible; turn on for extra-sensitive catalogs.
  requireNameConfirmation?: boolean
  disabled?: boolean
}

export const AvailabilityToggle: FC<AvailabilityToggleProps> = ({
  item,
  onToggled,
  requireNameConfirmation = false,
  disabled = false,
}) => {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // The state we will move TO if the admin confirms. Opening the dialog does NOT
  // flip the switch — the switch keeps showing server truth (item.is_available)
  // until the mutation succeeds and the parent re-fetches.
  const target = !item.is_available

  const mutation = useMutation({
    mutationFn: () => toggleMenuItemAvailability({ itemId: item.id, available: target }),
    onSuccess: () => {
      setErrorMessage(null)
      onToggled?.(item.id, target)
    },
    onError: (err) => {
      setErrorMessage(
        err instanceof ApiError ? err.message : 'Cập nhật thất bại. Vui lòng thử lại.',
      )
    },
  })

  const requestToggle = () => {
    if (disabled || mutation.isPending) return
    setErrorMessage(null)
    setDialogOpen(true)
  }

  const title = target ? 'Mở bán món ăn' : 'Ngừng bán món ăn'
  const description = target
    ? `Xác nhận MỞ BÁN "${item.name}". Món sẽ hiển thị và khách có thể đặt ngay lập tức trên toàn hệ thống.`
    : `Xác nhận NGỪNG BÁN "${item.name}". Món sẽ bị ẩn khỏi thực đơn và không thể đặt trên toàn hệ thống. Các giỏ hàng đang chọn món này có thể bị ảnh hưởng.`

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {mutation.isPending && (
          <Loader2 size={14} className="animate-spin text-[var(--text-secondary)]" />
        )}
        <Switch
          checked={item.is_available}
          onCheckedChange={requestToggle}
          disabled={disabled || mutation.isPending}
          aria-label={`${item.is_available ? 'Ngừng bán' : 'Mở bán'} ${item.name}`}
        />
      </div>

      {errorMessage && (
        <span className="flex items-center gap-1 text-xs font-medium text-[var(--system-red)]">
          <AlertTriangle size={12} />
          {errorMessage}
        </span>
      )}

      <SecureActionDialog
        open={dialogOpen}
        title={title}
        description={description}
        confirmText={target ? 'Mở bán' : 'Ngừng bán'}
        cancelText="Hủy"
        variant={target ? 'default' : 'warning'}
        requireConfirmationText={requireNameConfirmation ? item.name : undefined}
        inputPlaceholder={
          requireNameConfirmation ? `Nhập "${item.name}" để xác nhận` : undefined
        }
        onOpenChange={setDialogOpen}
        onConfirm={() => mutation.mutate()}
      />
    </div>
  )
}

export default AvailabilityToggle