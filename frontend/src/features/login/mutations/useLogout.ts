import { useMutation } from '@tanstack/react-query'
import { logoutStaff } from '@/lib/auth'

export function useLogout() {
  return useMutation({
    mutationFn: logoutStaff,
  })
}
