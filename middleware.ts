import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('better-auth.session_token')
    || request.cookies.get('__Secure-better-auth.session_token')

  if (!sessionCookie) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/((?!auth|whatsapp/webhook).*)',
    '/((?:collaborateurs|remplacants|etablissements|ecoles|directeurs|titulaires|planning|parametres|documentation|portail).*)',
  ],
}
