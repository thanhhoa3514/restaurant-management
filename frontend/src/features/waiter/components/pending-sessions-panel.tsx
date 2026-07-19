import type { FC } from 'react'
import { Check, X, Loader2 } from 'lucide-react'
import { usePendingSessions } from '@/features/dining/queries/usePendingSessions'
import { useVerifySession } from '@/features/dining/mutations/useVerifySession'
import { Button } from '@/components/ui/button'

export const PendingSessionsPanel: FC = () => {
  const { data, isLoading } = usePendingSessions()
  const verifyMutation = useVerifySession()

  if (isLoading || !data || data.sessions.length === 0) {
    return null
  }

  return (
    <div className="flex gap-2">
      {data.sessions.map((session) => (
        <div 
          key={session.session_id} 
          className="flex items-center gap-3 rounded-full bg-orange-50/80 pl-4 pr-1.5 py-1.5 border border-orange-200 shadow-sm dark:bg-orange-900/20 dark:border-orange-800"
        >
          <div className="flex flex-col">
            <span className="text-xs font-bold text-orange-900 dark:text-orange-100">
              {session.table_name}
            </span>
            <span className="text-[10px] font-medium text-orange-700 dark:text-orange-300">
              {session.guest_name}
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-full bg-white border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:bg-red-950 dark:border-red-900 dark:hover:bg-red-900"
              disabled={verifyMutation.isPending}
              onClick={() => verifyMutation.mutate({ sessionId: session.session_id, action: 'reject' })}
            >
              <X size={14} />
            </Button>
            <Button
              variant="default"
              size="icon"
              className="h-7 w-7 rounded-full bg-orange-500 hover:bg-orange-600 text-white"
              disabled={verifyMutation.isPending}
              onClick={() => verifyMutation.mutate({ sessionId: session.session_id, action: 'approve' })}
            >
              {verifyMutation.isPending && verifyMutation.variables?.sessionId === session.session_id && verifyMutation.variables?.action === 'approve' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
