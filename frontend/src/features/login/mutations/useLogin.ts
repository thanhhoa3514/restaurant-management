import { useMutation } from '@tanstack/react-query'
import { loginStaff } from '@/lib/auth'

interface LoginInput {
  username: string
  password: string
}

export function useLogin() {
  return useMutation({
    mutationFn: async ({ username, password }: LoginInput) => {
      const session = await loginStaff(username, password)
      if (!session) throw new Error('Tài khoản hoặc mật khẩu không chính xác!')
      return session
    },
  })
}
