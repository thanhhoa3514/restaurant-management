import { useState, type FC } from 'react'
import { BellRing, Check, X, Loader2, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { useWaiter } from '@/features/waiter/hooks/use-waiter'
import { wfFmtTime } from '@/features/waiter/helpers'
import { usePendingSessions } from '@/features/dining/queries/usePendingSessions'
import { useVerifySession } from '@/features/dining/mutations/useVerifySession'

export const ActionCenterPanel: FC = () => {
  const { state, actions } = useWaiter()
  const { data: pendingSessions, isLoading: sessionsLoading } = usePendingSessions()
  const verifyMutation = useVerifySession()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'orders' | 'sessions'>('orders')

  // Gom tất cả các order item đang ở trạng thái pending từ tất cả các bàn
  const pendingOrders = state.tables.flatMap((table) => {
    if (!table.session) return []
    return table.session.orders.flatMap((order) => {
      return order.items
        .filter((item) => item.status === 'placed')
        .map((item) => ({
          tableId: table.id,
          tableCode: table.code,
          orderId: order.id,
          submittedAt: order.submitted_at,
          ...item,
        }))
    })
  })

  // Sắp xếp theo thời gian cũ nhất lên trước
  pendingOrders.sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime())

  const totalSessions = pendingSessions?.length || 0
  const totalOrders = pendingOrders.length
  const totalTasks = totalSessions + totalOrders

  if (totalTasks === 0 && !open) {
    return null
  }

  // Tự động chuyển tab nếu tab hiện tại trống mà tab kia có đồ
  if (open) {
    if (tab === 'orders' && totalOrders === 0 && totalSessions > 0) {
      setTab('sessions')
    } else if (tab === 'sessions' && totalSessions === 0 && totalOrders > 0) {
      setTab('orders')
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            className="relative h-9 gap-2 rounded-full border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:text-orange-800 dark:border-orange-900 dark:bg-orange-950/50 dark:text-orange-400 dark:hover:bg-orange-900/50 pr-2 pl-3"
          />
        }
      >
          <BellRing className="size-4 animate-[swing_2s_ease-in-out_infinite]" />
          <span className="text-sm font-semibold hidden sm:inline">
            {state.lang === 'vi' ? 'Việc cần làm' : 'Tasks'}
          </span>
          <Badge className="ml-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-orange-500 px-1.5 text-white">
            {totalTasks}
          </Badge>
      </SheetTrigger>
      
      <SheetContent className="w-full sm:max-w-md bg-[var(--material-thick)] backdrop-blur-2xl flex flex-col p-0">
        <SheetHeader className="p-5 pb-4 border-b border-[var(--separator)]">
          <SheetTitle className="text-lg font-bold flex items-center gap-2">
            <BellRing className="size-5 text-orange-500" />
            {state.lang === 'vi' ? 'Trung tâm xử lý' : 'Action Center'}
            <Badge variant="secondary" className="ml-auto bg-orange-500/10 text-orange-600 rounded-full">
              {totalTasks} {state.lang === 'vi' ? 'yêu cầu' : 'requests'}
            </Badge>
          </SheetTitle>
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full mt-4">
            <TabsList className="w-full grid grid-cols-2 rounded-xl h-11 bg-[var(--surface-grouped)] p-1">
              <TabsTrigger value="orders" className="rounded-lg font-semibold relative">
                {state.lang === 'vi' ? 'Món chờ duyệt' : 'Pending Orders'}
                {totalOrders > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center bg-orange-500 rounded-full p-0 text-[10px]">
                    {totalOrders}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="sessions" className="rounded-lg font-semibold relative">
                {state.lang === 'vi' ? 'Mở bàn' : 'Open Table'}
                {totalSessions > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 min-w-5 flex items-center justify-center bg-orange-500 rounded-full p-0 text-[10px]">
                    {totalSessions}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)]/30">
          {/* TAB ORDERS */}
          {tab === 'orders' && (
            <div className="p-4 space-y-3">
              {totalOrders === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-[var(--text-tertiary)] gap-3 opacity-50">
                  <Check className="size-12" />
                  <p className="text-sm font-medium">
                    {state.lang === 'vi' ? 'Tất cả các món đã được duyệt' : 'All items are confirmed'}
                  </p>
                </div>
              ) : (
                pendingOrders.map((item) => {
                  const name = state.lang === 'vi' ? item.name_vi : item.name_en
                  const optionsText = state.lang === 'vi' ? item.options_text_vi : item.options_text_en
                  
                  return (
                    <div 
                      key={item.id} 
                      className="flex flex-col gap-3 rounded-2xl bg-[var(--bg-elevated)] p-4 shadow-sm border border-[var(--separator)] transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="font-mono bg-[var(--surface-grouped)] text-[var(--text)] border-[var(--separator)]">
                              {item.tableCode}
                            </Badge>
                            <span className="text-xs text-[var(--text-tertiary)] font-mono">
                              {wfFmtTime(item.submittedAt)}
                            </span>
                          </div>
                          <h4 className="text-[15px] font-bold text-[var(--text)] leading-snug">
                            <span className="text-orange-500 mr-1.5">{item.qty}x</span>
                            {name}
                          </h4>
                          {optionsText && (
                            <p className="mt-1 text-[13px] font-medium text-[var(--text-secondary)]">
                              {optionsText}
                            </p>
                          )}
                          {item.notes && (
                            <p className="mt-1.5 text-[13px] font-semibold text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2 py-1 rounded-md inline-block">
                              {item.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 pt-2 border-t border-[var(--separator)]/50">
                        <Button
                          variant="outline"
                          className="flex-1 h-9 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950 font-semibold gap-1.5"
                          onClick={() => {
                            const reason = window.prompt(state.lang === 'vi' ? 'Lý do từ chối:' : 'Reason for rejection:')
                            if (reason !== null) {
                              actions.rejectItem(item.tableId, item.id, reason)
                            }
                          }}
                        >
                          <X className="size-4" strokeWidth={2.5} />
                          {state.lang === 'vi' ? 'Từ chối' : 'Reject'}
                        </Button>
                        <Button
                          className="flex-1 h-9 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold gap-1.5"
                          onClick={() => actions.confirmItem(item.tableId, item.id)}
                        >
                          <Check className="size-4" strokeWidth={2.5} />
                          {state.lang === 'vi' ? 'Duyệt' : 'Confirm'}
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* TAB SESSIONS */}
          {tab === 'sessions' && (
            <div className="p-4 space-y-3">
              {sessionsLoading ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="size-8 animate-spin text-[var(--text-tertiary)]" />
                </div>
              ) : totalSessions === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-[var(--text-tertiary)] gap-3 opacity-50">
                  <Users className="size-12" />
                  <p className="text-sm font-medium">
                    {state.lang === 'vi' ? 'Không có yêu cầu mở bàn nào' : 'No open table requests'}
                  </p>
                </div>
              ) : (
                pendingSessions?.map((session) => (
                  <div 
                    key={session.session_id} 
                    className="flex flex-col gap-3 rounded-2xl bg-[var(--bg-elevated)] p-4 shadow-sm border border-[var(--separator)] transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400">
                        <Users className="size-6" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-[15px] font-bold text-[var(--text)]">
                          {session.table_name}
                        </h4>
                        <p className="text-[13px] font-medium text-[var(--text-secondary)]">
                          {session.customer_name}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 pt-2 border-t border-[var(--separator)]/50">
                      <Button
                        variant="outline"
                        className="flex-1 h-9 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950 font-semibold gap-1.5"
                        disabled={verifyMutation.isPending}
                        onClick={() => verifyMutation.mutate({ sessionId: session.session_id, action: 'reject' })}
                      >
                        <X className="size-4" strokeWidth={2.5} />
                        {state.lang === 'vi' ? 'Từ chối' : 'Reject'}
                      </Button>
                      <Button
                        className="flex-1 h-9 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold gap-1.5"
                        disabled={verifyMutation.isPending}
                        onClick={() => verifyMutation.mutate({ sessionId: session.session_id, action: 'approve' })}
                      >
                        {verifyMutation.isPending && verifyMutation.variables?.sessionId === session.session_id && verifyMutation.variables?.action === 'approve' ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Check className="size-4" strokeWidth={2.5} />
                        )}
                        {state.lang === 'vi' ? 'Mở bàn' : 'Approve'}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
