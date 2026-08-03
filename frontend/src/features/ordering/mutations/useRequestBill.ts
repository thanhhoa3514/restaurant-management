import { useMutation } from '@tanstack/react-query'
import { requestBill } from '../api'

export function useRequestBill() {
  return useMutation({
    mutationFn: (deviceAccessToken: string) => requestBill(deviceAccessToken),
  })
}
