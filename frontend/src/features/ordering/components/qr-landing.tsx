import { useCallback, useEffect, useMemo, useRef, useState, type FC } from 'react'
import { QrCode, ScanLine, AlertCircle, Users } from 'lucide-react'
import QRCodeLib from 'qrcode'
import { useQuery } from '@tanstack/react-query'
import { ApiError } from '@/lib/api'
import { useOrdering } from '../hooks/use-ordering'
import { DICT } from '../data/i18n'
import { joinDiningSession } from '../api'
import { fetchGuestTables, buildQROrderURL } from '@/features/dining/api'
import type { GuestTable } from '@/features/dining/types'
import { cn } from '@/lib/utils'

interface QRLandingProps {
  qrToken?: string
}

type JoinState = 'idle' | 'joining' | 'ready' | 'not_opened' | 'error'

export const QRLanding: FC<QRLandingProps> = ({ qrToken }) => {
  const { state, dispatch } = useOrdering()
  const t = DICT[state.lang]
  const attemptedToken = useRef<string | null>(null)

  const [joinState, setJoinState] = useState<JoinState>('idle')
  const [message, setMessage] = useState('')
  const [guestName, setGuestName] = useState('')
  const [nameError, setNameError] = useState('')

  const {
    data: tablesData,
    isLoading: tablesLoading,
    isError: tablesError,
    error: tablesRawError,
  } = useQuery({
    queryKey: ['dining', 'guest-tables'],
    queryFn: fetchGuestTables,
    enabled: !qrToken,
    select: (data) => data.filter((t: GuestTable) => t.has_active_qr && t.qr_token),
    staleTime: 30_000,
  })

  // ── Generate QR data URLs for each table ───────────────────────────────────
  const [qrDataUrls, setQrDataUrls] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    if (qrToken || !tablesData?.length) return
    let active = true
    Promise.all(
      tablesData.map(async (table) => {
        const url = buildQROrderURL(table.qr_token!)
        const dataUrl = await QRCodeLib.toDataURL(url, { width: 320, margin: 2 })
        return { id: table.table_id, dataUrl }
      }),
    ).then((results) => {
      if (!active) return
      setQrDataUrls(new Map(results.map((r) => [r.id, r.dataUrl])))
    })
    return () => {
      active = false
    }
  }, [tablesData, qrToken])

  const displayToken = qrToken ? `•••${qrToken.slice(-6)}` : ''

  const handleJoin = useCallback(
    async (token: string, name?: string) => {
      setJoinState('joining')
      setMessage(t.qr_joining)

      try {
        const joined = await joinDiningSession(token, name)

        if (joined.status === 'not_opened') {
          setJoinState('not_opened')
          setMessage(t.qr_not_opened_desc)
          return
        }

        if (!joined.session_token || !joined.session_id || !joined.table_id) {
          setJoinState('error')
          setMessage(t.qr_invalid)
          return
        }

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
      } catch (err) {
        setJoinState('error')
        setMessage(err instanceof ApiError && err.status === 0 ? t.qr_network : t.qr_invalid)
      }
    },
    [dispatch, t],
  )

  const canRetry = Boolean(qrToken) && joinState !== 'joining'

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
      <div className="min-h-dvh bg-[var(--bg)]">
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
                {tablesRawError instanceof ApiError ? tablesRawError.message : t.qr_failed_load}
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
          {!tablesLoading && !tablesError && !tablesData?.length && (
            <div className="flex flex-col items-center py-16 text-[var(--text-tertiary)]">
              <QrCode size={40} className="mb-3 opacity-30" />
              <p className="text-sm">{t.qr_no_data}</p>
            </div>
          )}

          {/* Table groups */}
          {!tablesLoading && !!tablesData?.length && (
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
                        qrDataUrl={qrDataUrls.get(table.table_id) ?? null}
                        onClick={() => {
                          if (!table.qr_token) return
                          attemptedToken.current = null
                          void handleJoin(table.qr_token)
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
    )
  }

  const showNameForm = joinState === 'idle' && !state.session
  const showStatus = joinState !== 'idle'

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
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--system-blue)] to-[var(--system-purple)] shadow-lg">
              <Users size={24} className="text-white" />
            </div>
            <h2 className="mb-1 text-lg font-semibold text-[var(--text)]">{t.qr_name_label}</h2>
            <p className="mb-5 text-xs text-[var(--text-tertiary)]">{t.session_hint}</p>
            <input
              type="text"
              value={guestName}
              onChange={(e) => {
                setGuestName(e.target.value)
                if (nameError) setNameError('')
              }}
              placeholder={t.qr_name_placeholder}
              className="w-full rounded-xl border border-[var(--separator)] bg-white px-4 py-3 text-base text-[var(--text)] outline-none transition focus:border-blue-400"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleJoinWithName()
              }}
            />
            {nameError && (
              <p className="mt-2 text-xs text-red-500">{nameError}</p>
            )}
            <button
              type="button"
              onClick={handleJoinWithName}
              className="mt-5 flex h-14 w-full cursor-pointer items-center justify-center rounded-2xl bg-[var(--text)] text-[var(--bg)] font-semibold text-base shadow-lg transition-all active:scale-[0.98]"
            >
              {t.qr_join_table}
            </button>
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
                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                )}
              >
                {joinState === 'error' || joinState === 'not_opened'
                  ? t.qr_action_required
                  : `${t.qr_scanned} ${displayToken}`}
              </div>

              {/* Icon */}
              <div className="mx-auto mb-4 flex size-36 items-center justify-center rounded-2xl border border-[var(--separator)] bg-white">
                {joinState === 'joining' ? (
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
                {message || (qrToken ? t.session_hint : t.qr_desc)}
              </p>
            </div>

            {/* Action */}
            <button
              type="button"
              disabled={!canRetry}
              onClick={() => {
                if (!qrToken) return
                attemptedToken.current = null
                setJoinState('idle')
                setGuestName('')
              }}
              className="flex h-14 w-full cursor-pointer items-center justify-center rounded-2xl bg-[var(--text)] text-[var(--bg)] font-semibold text-base shadow-lg transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {joinState === 'joining'
                ? t.qr_joining
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

// ── Table card ───────────────────────────────────────────────────────────────

function TableCard({
  table,
  qrDataUrl,
  onClick,
}: {
  table: GuestTable
  qrDataUrl: string | null
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-2 rounded-xl border border-[var(--separator)] bg-[var(--material-thin)] p-4 cursor-pointer transition-all hover:border-blue-300 hover:shadow-sm active:scale-[0.97] dark:hover:border-blue-700"
    >
      <div className="flex size-28 items-center justify-center rounded-lg bg-white p-2 shadow-sm">
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="" className="size-full object-contain" />
        ) : (
          <QrCode size={36} className="text-gray-300" />
        )}
      </div>
      <div className="text-center">
        <div className="text-sm font-semibold text-[var(--text)]">{table.table_name}</div>
        <div className="mt-0.5 flex items-center justify-center gap-1 text-[11px] text-[var(--text-tertiary)]">
          <Users size={11} />
          <span>{table.capacity}</span>
          <span className="ml-1 font-mono opacity-50">{table.table_code}</span>
        </div>
      </div>
    </button>
  )
}
