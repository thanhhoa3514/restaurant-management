import * as React from 'react'
import { Select as SelectPrimitive } from '@base-ui/react/select'
import { cn } from '@/lib/utils'
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from 'lucide-react'

/**
 * Walks the JSX subtree of a <Select> and builds base-ui's `items` record
 * ({ value: label }) from every <SelectItem>. base-ui's <Select.Value> renders
 * the raw stored value (e.g. a UUID) unless it can resolve a label from `items`
 * — and the popup (where the items live) is unmounted while closed, so the label
 * MUST come from this static tree walk, not from the mounted items.
 *
 * Note: the walk cannot see through intermediate custom components that don't
 * render their children synchronously. If a value ever renders raw again, pass
 * `items` explicitly on <Select>.
 */
function collectItemLabels(children: React.ReactNode): Record<string, React.ReactNode> {
  const map: Record<string, React.ReactNode> = {}
  const visit = (nodes: React.ReactNode) => {
    React.Children.toArray(nodes).forEach((node) => {
      if (!React.isValidElement(node)) return
      const props = node.props as { value?: unknown; children?: React.ReactNode }
      if (node.type === SelectItem && typeof props.value === 'string') {
        map[props.value] = props.children
      } else if (props.children != null) {
        visit(props.children)
      }
    })
  }
  visit(children)
  return map
}

function Select<Value, Multiple extends boolean | undefined = false>(
  props: SelectPrimitive.Root.Props<Value, Multiple>,
) {
  const { items, children } = props
  // Explicit `items` always wins; derive from <SelectItem>s otherwise.
  const derived = React.useMemo(() => collectItemLabels(children), [children])
  const mergedItems = items ?? (Object.keys(derived).length > 0 ? derived : undefined)
  return (
    <SelectPrimitive.Root {...props} items={mergedItems}>
      {children}
    </SelectPrimitive.Root>
  )
}

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn('scroll-my-1 p-1', className)}
      {...props}
    />
  )
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn(
        'flex flex-1 items-center gap-2 text-left truncate font-medium text-[var(--text)]',
        className,
      )}
      {...props}
    />
  )
}

function SelectTrigger({
  className,
  size = 'default',
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: 'sm' | 'default'
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        'flex h-10 w-full cursor-pointer select-none items-center justify-between gap-2 rounded-xl border border-[var(--separator)] bg-[var(--surface-grouped)] px-3 py-2 text-sm font-medium text-[var(--text)] shadow-xs outline-none transition-[background-color,border-color,opacity] duration-[var(--dur-short)] ease-[var(--ease-out)] hover:bg-[var(--surface-grouped)]/80 focus-visible:border-[var(--system-blue)]/50 focus-visible:ring-3 focus-visible:ring-[var(--system-blue)]/15 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-[var(--system-blue)] data-[state=open]:ring-3 data-[state=open]:ring-[var(--system-blue)]/15',
        size === 'sm' && 'h-8 rounded-lg px-2.5 text-xs',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          <ChevronDownIcon className="pointer-events-none size-4 text-[var(--text-tertiary)] shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        }
      />
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  side = 'bottom',
  sideOffset = 6,
  align = 'start',
  alignOffset = 0,
  alignItemWithTrigger = false,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    'align' | 'alignOffset' | 'side' | 'sideOffset' | 'alignItemWithTrigger'
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-[var(--z-tooltip)]"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            'relative z-[var(--z-tooltip)] max-h-60 min-w-[var(--anchor-width)] overflow-y-auto rounded-xl border border-[var(--separator)] bg-[var(--bg-elevated)] p-1 text-[var(--text)] shadow-xl backdrop-blur-xl duration-150 animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
            className,
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List className="flex flex-col gap-0.5">{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn(
        'px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)]',
        className,
      )}
      {...props}
    />
  )
}

function SelectItem({ className, children, ...props }: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        'relative flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-[var(--text)] outline-none select-none cursor-pointer transition-colors hover:bg-[var(--surface-grouped)] focus:bg-[var(--system-blue)]/10 focus:text-[var(--system-blue)] data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-[var(--system-blue)]/10 data-[highlighted]:text-[var(--system-blue)]',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex items-center gap-2 truncate">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator>
        <CheckIcon className="size-4 text-[var(--system-blue)] shrink-0 ml-2" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({ className, ...props }: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn('pointer-events-none -mx-1 my-1 h-px bg-[var(--separator)]', className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        'flex w-full cursor-default items-center justify-center py-1 text-[var(--text-tertiary)] bg-[var(--bg-elevated)]',
        className,
      )}
      {...props}
    >
      <ChevronUpIcon className="size-4" />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        'flex w-full cursor-default items-center justify-center py-1 text-[var(--text-tertiary)] bg-[var(--bg-elevated)]',
        className,
      )}
      {...props}
    >
      <ChevronDownIcon className="size-4" />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
