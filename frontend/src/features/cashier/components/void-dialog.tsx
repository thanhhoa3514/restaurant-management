import type { FC } from 'react'
import { SecureActionDialog } from '@/components/SecureActionDialog'
import type { CashierSession } from '@/features/cashier/types'

interface VoidDialogProps {
  open: boolean
  session: CashierSession | null
  t: (key: string, ...args: Array<number | string>) => string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export const VoidDialog: FC<VoidDialogProps> = ({
  open,
  session,
  t,
  onOpenChange,
  onConfirm,
}) => {
  if (!session) return null

  return (
    <SecureActionDialog
      open={open}
      title={t('void_dialog_title')}
      description={t('void_dialog_desc')}
      confirmText={t('void_confirm')}
      cancelText={t('cancel')}
      requireConfirmationText={session.table_number}
      inputPlaceholder={t('void_input_label')}
      variant="destructive"
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
    />
  )
}

export default VoidDialog
