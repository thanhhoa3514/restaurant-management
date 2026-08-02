// Public guest-facing table info with QR token (no auth required).
export interface GuestTable {
  table_id: string
  table_code: string
  table_name: string
  area_name: string
  capacity: number
  has_active_qr: boolean
  has_active_session?: boolean
  qr_token?: string
}

export interface TableQR {
  table_id: string
  table_code: string
  table_name: string
  table_status: string
  capacity: number
  area_id: string | null
  area_name: string
  area_order: number
  qr_code_id?: string
  qr_token?: string
  has_active_qr: boolean
}

export interface ManageTableQRResult {
  id: string
  table_id: string
  token: string
  status: string
  rotated: boolean
}

// One waiting phone (device) the waiter must approve or reject. `device_id` is
// the session_devices row id the verify endpoint acts on; `is_owner` marks the
// phone that first opened the table.
export interface PendingSession {
  device_id: string
  session_id: string
  table_id: string
  table_code: string
  table_name: string
  customer_name: string
  is_owner: boolean
  created_at: string
}
