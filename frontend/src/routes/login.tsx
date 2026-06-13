import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { LoginPage } from '@/pages/login'

const searchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/login')({
  validateSearch: (search) => searchSchema.parse(search),
  component: LoginPage,
})
