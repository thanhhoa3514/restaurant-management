import { useCallback, useEffect, useMemo, useRef, useState, type FC } from 'react'

import { ApiError } from '@/lib/api'

import { useOrdering } from '../hooks/use-ordering'
import { DICT } from '../data/i18n'
import { joinDiningSession } from '../api'
import { Button } from '../../../components/ui/button'
import { Badge } from '../../../components/ui/badge'

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
        dispatch({ type: 'SET_SCREEN', payload: 'menu' })
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
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 gap-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="size-32 rounded-full bg-system-blue/10 flex items-center justify-center">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-system-blue"
          >
            <path d="M3 3h18v18H3z" />
            <path d="M9 9h6v6H9z" />
            <path d="M3 9h6" />
            <path d="M15 9h6" />
            <path d="M3 15h6" />
            <path d="M15 15h6" />
            <path d="M9 3v6" />
            <path d="M9 15v6" />
            <path d="M15 3v6" />
            <path d="M15 15v6" />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">{t.restaurant}</h1>
          <p className="text-sm text-secondary mt-1">{t.tagline}</p>
        </div>
      </div>

      <div className="w-full max-w-xs rounded-xl bg-elevated p-6 flex flex-col items-center gap-3">
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-medium">
          {qrToken ? `${labels.scanned} ${displayToken}` : labels.noTokenTitle}
        </Badge>
        <div className="size-40 rounded-xl bg-surface-grouped flex items-center justify-center">
          <svg
            width="80"
            height="80"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-quaternary"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="6" cy="6" r="1" fill="currentColor" />
            <circle cx="10" cy="6" r="1" fill="currentColor" />
            <circle cx="14" cy="6" r="1" fill="currentColor" />
            <circle cx="18" cy="6" r="1" fill="currentColor" />
            <circle cx="6" cy="10" r="1" fill="currentColor" />
            <circle cx="10" cy="10" r="1" fill="currentColor" />
            <circle cx="14" cy="10" r="1" fill="currentColor" />
            <circle cx="18" cy="10" r="1" fill="currentColor" />
            <circle cx="6" cy="14" r="1" fill="currentColor" />
            <circle cx="10" cy="14" r="1" fill="currentColor" />
            <circle cx="14" cy="14" r="1" fill="currentColor" />
            <circle cx="18" cy="14" r="1" fill="currentColor" />
            <circle cx="6" cy="18" r="1" fill="currentColor" />
            <circle cx="10" cy="18" r="1" fill="currentColor" />
            <circle cx="14" cy="18" r="1" fill="currentColor" />
            <circle cx="18" cy="18" r="1" fill="currentColor" />
          </svg>
        </div>
        <p className="text-xs text-tertiary text-center">
          {message || (qrToken ? t.session_hint : labels.noTokenDesc)}
        </p>
      </div>

      <Button
        size="lg"
        className="w-full max-w-xs rounded-xl text-base font-semibold h-14"
        onClick={() => {
          if (!qrToken) return
          attemptedToken.current = null
          void handleJoin(qrToken)
        }}
        disabled={!canRetry}
      >
        {joinState === 'joining'
          ? labels.joining
          : joinState === 'not_opened' || joinState === 'error'
            ? labels.retry
            : qrToken
              ? t.start_ordering
              : labels.noTokenTitle}
      </Button>

      <p className="text-xs text-quaternary">
        {t.now}: {new Date().toLocaleTimeString()}
      </p>
    </div>
  )
}
