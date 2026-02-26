import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { toNextJsHandler } from 'better-auth/next-js'
import { checkRateLimit } from '@/lib/rate-limit'

const handler = toNextJsHandler(auth)

export const GET = handler.GET

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!checkRateLimit(`auth:${ip}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json(
      { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
      { status: 429 }
    )
  }
  return handler.POST(request)
}
