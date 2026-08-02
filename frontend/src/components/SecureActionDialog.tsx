import { useState, type FC } from 'react'
import { AlertTriangle, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

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
  onConfirm: () => void | boolean | Promise<void | boolean>
}

const VARIANT_STYLE = {
  default: {
    Icon: ShieldCheck,
    iconClass: 'bg-[var(--system-blue)]/10 text-[var(--system-blue)]',
  },
  destructive: {
    Icon: ShieldAlert,
    iconClass: 'bg-[var(--system-red)]/10 text-[var(--system-red)]',
  },
  warning: {
    Icon: AlertTriangle,
    iconClass: 'bg-[var(--system-orange)]/10 text-[var(--system-orange)]',
  },
} as const

export const SecureActionDialog: FC<SecureActionDialogProps> = ({
  open,
  onOpenChange,
  ...rest
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        {/* Mount the body only while open so the verification input resets each open. */}
        {open && <SecureActionBody onOpenChange={onOpenChange} {...rest} />}
      </DialogContent>
    </Dialog>
  )
}

function SecureActionBody({
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
}: Omit<SecureActionDialogProps, 'open'>) {
  const [userInput, setUserInput] = useState('')
  const [pending, setPending] = useState(false)

  const isVerified = (() => {
    if (!requireConfirmationText) return true
    const input = userInput.trim()
    const target = requireConfirmationText.trim()
    return caseSensitive ? input === target : input.toLowerCase() === target.toLowerCase()
  })()

  const buttonVariant = variant === 'destructive' ? 'destructive' : 'default'
  const { Icon, iconClass } = VARIANT_STYLE[variant]

  const confirm = async () => {
    if (!isVerified || pending) return
    setPending(true)
    try {
      const confirmed = await onConfirm()
      if (confirmed !== false) onOpenChange(false)
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <DialogHeader className="items-center text-center">
        <span
          className={cn(
            'mx-auto mb-1 flex size-12 items-center justify-center rounded-full',
            iconClass,
          )}
        >
          <Icon className="size-6" />
        </span>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="text-[var(--text-secondary)]">
          {description}
        </DialogDescription>
      </DialogHeader>

      {requireConfirmationText && (
        <div className="space-y-2">
          <Label htmlFor="secure-action-input" className="text-[var(--text-secondary)]">
            {inputPlaceholder || `Nhập "${requireConfirmationText}" để xác nhận`}
          </Label>
          <Input
            id="secure-action-input"
            className="h-12 rounded-[var(--radius-lg)] text-center text-lg font-bold"
            value={userInput}
            placeholder={requireConfirmationText}
            onChange={(event) => setUserInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void confirm()
            }}
            autoComplete="off"
            autoFocus
          />
        </div>
      )}

      <DialogFooter>
        <Button
          variant="secondary"
          className="flex-1 rounded-[var(--radius-lg)]"
          disabled={pending}
          onClick={() => onOpenChange(false)}
        >
          {cancelText}
        </Button>
        <Button
          variant={buttonVariant}
          className={cn(
            'flex-1 rounded-[var(--radius-lg)]',
            variant === 'warning' &&
              'bg-[var(--system-orange)] text-white hover:bg-[var(--system-orange)]/90',
          )}
          disabled={!isVerified || pending}
          onClick={() => void confirm()}
        >
          {pending ? <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> : null}
          {confirmText}
        </Button>
      </DialogFooter>
    </>
  )
}
