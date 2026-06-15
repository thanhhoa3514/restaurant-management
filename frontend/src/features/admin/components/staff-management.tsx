import { useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Loader2, Pencil, Plus, UserCheck, UserX } from 'lucide-react'

import { SecureActionDialog } from '@/components/SecureActionDialog'
import { ShellHeaderActions, ShellHeaderCenter, useShellConfig } from '@/components/admin-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { makeAdminT, type AdminT } from '@/features/admin/data/i18n'
import {
  listRoles,
  listStaffUsers,
  manageStaffUser,
  staffQueryKeys,
  type ManageUserRequest,
  type RoleDTO,
  type StaffUserDTO,
} from '@/features/admin/api'
import { ApiError } from '@/lib/api'
import { getStaffSession } from '@/lib/auth'
import { useLang } from '@/lib/use-lang'
import { cn } from '@/lib/utils'

interface StaffForm {
  username: string
  full_name: string
  email: string
  phone: string
  role: string
  password: string
}

const blankForm = (role = ''): StaffForm => ({
  username: '',
  full_name: '',
  email: '',
  phone: '',
  role,
  password: '',
})

const formFromUser = (user: StaffUserDTO): StaffForm => ({
  username: user.username,
  full_name: user.full_name,
  email: user.email ?? '',
  phone: user.phone ?? '',
  role: user.role,
  password: '',
})

export function StaffManagement() {
  const { lang } = useLang()
  const t = makeAdminT(lang)
  const queryClient = useQueryClient()
  const currentUserId = getStaffSession()?.userId

  const [sheetState, setSheetState] = useState<
    { mode: 'create' } | { mode: 'edit'; user: StaffUserDTO } | null
  >(null)
  const [statusTarget, setStatusTarget] = useState<StaffUserDTO | null>(null)
  const [resetTarget, setResetTarget] = useState<StaffUserDTO | null>(null)

  const {
    data: users = [],
    isLoading,
    isError,
    error,
  } = useQuery({ queryKey: staffQueryKeys.users, queryFn: listStaffUsers })
  const { data: roles = [] } = useQuery({ queryKey: staffQueryKeys.roles, queryFn: listRoles })

  useShellConfig({
    title: t('staff_title'),
    subtitle: t('staff_subtitle'),
    contentClassName: 'bg-[var(--surface-grouped)]/45',
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: staffQueryKeys.users })

  const statusMutation = useMutation({
    mutationFn: manageStaffUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffQueryKeys.users })
      setStatusTarget(null)
    },
  })

  return (
    <>
      <ShellHeaderCenter>
        <div className="rounded-full bg-[var(--surface-grouped)]/70 px-4 py-2 text-sm font-semibold text-[var(--text-secondary)]">
          {t('staff_count', users.length)}
        </div>
      </ShellHeaderCenter>
      <ShellHeaderActions>
        <Button className="rounded-[var(--radius-lg)]" onClick={() => setSheetState({ mode: 'create' })}>
          <Plus className="size-4" />
          {t('staff_add')}
        </Button>
      </ShellHeaderActions>

      <div className="mx-auto max-w-7xl space-y-6">
        {isLoading && <p className="text-sm text-[var(--text-secondary)]">{t('staff_loading')}</p>}
        {isError && (
          <Card className="border border-[var(--system-red)]/30 bg-[var(--system-red)]/5">
            <CardContent className="p-5 text-sm text-[var(--system-red)]">
              {t('staff_load_error')}: {error instanceof ApiError ? error.message : ''}
            </CardContent>
          </Card>
        )}

        {users.length > 0 && (
          <Card className="overflow-hidden bg-[var(--material-regular)] backdrop-blur-2xl">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-[var(--separator)] hover:bg-transparent">
                    <TableHead className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] h-auto">{t('staff_col_name')}</TableHead>
                    <TableHead className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] h-auto">{t('staff_col_role')}</TableHead>
                    <TableHead className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] h-auto">{t('staff_col_status')}</TableHead>
                    <TableHead className="hidden px-5 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] h-auto md:table-cell">{t('staff_col_last_login')}</TableHead>
                    <TableHead className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] h-auto">{t('staff_col_actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <StaffRow
                      key={user.id}
                      user={user}
                      isSelf={user.id === currentUserId}
                      t={t}
                      lang={lang}
                      onEdit={() => setSheetState({ mode: 'edit', user })}
                      onToggleStatus={() => setStatusTarget(user)}
                      onResetPassword={() => setResetTarget(user)}
                      statusPending={statusMutation.isPending && statusTarget?.id === user.id}
                    />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <StaffSheet
        state={sheetState}
        roles={roles}
        t={t}
        onClose={() => setSheetState(null)}
        onSaved={invalidate}
      />

      {statusTarget && statusTarget.status === 'ACTIVE' && (
        <SecureActionDialog
          open
          title={t('staff_deactivate_title')}
          description={t('staff_deactivate_desc', statusTarget.full_name)}
          requireConfirmationText={statusTarget.username}
          inputPlaceholder={t('staff_confirm_placeholder', statusTarget.username)}
          confirmText={t('staff_deactivate_confirm')}
          cancelText={t('staff_cancel')}
          variant="danger"
          onOpenChange={(open) => !open && setStatusTarget(null)}
          onConfirm={() =>
            statusMutation.mutate({ action: 'set_status', user_id: statusTarget.id, status: 'INACTIVE' })
          }
        />
      )}

      <ResetPasswordSheet
        user={resetTarget}
        t={t}
        onClose={() => setResetTarget(null)}
        onSaved={invalidate}
      />
    </>
  )
}

function StaffRow({
  user,
  isSelf,
  t,
  lang,
  onEdit,
  onToggleStatus,
  onResetPassword,
  statusPending,
}: {
  user: StaffUserDTO
  isSelf: boolean
  t: AdminT
  lang: string
  onEdit: () => void
  onToggleStatus: () => void
  onResetPassword: () => void
  statusPending: boolean
}) {
  const queryClient = useQueryClient()
  const activateMutation = useMutation({
    mutationFn: manageStaffUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: staffQueryKeys.users }),
  })

  const statusKey =
    user.status === 'ACTIVE'
      ? 'staff_status_active'
      : user.status === 'LOCKED'
        ? 'staff_status_locked'
        : 'staff_status_inactive'

  return (
    <TableRow className="border-b border-[var(--separator)] last:border-0 hover:bg-[var(--surface-grouped)]/50">
      <TableCell className="px-5 py-3">
        <div className="font-semibold text-[var(--text)]">
          {user.full_name}
          {isSelf && (
            <span className="ml-2 rounded-full bg-[var(--system-blue)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--system-blue)]">
              {t('staff_self_hint')}
            </span>
          )}
        </div>
        <div className="font-mono text-xs text-[var(--text-tertiary)]">{user.username}</div>
      </TableCell>
      <TableCell className="px-5 py-3 capitalize text-[var(--text-secondary)]">{user.role}</TableCell>
      <TableCell className="px-5 py-3">
        <Badge
          className={cn(
            'border-0',
            user.status === 'ACTIVE'
              ? 'bg-[var(--system-green)]/10 text-[var(--system-green)]'
              : user.status === 'LOCKED'
                ? 'bg-[var(--system-red)]/10 text-[var(--system-red)]'
                : 'bg-[var(--surface-grouped)] text-[var(--text-secondary)]',
          )}
        >
          {t(statusKey)}
        </Badge>
      </TableCell>
      <TableCell className="hidden px-5 py-3 text-[var(--text-secondary)] md:table-cell">
        {user.last_login_at
          ? new Date(user.last_login_at).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')
          : t('staff_never_logged')}
      </TableCell>
      <TableCell className="px-5 py-3">
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" className="rounded-[10px]" onClick={onEdit} title={t('staff_edit')}>
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-[10px]"
            onClick={onResetPassword}
            title={t('staff_reset_pw')}
          >
            <KeyRound className="size-4" />
          </Button>
          {!isSelf &&
            (user.status === 'ACTIVE' ? (
              <Button
                variant="ghost"
                size="sm"
                className="rounded-[10px] text-[var(--system-red)]"
                onClick={onToggleStatus}
                disabled={statusPending}
                title={t('staff_deactivate')}
              >
                <UserX className="size-4" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="rounded-[10px] text-[var(--system-green)]"
                disabled={activateMutation.isPending}
                onClick={() =>
                  activateMutation.mutate({ action: 'set_status', user_id: user.id, status: 'ACTIVE' })
                }
                title={t('staff_activate')}
              >
                <UserCheck className="size-4" />
              </Button>
            ))}
        </div>
      </TableCell>
    </TableRow>
  )
}

function StaffSheet({
  state,
  roles,
  t,
  onClose,
  onSaved,
}: {
  state: { mode: 'create' } | { mode: 'edit'; user: StaffUserDTO } | null
  roles: RoleDTO[]
  t: AdminT
  onClose: () => void
  onSaved: () => void
}) {
  const open = state !== null
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="w-full bg-[var(--material-thick)] sm:max-w-md">
        {state && (
          <StaffSheetBody key={state.mode === 'edit' ? state.user.id : 'create'} state={state} roles={roles} t={t} onClose={onClose} onSaved={onSaved} />
        )}
      </SheetContent>
    </Sheet>
  )
}

function StaffSheetBody({
  state,
  roles,
  t,
  onClose,
  onSaved,
}: {
  state: { mode: 'create' } | { mode: 'edit'; user: StaffUserDTO }
  roles: RoleDTO[]
  t: AdminT
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = state.mode === 'edit'
  const [form, setForm] = useState<StaffForm>(() =>
    isEdit ? formFromUser(state.user) : blankForm(roles[0]?.name ?? ''),
  )
  const isSelf = isEdit && state.user.id === getStaffSession()?.userId

  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: manageStaffUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffQueryKeys.users })
      onSaved()
      onClose()
    },
  })

  const updateField = <K extends keyof StaffForm>(key: K, value: StaffForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const body: ManageUserRequest = isEdit
      ? {
          action: 'update',
          user_id: state.user.id,
          full_name: form.full_name,
          email: form.email || undefined,
          phone: form.phone || undefined,
          // Role changes on yourself are rejected server-side; skip sending.
          ...(isSelf ? {} : { role: form.role }),
        }
      : {
          action: 'create',
          username: form.username,
          full_name: form.full_name,
          email: form.email || undefined,
          phone: form.phone || undefined,
          role: form.role,
          password: form.password,
        }
    mutation.mutate(body)
  }

  return (
    <>
      <SheetHeader
        title={isEdit ? t('staff_edit_title') : t('staff_create_title')}
        subtitle={isEdit ? state.user.username : undefined}
      />
      <form className="flex flex-1 flex-col overflow-hidden" onSubmit={handleSubmit}>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-5">
          {!isEdit && (
            <Field label={t('staff_field_username')} hint={t('staff_username_hint')}>
              <Input
                value={form.username}
                onChange={(e) => updateField('username', e.target.value)}
                autoComplete="off"
                required
              />
            </Field>
          )}
          <Field label={t('staff_field_full_name')}>
            <Input
              value={form.full_name}
              onChange={(e) => updateField('full_name', e.target.value)}
              required
            />
          </Field>
          <Field label={t('staff_field_email')}>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
            />
          </Field>
          <Field label={t('staff_field_phone')}>
            <Input value={form.phone} onChange={(e) => updateField('phone', e.target.value)} />
          </Field>
          <Field label={t('staff_field_role')}>
            <Select
              value={form.role}
              onValueChange={(val) => updateField('role', val)}
              disabled={isSelf}
              required
            >
              <SelectTrigger className="h-10 w-full rounded-[10px] bg-[var(--surface-grouped)] px-[14px] text-sm capitalize text-[var(--text)] border-transparent focus:ring-[3px] focus:ring-[var(--system-blue)]/18">
                <SelectValue placeholder="Chọn vai trò" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.name} value={role.name} className="capitalize">
                    {role.display_name || role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {!isEdit && (
            <Field label={t('staff_field_password')} hint={t('staff_password_hint')}>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => updateField('password', e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>
          )}

          {mutation.isError && (
            <p className="text-sm text-[var(--system-red)]">
              {mutation.error instanceof ApiError ? mutation.error.message : t('staff_action_failed')}
            </p>
          )}
        </div>
        <div className="border-t border-[var(--separator)] p-5">
          <Button type="submit" className="w-full rounded-[var(--radius-lg)]" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            {isEdit
              ? mutation.isPending
                ? t('staff_saving')
                : t('staff_save')
              : mutation.isPending
                ? t('staff_creating')
                : t('staff_create_submit')}
          </Button>
        </div>
      </form>
    </>
  )
}

function ResetPasswordSheet({
  user,
  t,
  onClose,
  onSaved,
}: {
  user: StaffUserDTO | null
  t: AdminT
  onClose: () => void
  onSaved: () => void
}) {
  const [password, setPassword] = useState('')

  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: manageStaffUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffQueryKeys.users })
      onSaved()
      setPassword('')
      onClose()
    },
  })

  return (
    <Sheet open={user !== null} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="w-full bg-[var(--material-thick)] sm:max-w-md">
        {user && (
          <>
            <SheetHeader title={t('staff_reset_pw_title')} subtitle={user.username} />
            <form
              className="flex flex-1 flex-col overflow-hidden"
              onSubmit={(event) => {
                event.preventDefault()
                mutation.mutate({ action: 'reset_password', user_id: user.id, password })
              }}
            >
              <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-5">
                <p className="text-sm text-[var(--text-secondary)]">
                  {t('staff_reset_pw_desc', user.full_name)}
                </p>
                <Field label={t('staff_field_password')} hint={t('staff_password_hint')}>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </Field>
                {mutation.isError && (
                  <p className="text-sm text-[var(--system-red)]">
                    {mutation.error instanceof ApiError
                      ? mutation.error.message
                      : t('staff_action_failed')}
                  </p>
                )}
              </div>
              <div className="border-t border-[var(--separator)] p-5">
                <Button type="submit" className="w-full rounded-[var(--radius-lg)]" disabled={mutation.isPending}>
                  {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
                  {t('staff_reset_pw')}
                </Button>
              </div>
            </form>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
        {label}
      </Label>
      {children}
      {hint && <p className="text-xs text-[var(--text-tertiary)]">{hint}</p>}
    </div>
  )
}
