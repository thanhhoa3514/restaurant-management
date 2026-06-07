import type { Dispatch, SetStateAction } from 'react'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'
import type { shellStrings } from '@/components/shell-i18n'
import type { LucideIcon } from 'lucide-react'

export interface CommandEntry {
  key: string
  label: string
  description: string
  icon: LucideIcon
  action: () => void
}

interface StaffCommandDialogProps {
  open: boolean
  onOpenChange: Dispatch<SetStateAction<boolean>>
  query: string
  setQuery: Dispatch<SetStateAction<string>>
  s: ReturnType<typeof shellStrings>
  commandItems: CommandEntry[]
}

export function AdminCommandDialog({
  open,
  onOpenChange,
  query,
  setQuery,
  s,
  commandItems,
}: StaffCommandDialogProps) {
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={s.searchPlaceholder} value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>{s.searchEmpty}</CommandEmpty>
        <CommandGroup>
          {commandItems.map((item) => {
            const Icon = item.icon
            return (
              <CommandItem
                key={item.key}
                value={`${item.label} ${item.description}`}
                onSelect={item.action}
                className="flex min-h-14 cursor-pointer items-center gap-3 rounded-[16px] px-3"
              >
                <span className="flex size-10 items-center justify-center rounded-[14px] bg-[var(--staff-tint)]/10 text-[var(--staff-tint)]">
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold text-[var(--text)]">{item.label}</span>
                  <span className="block truncate text-[12px] text-[var(--text-secondary)]">
                    {item.description}
                  </span>
                </span>
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
