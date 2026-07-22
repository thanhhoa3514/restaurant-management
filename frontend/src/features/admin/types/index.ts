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

export interface StaffUserDTO {
  id: string
  username: string
  full_name: string
  email?: string
  phone?: string
  role: string
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED'
  last_login_at?: string
  created_at: string
}

export interface RoleDTO {
  name: string
  display_name: string
}

export type ManageUserAction = 'create' | 'update' | 'set_status' | 'reset_password'

export interface ManageUserRequest {
  action: ManageUserAction
  user_id?: string
  username?: string
  full_name?: string
  email?: string
  phone?: string
  role?: string
  password?: string
  status?: 'ACTIVE' | 'INACTIVE'
}

export interface ManageUserResult {
  id: string
  action: ManageUserAction
  status: string
}
