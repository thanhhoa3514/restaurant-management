import type { StaffRole } from '@/lib/auth'

export type Lang = 'vi' | 'en'

type DictValue = string | ((...args: never[]) => string)

export interface LocaleDict {
  common: {
    save: string
    cancel: string
    close: string
    delete: string
    edit: string
    confirm: string
    retry: string
    loading: string
    error: string
    success: string
    search: string
    back: string
    table: string
    status: string
    total: string
  }
  shell: {
    roleLabel: Record<StaffRole, string>
    navGroup: Record<'manage' | 'operate', string>
    navLabel: Record<string, string>
    navDesc: Record<string, string>
    staffOs: string
    search: string
    searchPlaceholder: string
    searchEmpty: string
    searchAria: string
    closeSearchAria: string
    openNavAria: string
    openProfileAria: string
    openSettingsAria: string
    navAria: string
    staffFallback: string
    logout: string
    settingsTitle: string
    displayMode: string
    navFilteredBy: (role: string) => string
  }
  admin: Record<string, DictValue>
  cashier: Record<string, DictValue>
  kitchen: Record<string, DictValue>
  waiter: Record<string, DictValue>
  ordering: Record<string, string>
}
