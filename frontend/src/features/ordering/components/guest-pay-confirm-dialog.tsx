import { useState, type FC } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'

interface GuestPayConfirmDialogProps {
  open: boolean
  tableName: string
  t: Record<string, string | ((...args: never[]) => string)>
  onOpenChange: (open: boolean) => void
  onConfirm: (wantsDigitalInvoice: boolean) => void
}

export const GuestPayConfirmDialog: FC<GuestPayConfirmDialogProps> = ({
  open,
  tableName,
  t,
  onOpenChange,
  onConfirm,
}) => {
  const [wantsDigitalInvoice, setWantsDigitalInvoice] = useState(true)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-[24px] bg-[var(--material-thick)]/90 backdrop-blur-2xl px-5 pb-6 border-t border-[var(--separator)] animate-in slide-in-from-bottom duration-300" hideClose>
        <SheetHeader 
          title={t.request_bill as string || "Yêu cầu thanh toán?"} 
          subtitle={`${t.table as string} ${tableName}`}
          className="text-center"
        />
        <div className="space-y-5">
          {/* Locked Table Warning */}
          <Card className="border border-[var(--separator)] bg-[var(--material-regular)] p-4 shadow-sm backdrop-blur-2xl">
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed text-center">
              {t.lock_table_desc as string || "Bàn của bạn sẽ được khóa để chuẩn bị hóa đơn. Bạn sẽ không thể gọi thêm món ăn sau khi xác nhận."}
            </p>
          </Card>

          {/* Digital Invoice Opt-In */}
          <Card 
            className={`border transition-all duration-300 p-4 shadow-sm cursor-pointer rounded-[var(--radius-xl)] flex items-center justify-between ${
              wantsDigitalInvoice 
                ? 'border-[var(--system-blue)] bg-[var(--system-blue)]/10' 
                : 'border-[var(--separator)] bg-[var(--material-regular)]'
            }`}
            onClick={() => setWantsDigitalInvoice(!wantsDigitalInvoice)}
          >
            <div className="flex-1 pr-4">
              <span className="block font-bold text-sm text-[var(--text)]">
                {t.opt_in_digital_invoice_title as string || "Nhận Hóa đơn điện tử trên điện thoại"}
              </span>
              <span className="block text-[11px] text-[var(--text-tertiary)] mt-0.5">
                {t.opt_in_digital_invoice_desc as string || "Tự động hiển thị hóa đơn A5 PDF sắc nét ngay trên màn hình khi thanh toán hoàn tất."}
              </span>
            </div>
            <div className="shrink-0 ml-3" onClick={(e) => e.stopPropagation()}>
              <Switch checked={wantsDigitalInvoice} onCheckedChange={setWantsDigitalInvoice} />
            </div>
          </Card>

          <Separator />

          {/* Dialog Action Buttons */}
          <div className="flex gap-2.5">
            <Button 
              variant="secondary" 
              className="flex-1 h-12 rounded-[var(--radius-lg)] font-semibold text-sm cursor-pointer"
              onClick={() => onOpenChange(false)}
            >
              {t.back as string || "Quay lại"}
            </Button>
            <Button
              className="flex-1 h-12 rounded-[var(--radius-lg)] font-bold text-sm bg-[var(--system-blue)] text-white cursor-pointer"
              onClick={() => {
                onConfirm(wantsDigitalInvoice)
                onOpenChange(false)
              }}
            >
              {t.confirm as string || "Xác nhận yêu cầu"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default GuestPayConfirmDialog
