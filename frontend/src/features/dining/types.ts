// Mirror of backend dining TableQRDTO / ManageTableQRResponse envelopes.

export interface TableQR {
  table_id: string
  table_code: string
  table_name: string
  table_status: string
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
