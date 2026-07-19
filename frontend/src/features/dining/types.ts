// Public guest-facing table info with QR token (no auth required).
export interface GuestTable {
  table_id: string
  table_code: string
  table_name: string
  area_name: string
  capacity: number
  has_active_qr: boolean
  qr_token?: string
}


export interface TableQR {
  table_id: string
  table_code: string
  table_name: string
  table_status: string
  capacity: number
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

export interface PendingSession {
  session_id: string
  table_id: string
  table_code: string
  table_name: string
  customer_name: string
}
