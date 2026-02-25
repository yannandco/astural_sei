import { redirect } from 'next/navigation'
import { validateRequest } from '@/lib/auth/server'

export default async function Home() {
  const { user } = await validateRequest()

  if (!user) {
    redirect('/login')
  }

  if (user.role === 'collaborateur' || user.role === 'remplacant') {
    redirect('/portail')
  }

  redirect('/collaborateurs')
}
