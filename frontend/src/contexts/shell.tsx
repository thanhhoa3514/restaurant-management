import {
  createContext,
  use,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { useSyncExternalStore } from 'react'

export interface ShellConfig {
  title?: string
  subtitle?: string
  eyebrow?: string
  contentClassName?: string
}

export const ShellContext = createContext<{
  config: ShellConfig
  setConfig: React.Dispatch<React.SetStateAction<ShellConfig>>
} | null>(null)

export function ShellProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ShellConfig>({})
  const value = useMemo(() => ({ config, setConfig }), [config])
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
}

export function useShellConfig(config: ShellConfig) {
  const ctx = use(ShellContext)

  const setConfig = ctx?.setConfig
  const { title, subtitle, eyebrow, contentClassName } = config
  useLayoutEffect(() => {
    if (!setConfig) return
    setConfig((prev) => {
      if (
        prev.title === title &&
        prev.subtitle === subtitle &&
        prev.eyebrow === eyebrow &&
        prev.contentClassName === contentClassName
      ) {
        return prev
      }
      return { title, subtitle, eyebrow, contentClassName }
    })
  }, [setConfig, title, subtitle, eyebrow, contentClassName])
}

const emptySubscribe = () => () => {}

export function ShellHeaderCenter({ children }: { children: ReactNode }) {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
  const target = isClient ? document.getElementById('shell-header-center') : null
  if (!target) return null
  return createPortal(children, target)
}

export function ShellHeaderActions({ children }: { children: ReactNode }) {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  )
  const target = isClient ? document.getElementById('shell-header-actions') : null
  if (!target) return null
  return createPortal(children, target)
}
