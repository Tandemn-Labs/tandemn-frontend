import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function getRateLimitKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'anonymous'
  return ip
}

function checkRateLimit(key: string, limit: number = 60, windowMs: number = 60000): boolean {
  const now = Date.now()
  const userLimit = rateLimitMap.get(key)
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }
  
  if (userLimit.count >= limit) {
    return false
  }
  
  userLimit.count++
  return true
}

const isProtectedRoute = createRouteMatcher([
  '/chat(.*)',
  '/credits(.*)',
  '/settings(.*)',
  '/keys(.*)'
])

export default clerkMiddleware((auth, req) => {
  // Skip authentication for webhook endpoints
  if (req.nextUrl.pathname.startsWith('/api/stripe/webhook') || 
      req.nextUrl.pathname.startsWith('/api/webhooks/')) {
    return NextResponse.next()
  }

  // Apply rate limiting to API routes (relaxed for development/testing)
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const key = getRateLimitKey(req)
    // Increased limits for load testing: 1000 requests per minute
    const allowed = checkRateLimit(key, 1000, 60000)
    
    if (!allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      )
    }
  }

  // Protect specific routes
  if (isProtectedRoute(req)) {
    auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}