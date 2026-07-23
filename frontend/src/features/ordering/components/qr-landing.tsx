import { useCallback, useEffect, useMemo, useRef, useState, type FC, type ReactNode } from 'react'
import { Loader2, QrCode, ScanLine, AlertCircle, Users } from 'lucide-react'
import { toast } from 'sonner'
import QRCodeLib from 'qrcode'
import { ApiError, errorMessage } from '@/lib/api'
import { useOrdering } from '../hooks/use-ordering'
import { DICT, type OrderingDict as Dict } from '@/i18n'
import { useJoinSession } from '@/features/ordering/mutations/useJoinSession'
import { useGuestTables } from '@/features/ordering/queries/useGuestTables'
import { buildQROrderURL } from '@/features/dining/api'
import type { GuestTable } from '@/features/dining/types'
import { cn } from '@/lib/utils'
import { setGuestRealtimeToken } from '@/lib/realtime-auth'

interface QRLandingProps {
  qrToken?: string
}

type JoinState = 'idle' | 'joining' | 'ready' | 'not_opened' | 'error' | 'pending_verification'

export const QRLanding: FC<QRLandingProps> = ({ qrToken }) => {
  const { state, dispatch } = useOrdering()
  const t = DICT[state.lang]
  const attemptedToken = useRef<string | null>(null)

  const [joinState, setJoinState] = useState<JoinState>('idle')
  const [message, setMessage] = useState('')
  const [guestName, setGuestName] = useState('')
  const [nameError, setNameError] = useState('')
  const [pendingJoinToken, setPendingJoinToken] = useState<string | null>(null)
  const joinMutation = useJoinSession()

  const {
    data: tablesData,
    isLoading: tablesLoading,
    isError: tablesError,
    error: tablesRawError,
  } = useGuestTables(!qrToken)

  useEffect(() => {
    if (joinState !== 'pending_verification') return

    const onVerified = () => {
      setJoinState('ready')
      setMessage(t.qr_ready)
      toast.success(state.lang === 'vi' ? 'Chào mừng bạn đến với Zenith!' : 'Welcome to Zenith!')
      setTimeout(() => {
        dispatch({ type: 'SET_SCREEN', payload: 'menu' })
      }, 600)
    }

    window.addEventListener('dining.session_verified', onVerified)
    return () => {
      window.removeEventListener('dining.session_verified', onVerified)
    }
  }, [joinState, dispatch, t])

  const handleJoin = useCallback(
    (token: string, name?: string) => {
      setJoinState('joining')
      setMessage(t.qr_joining)

      joinMutation.mutate(
        { qrToken: token, guestName: name },
        {
          onSuccess: (joined) => {
            if (joined.status === 'not_opened') {
              setJoinState('not_opened')
              setMessage(t.qr_not_opened_desc)
              return
            }

            if (joined.status === 'PENDING_VERIFICATION') {
              setGuestRealtimeToken(joined.session_token || '')
              setJoinState('pending_verification')
              setMessage(t.qr_pending_verification)
              dispatch({
                type: 'SET_SESSION',
                payload: {
                  token: joined.session_token || '',
                  table: joined.table_name || joined.table_code || '',
                  startedAt: new Date(),
                  sessionId: joined.session_id,
                  tableId: joined.table_id,
                  status: joined.status,
                },
              })
              return
            }

            if (!joined.session_token || !joined.session_id || !joined.table_id) {
              setJoinState('error')
              setMessage(t.qr_invalid)
              return
            }

            setGuestRealtimeToken(joined.session_token)
            dispatch({
              type: 'SET_SESSION',
              payload: {
                token: joined.session_token,
                table: joined.table_name || joined.table_code || '',
                startedAt: new Date(),
                sessionId: joined.session_id,
                tableId: joined.table_id,
                status: joined.status,
              },
            })
            setJoinState('ready')
            setMessage(t.qr_ready)

            setTimeout(() => {
              dispatch({ type: 'SET_SCREEN', payload: 'menu' })
            }, 600)
          },
          onError: (err) => {
            setJoinState('error')
            setMessage(err instanceof ApiError && err.status === 0 ? t.qr_network : t.qr_invalid)
          },
        },
      )
    },
    [dispatch, t, joinMutation],
  )

  const handleJoinWithName = useCallback(() => {
    const trimmed = guestName.trim()
    if (!trimmed) {
      setNameError(t.qr_name_required)
      return
    }
    setNameError('')
    attemptedToken.current = qrToken!
    void handleJoin(qrToken!, trimmed)
  }, [guestName, qrToken, handleJoin, t])

  const handleNameChange = useCallback((value: string) => {
    setGuestName(value)
    setNameError('')
  }, [])

  const areaGroups = useMemo(() => {
    if (!tablesData?.length) return []
    const groups = new Map<string, GuestTable[]>()
    for (const table of tablesData) {
      const area = table.area_name || 'Other'
      const list = groups.get(area) ?? []
      list.push(table)
      groups.set(area, list)
    }
    return Array.from(groups.entries())
  }, [tablesData])

  if (!qrToken) {
    return (
      <TablePicker
        t={t}
        tablesLoading={tablesLoading}
        tablesError={tablesError}
        tablesRawError={tablesRawError}
        areaGroups={areaGroups}
        pendingJoinToken={pendingJoinToken}
        joinState={joinState}
        guestName={guestName}
        nameError={nameError}
        isPending={joinMutation.isPending}
        onSelectTable={(token) => {
          attemptedToken.current = null
          setGuestName('')
          setNameError('')
          setPendingJoinToken(token)
        }}
        onNameChange={handleNameChange}
        onSubmitName={() => {
          const trimmed = guestName.trim()
          if (!trimmed) {
            setNameError(t.qr_name_required)
            return
          }
          setNameError('')
          void handleJoin(pendingJoinToken!, trimmed)
        }}
        onCloseDialog={() => {
          setPendingJoinToken(null)
          setNameError('')
        }}
      />
    )
  }

  return (
    <JoinFlow
      qrToken={qrToken}
      t={t}
      joinState={joinState}
      message={message}
      guestName={guestName}
      nameError={nameError}
      isPending={joinMutation.isPending}
      hasSession={Boolean(state.session)}
      onNameChange={handleNameChange}
      onSubmitName={handleJoinWithName}
      onRetry={() => {
        attemptedToken.current = null
        setJoinState('idle')
        setGuestName('')
      }}
    />
  )
}

// ── Shared guest-name form (input + error + submit button) ─────────────────

function NameForm({
  guestName,
  nameError,
  onChange,
  onSubmit,
  isPending,
  t,
  secondaryAction,
}: {
  guestName: string
  nameError: string
  onChange: (value: string) => void
  onSubmit: () => void
  isPending: boolean
  t: Dict
  secondaryAction?: ReactNode
}) {
  const submitButton = (
    <button
      type="button"
      disabled={isPending}
      onClick={onSubmit}
      className={cn(
        'flex cursor-pointer items-center justify-center rounded-2xl bg-[var(--text)] text-[var(--bg)] font-semibold shadow-lg transition-all active:scale-[0.98] disabled:opacity-50',
        secondaryAction ? 'flex-1 h-12 text-sm' : 'mt-5 h-14 w-full text-base',
      )}
    >
      {isPending ? <Loader2 className="size-5 animate-spin" /> : t.qr_join_table}
    </button>
  )

  return (
    <>
      <input
        type="text"
        value={guestName}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t.qr_name_placeholder}
        className="w-full rounded-xl border border-[var(--separator)] bg-white px-4 py-3 text-base text-[var(--text)] outline-none transition focus:border-blue-400"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit()
        }}
      />
      {nameError && <p className="mt-2 text-xs text-red-500">{nameError}</p>}
      {secondaryAction ? (
        <div className="mt-4 flex gap-3">
          {secondaryAction}
          {submitButton}
        </div>
      ) : (
        submitButton
      )}
    </>
  )
}

// ── Table-picker screen (no qrToken) ────────────────────────────────────────

function TablePicker({
  t,
  tablesLoading,
  tablesError,
  tablesRawError,
  areaGroups,
  pendingJoinToken,
  joinState,
  guestName,
  nameError,
  isPending,
  onSelectTable,
  onNameChange,
  onSubmitName,
  onCloseDialog,
}: {
  t: Dict
  tablesLoading: boolean
  tablesError: boolean
  tablesRawError: unknown
  areaGroups: [string, GuestTable[]][]
  pendingJoinToken: string | null
  joinState: JoinState
  guestName: string
  nameError: string
  isPending: boolean
  onSelectTable: (token: string) => void
  onNameChange: (value: string) => void
  onSubmitName: () => void
  onCloseDialog: () => void
}) {
  return (
    <div className="min-h-dvh bg-[var(--bg)]">
      <div className={pendingJoinToken ? 'pointer-events-none opacity-40' : ''}>
        <div className="mx-auto max-w-3xl px-5 py-10">
          {/* Header */}
          <div className="mb-10 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">{t.restaurant}</h1>
            <p className="mt-1.5 text-sm text-[var(--text-tertiary)]">{t.qr_desc}</p>
          </div>

          {/* Loading */}
          {tablesLoading && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--text-tertiary)]">
              <ScanLine size={16} className="animate-pulse" />
              {t.qr_loading}
            </div>
          )}

          {/* Error */}
          {tablesError && (
            <div className="mx-auto max-w-sm rounded-xl border border-red-300/30 bg-red-50/50 p-5 text-center dark:border-red-800/30 dark:bg-red-950/20">
              <AlertCircle size={24} className="mx-auto mb-2 text-red-500" />
              <p className="mb-3 text-sm font-medium text-red-600 dark:text-red-400">
                {errorMessage(tablesRawError, t.qr_failed_load)}
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="cursor-pointer text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
              >
                {t.qr_retry}
              </button>
            </div>
          )}

          {/* Empty */}
          {!tablesLoading && !tablesError && !areaGroups.length && (
            <div className="flex flex-col items-center py-16 text-[var(--text-tertiary)]">
              <QrCode size={40} className="mb-3 opacity-30" />
              <p className="text-sm">{t.qr_no_data}</p>
            </div>
          )}

          {/* Table groups */}
          {!tablesLoading && !!areaGroups.length && (
            <div className="space-y-8">
              {areaGroups.map(([areaName, areaTables]) => (
                <section key={areaName}>
                  <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--text-tertiary)]">
                    {areaName}
                    <span className="ml-2 font-normal normal-case opacity-50">
                      {areaTables.length} {t.qr_tables_word}
                    </span>
                  </h2>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {areaTables.map((table) => (
                      <TableCard
                        key={table.table_id}
                        table={table}
                        t={t}
                        onClick={() => {
                          if (!table.qr_token || !table.has_active_qr) return
                          onSelectTable(table.qr_token)
                        }}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Name prompt dialog overlay ─────────────────────────────────── */}
      {pendingJoinToken && joinState === 'idle' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--separator)] bg-[var(--material-thick)] p-6 text-center shadow-2xl backdrop-blur-2xl">
            <img
              src="/zenith-logo-transparent.png"
              alt="Logo"
              className="mx-auto mb-4 size-16 rounded-[20px] object-cover shadow-lg"
            />
            <h2 className="mb-1 text-lg font-semibold text-[var(--text)]">{t.qr_name_label}</h2>
            <p className="mb-5 text-xs text-[var(--text-tertiary)]">{t.session_hint}</p>
            <NameForm
              guestName={guestName}
              nameError={nameError}
              onChange={onNameChange}
              onSubmit={onSubmitName}
              isPending={isPending}
              t={t}
              secondaryAction={
                <button
                  type="button"
                  onClick={onCloseDialog}
                  className="flex-1 flex h-12 cursor-pointer items-center justify-center rounded-2xl border border-[var(--separator)] bg-[var(--material-regular)] text-[var(--text-secondary)] font-semibold text-sm transition-all active:scale-[0.98]"
                >
                  {t.close}
                </button>
              }
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Join-flow screen (qrToken present) ──────────────────────────────────────

function JoinFlow({
  qrToken,
  t,
  joinState,
  message,
  guestName,
  nameError,
  isPending,
  hasSession,
  onNameChange,
  onSubmitName,
  onRetry,
}: {
  qrToken: string
  t: Dict
  joinState: JoinState
  message: string
  guestName: string
  nameError: string
  isPending: boolean
  hasSession: boolean
  onNameChange: (value: string) => void
  onSubmitName: () => void
  onRetry: () => void
}) {
  const displayToken = `•••${qrToken.slice(-6)}`
  const showNameForm = joinState === 'idle' && !hasSession
  const showStatus = joinState !== 'idle'
  const canRetry = joinState !== 'joining' && !isPending

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[var(--bg)] px-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-10">
        {/* Brand */}
        <div className="text-center">
          <img
            src="/zenith-logo-transparent.png"
            alt={t.restaurant}
            className="mx-auto mb-3 size-20 rounded-[22px] object-cover shadow-lg"
          />
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">{t.restaurant}</h1>
        </div>

        {/* Name input (before joining) */}
        {showNameForm && (
          <div className="w-full rounded-2xl border border-[var(--separator)] bg-[var(--material-thin)] p-6 text-center">
            <img
              src="/zenith-logo-transparent.png"
              alt="Logo"
              className="mx-auto mb-4 size-16 rounded-[20px] object-cover shadow-lg"
            />
            <h2 className="mb-1 text-lg font-semibold text-[var(--text)]">{t.qr_name_label}</h2>
            <p className="mb-5 text-xs text-[var(--text-tertiary)]">{t.session_hint}</p>
            <NameForm
              guestName={guestName}
              nameError={nameError}
              onChange={onNameChange}
              onSubmit={onSubmitName}
              isPending={isPending}
              t={t}
            />
          </div>
        )}

        {/* Status card (after joining attempt) */}
        {showStatus && (
          <>
            <div
              className={cn(
                'w-full rounded-2xl border p-8 text-center transition-all duration-500',
                joinState === 'error' || joinState === 'not_opened'
                  ? 'border-red-200 bg-red-50/60 dark:border-red-800/30 dark:bg-red-950/15'
                  : joinState === 'joining'
                    ? 'border-blue-200 bg-blue-50/60 dark:border-blue-800/30 dark:bg-blue-950/15'
                    : 'border-[var(--separator)] bg-[var(--material-thin)]',
              )}
            >
              {/* Badge */}
              <div
                className={cn(
                  'mb-5 inline-block rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider',
                  joinState === 'error' || joinState === 'not_opened'
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                    : joinState === 'pending_verification'
                      ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                )}
              >
                {joinState === 'error' || joinState === 'not_opened'
                  ? t.qr_action_required
                  : joinState === 'pending_verification'
                    ? t.qr_pending_badge
                    : `${t.qr_scanned} ${displayToken}`}
              </div>

              {/* Icon */}
              <div className="mx-auto mb-4 flex size-36 items-center justify-center rounded-2xl border border-[var(--separator)] bg-white">
                {joinState === 'pending_verification' ? (
                  <WaitingForStaff />
                ) : joinState === 'joining' ? (
                  <ScanLine size={60} className="animate-pulse text-blue-500" />
                ) : joinState === 'error' || joinState === 'not_opened' ? (
                  <AlertCircle size={60} className="text-red-400" />
                ) : (
                  <QrCode size={60} className="text-gray-300" />
                )}
              </div>

              <p
                className={cn(
                  'text-sm leading-relaxed',
                  joinState === 'error' || joinState === 'not_opened'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-[var(--text-secondary)]',
                )}
              >
                {message || t.session_hint}
              </p>

              {joinState === 'pending_verification' && (
                <>
                  <p className="mt-2 text-xs text-[var(--text-tertiary)]">{t.qr_pending_hint}</p>
                  <div className="mt-3 flex justify-center gap-1.5">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="size-1.5 animate-bounce rounded-full bg-orange-400"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Action */}
            <button
              type="button"
              disabled={!canRetry || joinState === 'pending_verification'}
              onClick={onRetry}
              className="flex h-14 w-full cursor-pointer items-center justify-center rounded-2xl bg-[var(--text)] text-[var(--bg)] font-semibold text-base shadow-lg transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {joinState === 'joining'
                ? t.qr_joining
                : joinState === 'pending_verification'
                  ? t.qr_please_wait
                  : joinState === 'not_opened' || joinState === 'error'
                    ? t.qr_retry
                    : t.start_ordering}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function WaitingForStaff() {
  return (
    <div className="relative flex size-24 items-center justify-center">
      {/* expanding rings */}
      <span className="absolute size-16 animate-ping rounded-full bg-orange-400/25 [animation-duration:2s]" />
      <span className="absolute size-24 animate-ping rounded-full bg-orange-400/15 [animation-duration:2s] [animation-delay:0.6s]" />
      {/* rotating arc */}
      <span className="absolute size-20 animate-spin rounded-full border-2 border-orange-200 border-t-orange-500 [animation-duration:1.6s]" />
      <img
        src="/zenith-logo-transparent.png"
        alt="Zenith"
        className="relative size-10 rounded-[10px] object-cover shadow-sm"
      />
    </div>
  )
}

// ── Table card ───────────────────────────────────────────────────────────────

function TableCard({ table, onClick, t }: { table: GuestTable; onClick: () => void; t: Dict }) {
  const hasQr = table.has_active_qr
  const hasSession = table.has_active_session ?? true
  const isOpened = hasQr && hasSession
  const isDisabled = !hasQr

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [showQrModal, setShowQrModal] = useState(false)

  useEffect(() => {
    if (!table.qr_token) return
    let active = true
    QRCodeLib.toDataURL(buildQROrderURL(table.qr_token), { width: 320, margin: 2 }).then(
      (dataUrl) => {
        if (active) setQrDataUrl(dataUrl)
      },
    )
    return () => {
      active = false
    }
  }, [table.qr_token])

  const [bigQr, setBigQr] = useState<string | null>(null)
  useEffect(() => {
    if (!showQrModal || !table.qr_token) return
    let active = true
    QRCodeLib.toDataURL(buildQROrderURL(table.qr_token), { width: 800, margin: 4 }).then(
      (dataUrl) => {
        if (active) setBigQr(dataUrl)
      },
    )
    return () => {
      active = false
    }
  }, [showQrModal, table.qr_token])

  return (
    <>
      <button
        type="button"
        disabled={isDisabled}
        onClick={hasQr ? onClick : undefined}
        className={cn(
          'group relative flex flex-col items-center gap-2 rounded-xl border border-[var(--separator)] bg-[var(--material-thin)] p-4 transition-all',
          isOpened
            ? 'cursor-pointer hover:border-blue-300 hover:shadow-sm active:scale-[0.97] dark:hover:border-blue-700'
            : hasQr
              ? 'cursor-pointer opacity-60 hover:opacity-80 active:scale-[0.98]'
              : 'cursor-not-allowed opacity-40',
        )}
      >
        <div
          className="relative flex size-28 items-center justify-center rounded-lg bg-white p-2 shadow-sm"
          onClick={(e) => {
            if (!hasQr || !qrDataUrl) return
            e.stopPropagation()
            setShowQrModal(true)
          }}
        >
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt=""
              className={cn(
                'size-full object-contain transition-all',
                !isOpened && 'opacity-30 blur-[1px] grayscale-[60%]',
                isOpened && 'cursor-zoom-in',
              )}
            />
          ) : (
            <QrCode size={36} className="text-gray-300" />
          )}
          {!hasQr ? (
            <span className="absolute inset-x-1 top-1/2 -translate-y-1/2 rounded-md bg-[var(--text)]/75 px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--bg)] text-center">
              {t.qr_inactive}
            </span>
          ) : !hasSession ? (
            <span className="absolute inset-x-1 top-1/2 -translate-y-1/2 rounded-md bg-amber-500/95 px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white text-center shadow-sm backdrop-blur-sm">
              {t.qr_not_opened_badge}
            </span>
          ) : null}
        </div>
        <div className={cn('text-center', !isOpened && 'opacity-60')}>
          <div className="text-sm font-semibold text-[var(--text)]">{table.table_name}</div>
          <div className="mt-0.5 flex items-center justify-center gap-1 text-[11px] text-[var(--text-tertiary)]">
            <Users size={11} />
            <span>{table.capacity}</span>
            <span className="ml-1 font-mono opacity-50">{table.table_code}</span>
          </div>
        </div>
      </button>

      {/* QR preview modal */}
      {showQrModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
          onClick={() => {
            setShowQrModal(false)
            setBigQr(null)
          }}
        >
          <div
            className="flex w-full max-w-xs flex-col items-center gap-4 rounded-2xl bg-white p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="text-base font-semibold text-gray-900">{table.table_name}</div>
              <div className="mt-0.5 text-xs text-gray-500">{table.table_code}</div>
            </div>
            {bigQr ? (
              <img src={bigQr} alt="" className="size-72 rounded-lg" />
            ) : (
              <div className="flex size-72 items-center justify-center rounded-lg bg-gray-50">
                <Loader2 className="size-8 animate-spin text-gray-300" />
              </div>
            )}
            <p className="text-center text-xs text-gray-400">{t.qr_scan_hint}</p>
          </div>
        </div>
      )}
    </>
  )
}
