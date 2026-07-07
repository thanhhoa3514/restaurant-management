import {
  fetchStaffTables,
  requestSessionBill,
  updateStaffOrderItemStatus,
  type StaffTablesResponse,
} from '@/features/waiter/api'
import { openDiningSession } from '@/features/dining/api'

export const waiterService = {
  getTables(): Promise<StaffTablesResponse> {
    return fetchStaffTables()
  },

  updateItemStatus(itemId: string, status: string): Promise<{ id: string; status: string }> {
    return updateStaffOrderItemStatus(itemId, status)
  },

  requestBill(sessionId: string): Promise<{ session_id: string; status: string; requested_at: string | null }> {
    return requestSessionBill(sessionId)
  },

  openSession(tableId: string): Promise<{ session_id: string; session_code: string; table_id: string; status: string; session_token: string }> {
    return openDiningSession(tableId)
  },
}
