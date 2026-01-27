import { createSupabaseServerClient } from '@/src/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Auth Callback Route
 *
 * Handles OAuth callbacks and email confirmations from Supabase Auth.
 * - Email confirmation: ?token=...&type=signup
 * - Password recovery: ?token=...&type=recovery
 * - OAuth: ?code=...
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token = searchParams.get('token')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    // OAuth callback
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('OAuth error:', error)
      return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`)
    }

    // Redirect to the specified next URL or dashboard
    return NextResponse.redirect(`${origin}${next}`)
  }

  if (token) {
    const supabase = await createSupabaseServerClient()

    if (type === 'recovery') {
      // Password recovery - redirect to reset password page
      return NextResponse.redirect(`${origin}/reset-password?token=${token}`)
    }

    if (type === 'signup' || type === 'email_confirmation') {
      // Email confirmation - verify the token
      const { error } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'email',
      })

      if (error) {
        console.error('Email confirmation error:', error)
        return NextResponse.redirect(
          `${origin}/login?error=${encodeURIComponent('E-Mail-Bestätigung fehlgeschlagen')}`
        )
      }

      // Success - redirect to onboarding or dashboard
      return NextResponse.redirect(`${origin}/onboarding`)
    }
  }

  // No valid code or token - redirect to login
  return NextResponse.redirect(`${origin}/login`)
}
