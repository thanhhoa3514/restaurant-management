import { useMutation, useQueryClient } from '@tanstack/react-query'
import { manageStaffUser, staffQueryKeys } from '@/features/admin/api'

export function useManageStaffMutation(onSuccess?: () => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: manageStaffUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffQueryKeys.users })
      onSuccess?.()
    },
  })
}
