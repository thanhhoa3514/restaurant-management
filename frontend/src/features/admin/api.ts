import { apiRequest } from '@/lib/api'

export interface AdminDashboardDTO {
  revenue: {
    value: string
    sub: string
  }
  tables: {
    value: string
    sub: string
  }
  kitchen: {
    value: string
    sub: string
  }
  payments: {
    value: string
    sub: string
  }
  staffs: {
    name: string
    code: string
    role: string
    tone: 'green' | 'blue' | 'orange' | 'purple'
    time: string
  }[]
}

export function fetchAdminDashboard(): Promise<AdminDashboardDTO> {
  // Hit the backend mock endpoint for now until real aggregation is implemented
  return apiRequest<AdminDashboardDTO>('/api/v1/identity/dashboard')
}
