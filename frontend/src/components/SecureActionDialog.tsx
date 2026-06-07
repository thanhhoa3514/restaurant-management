import { useState, type FC } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'

export interface SecureActionDialogProps {
  open: boolean
  title: string
  description: string
  confirmText: string
  cancelText: string
  
  // Security verification rules
  requireConfirmationText?: string // If provided, user must type this exact text to enable confirm button
  inputPlaceholder?: string
  caseSensitive?: boolean
  
  // Visual style
  variant?: 'default' | 'destructive' | 'warning'
  
  // Event handlers
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export const SecureActionDialog: FC<SecureActionDialogProps> = ({
  open,
  title,
  description,
  confirmText,
  cancelText,
  requireConfirmationText,
  inputPlaceholder,
  caseSensitive = false,
  variant = 'default',
  onOpenChange,
  onConfirm,
}) => {
  const [userInput, setUserInput] = useState('')

  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setUserInput('')
    }
  }

  const isVerified = (() => {
    if (!requireConfirmationText) return true
    
    const input = userInput.trim()
    const target = requireConfirmationText.trim()
    
    return caseSensitive ? input === target : input.toLowerCase() === target.toLowerCase()
  })()

  const buttonVariant = (() => {
    if (variant === 'destructive') return 'destructive'
    return 'default'
  })()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-[var(--material-thick)]" hideClose>
        <SheetHeader title={title} />
        <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-5">
          {/* Main Description */}
          <Card className="border border-[var(--separator)] bg-[var(--material-regular)] p-4 shadow-sm backdrop-blur-2xl">
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              {description}
            </p>
          </Card>

          {/* Secure Input Verification */}
          {requireConfirmationText && (
            <Card className="border border-[var(--separator)] bg-[var(--material-regular)] p-4 shadow-sm backdrop-blur-2xl">
              <label className="text-sm font-semibold text-[var(--text)] block mb-2" htmlFor="secure-action-input">
                {inputPlaceholder || `Nhập "${requireConfirmationText}" để xác nhận`}
              </label>
              <Input
                id="secure-action-input"
                className="h-12 rounded-[var(--radius-lg)] text-lg font-bold text-center"
                value={userInput}
                placeholder={requireConfirmationText}
                onChange={(event) => setUserInput(event.target.value)}
                autoComplete="off"
              />
            </Card>
          )}

          <Separator />

          {/* Dialog Action Buttons */}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1 rounded-[var(--radius-lg)]" onClick={() => onOpenChange(false)}>
              {cancelText}
            </Button>
            <Button
              variant={buttonVariant}
              className={`flex-1 rounded-[var(--radius-lg)] ${variant === 'warning' ? 'bg-[var(--system-orange)] text-white hover:bg-[var(--system-orange)]/90' : ''}`}
              disabled={!isVerified}
              onClick={() => {
                onConfirm()
                onOpenChange(false)
              }}
            >
              {confirmText}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default SecureActionDialog
