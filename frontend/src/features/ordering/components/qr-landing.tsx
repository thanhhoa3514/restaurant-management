import { useCallback, useEffect, useMemo, useRef, useState, type FC } from 'react'
import { QrCode, ScanLine, Sparkles, AlertCircle } from 'lucide-react'

import { ApiError } from '@/lib/api'

import { useOrdering } from '../hooks/use-ordering'
import { DICT } from '../data/i18n'
import { joinDiningSession } from '../api'
import { cn } from '../../../lib/utils'

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

  const [nowMs, setNowMs] = useState<number>(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const now = nowMs ? new Date(nowMs) : null

  const labels = useMemo(
    () =>
      state.lang === 'vi'
        ? {
            noTokenTitle: 'Vui lòng quét mã QR tại bàn',
            noTokenDesc: 'Mã QR chứa mã phiên an toàn để xác định đúng bàn của bạn.',
            scanned: 'Đã nhận mã QR',
            joining: 'Đang xác thực mã QR...',
            notOpened: 'Bàn chưa được mở phiên',
            notOpenedDesc: 'Vui lòng gọi nhân viên mở phiên bàn, sau đó bấm thử lại.',
            retry: 'Thử lại',
            invalid: 'Mã QR không hợp lệ hoặc đã bị thay đổi. Vui lòng quét mã mới.',
            network: 'Không thể kết nối máy chủ. Vui lòng thử lại.',
            ready: 'Phiên đã sẵn sàng',
          }
        : {
            noTokenTitle: 'Please scan the table QR code',
            noTokenDesc: 'The QR code contains a secure session code for your table.',
            scanned: 'QR code received',
            joining: 'Verifying QR code...',
            notOpened: 'Table session is not open yet',
            notOpenedDesc: 'Please ask staff to open this table, then retry.',
            retry: 'Retry',
            invalid: 'This QR code is invalid or has been rotated. Please scan the latest code.',
            network: 'Cannot connect to the server. Please retry.',
            ready: 'Session ready',
          },
    [state.lang],
  )

  const displayToken = qrToken ? `•••${qrToken.slice(-6)}` : ''

  const handleJoin = useCallback(
    async (token: string) => {
      setJoinState('joining')
      setMessage(labels.joining)

      try {
        const joined = await joinDiningSession(token)

        if (joined.status === 'not_opened') {
          setJoinState('not_opened')
          setMessage(labels.notOpenedDesc)
          return
        }

        if (!joined.session_token || !joined.session_id || !joined.table_id) {
          setJoinState('error')
          setMessage(labels.invalid)
          return
        }

        dispatch({
          type: 'SET_SESSION',
          payload: {
            token: joined.session_token,
            table: joined.table_id.slice(0, 8).toUpperCase(),
            startedAt: new Date(),
            sessionId: joined.session_id,
            tableId: joined.table_id,
            restaurantId: joined.restaurant_id,
            status: joined.status,
          },
        })
        setJoinState('ready')
        setMessage(labels.ready)
        
        // Add a slight delay before transitioning for smoothness
        setTimeout(() => {
          dispatch({ type: 'SET_SCREEN', payload: 'menu' })
        }, 600)
      } catch (err) {
        setJoinState('error')
        setMessage(err instanceof ApiError && err.status === 0 ? labels.network : labels.invalid)
      }
    },
    [dispatch, labels],
  )

  useEffect(() => {
    if (!qrToken || attemptedToken.current === qrToken || state.session) return
    attemptedToken.current = qrToken
    void handleJoin(qrToken)
  }, [handleJoin, qrToken, state.session])

  const canRetry = Boolean(qrToken) && joinState !== 'joining'

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-6 overflow-hidden bg-[var(--bg)]">
      {/* Background ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120vw] h-[120vw] max-w-[600px] max-h-[600px] bg-[var(--system-blue)]/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center gap-12 w-full max-w-sm animate-in fade-in slide-in-from-bottom-8 duration-700">
        {/* Branding Section */}
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="relative size-24">
            <div className="absolute inset-0 bg-gradient-to-tr from-[var(--system-blue)] to-[var(--system-purple)] rounded-3xl opacity-20 blur-xl animate-pulse" />
            <div className="relative size-full rounded-3xl bg-gradient-to-br from-[var(--system-blue)] to-[var(--system-purple)] p-[2px] shadow-lg">
              <div className="size-full bg-[var(--bg)] rounded-[22px] flex items-center justify-center">
                <Sparkles size={40} className="text-[var(--system-blue)] drop-shadow-sm" />
              </div>
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-[var(--text)] bg-clip-text">
              {t.restaurant}
            </h1>
            <p className="text-[15px] font-medium text-[var(--text-tertiary)] mt-2">
              {t.tagline}
            </p>
          </div>
        </div>

        {/* Scan / Status Card */}
        <div className={cn(
          "w-full rounded-[32px] p-8 flex flex-col items-center gap-6 shadow-[0_8px_40px_rgba(0,0,0,0.06)] border border-[var(--separator)]/50 backdrop-blur-3xl transition-all duration-500",
          joinState === 'error' || joinState === 'not_opened' 
            ? "bg-[var(--system-red)]/5 border-[var(--system-red)]/20" 
            : joinState === 'joining'
              ? "bg-[var(--system-blue)]/5 border-[var(--system-blue)]/20 scale-[0.98]"
              : "bg-[var(--material-thin)]/80"
        )}>
          
          <div className="flex flex-col items-center gap-2">
            <div className={cn(
              "px-4 py-1.5 rounded-full text-[12px] font-bold uppercase tracking-widest",
              qrToken 
                ? joinState === 'error' || joinState === 'not_opened'
                  ? "bg-[var(--system-red)]/10 text-[var(--system-red)]"
                  : "bg-[var(--system-green)]/10 text-[var(--system-green)]"
                : "bg-[var(--surface-grouped)] text-[var(--text-secondary)]"
            )}>
              {qrToken ? (joinState === 'error' || joinState === 'not_opened' ? 'Action Required' : `${labels.scanned} ${displayToken}`) : labels.noTokenTitle}
            </div>
          </div>

          <div className="relative size-48 rounded-[24px] bg-[var(--surface-grouped)] flex items-center justify-center shadow-inner overflow-hidden border border-[var(--separator)]/30">
            {joinState === 'joining' ? (
              <>
                <ScanLine size={80} className="text-[var(--system-blue)] animate-pulse" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--system-blue)]/20 to-transparent animate-[scan_2s_ease-in-out_infinite]" />
              </>
            ) : joinState === 'error' || joinState === 'not_opened' ? (
              <AlertCircle size={80} className="text-[var(--system-red)]/80" />
            ) : (
              <QrCode size={80} className="text-[var(--text-quaternary)]/60" />
            )}
          </div>
          
          <p className={cn(
            "text-[14px] font-medium text-center leading-relaxed",
            joinState === 'error' || joinState === 'not_opened' ? "text-[var(--system-red)]" : "text-[var(--text-secondary)]"
          )}>
            {message || (qrToken ? t.session_hint : labels.noTokenDesc)}
          </p>
        </div>

        {/* Action Section */}
        <div className="w-full flex flex-col gap-4">
          <button
            type="button"
            className="group relative w-full h-[60px] flex items-center justify-center gap-2 overflow-hidden rounded-[20px] bg-[var(--text)] text-[var(--bg)] shadow-xl transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => {
              if (!qrToken) return
              attemptedToken.current = null
              void handleJoin(qrToken)
            }}
            disabled={!canRetry}
          >
            {canRetry && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />}
            <span className="font-bold text-[18px] relative z-10">
              {joinState === 'joining'
                ? labels.joining
                : joinState === 'not_opened' || joinState === 'error'
                  ? labels.retry
                  : qrToken
                    ? t.start_ordering
                    : labels.noTokenTitle}
            </span>
          </button>

          <p className="text-[12px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest text-center mt-2">
            {t.now} &middot; {now ? now.toLocaleTimeString() : '--:--'}
          </p>
        </div>
      </div>
      <style>{`
        @keyframes scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
      `}</style>
    </div>
  )
}
