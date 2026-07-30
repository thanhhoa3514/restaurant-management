export const RT_EVENT = {
  ORDER_PLACED: 'ordering.order_placed',
  ITEM_STATUS_UPDATED: 'ordering.item_status_updated',
  ITEM_CONFIRMED: 'ordering.item_confirmed',
  ITEM_REJECTED: 'ordering.item_rejected',
  ITEM_UNAVAILABLE: 'ordering.item_unavailable',

  ORDER_UPDATED: 'order.updated',
  ORDER_CANCELLED: 'order.cancelled',

  CANCEL_REQUEST_CREATED: 'cancel_request.created',
  CANCEL_REQUEST_REVIEWED: 'cancel_request.reviewed',

  QR_SCANNED: 'dining.qr_scanned',
  SESSION_VERIFIED: 'dining.session_verified',
  SESSION_CLOSED: 'dining.session_closed',
  SESSION_REOPENED: 'dining.session_reopened',
  SESSIONS_MERGED: 'dining.sessions_merged',
  SESSIONS_SPLIT: 'dining.sessions_split',
  WAITER_CALLED: 'dining.waiter_called',
  WAITER_CALL_ACKED: 'dining.waiter_call_acked',
  BILL_REQUESTED: 'dining.bill_requested',

  INVOICE_BUILT: 'billing.invoice_built',
  INVOICE_ADJUSTED: 'billing.invoice_adjusted',
  INVOICE_SPLIT: 'billing.invoice_split',
  INVOICE_VOIDED: 'billing.invoice_voided',
  PAYMENT_INITIATED: 'billing.payment_initiated',
  PAYMENT_PARTIAL: 'billing.payment_partial',
  PAYMENT_COMPLETED: 'billing.payment_completed',
  PAYMENT_FAILED: 'billing.payment_failed',

  CATALOG_ITEM_CREATED: 'catalog.item_created',
  CATALOG_ITEM_UPDATED: 'catalog.item_updated',
  CATALOG_ITEM_DELETED: 'catalog.item_deleted',
  CATALOG_ITEM_AVAILABILITY_TOGGLED: 'catalog.item_availability_toggled',

  USER_MANAGED: 'identity.user_managed',
} as const

export type RTEvent = (typeof RT_EVENT)[keyof typeof RT_EVENT]

export const RT_PREFIX = {
  ORDERING: 'ordering.',
  ORDER: 'order.',
  CANCEL_REQUEST: 'cancel_request.',
  DINING: 'dining.',
  BILLING: 'billing.',
  CATALOG: 'catalog.',
  IDENTITY: 'identity.',
} as const
