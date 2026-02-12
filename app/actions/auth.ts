'use server';

import { prisma } from '@/src/lib/db/client';
import { createSupabaseServerClient } from '@/src/lib/supabase/server';
import { redirect } from 'next/navigation';
import { z } from 'zod';

/**
 * Auth Server Actions
 *
 * These actions handle user authentication via Supabase Auth.
 * - signUp: Register new user with email/password (sends confirmation email)
 * - signIn: Sign in existing user
 * - signOut: Sign out current user
 */

const signUpSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(6, 'Passwort muss mindestens 6 Zeichen lang sein'),
  name: z.string().min(1, 'Name ist erforderlich'),
});

const signInSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(1, 'Passwort ist erforderlich'),
});

export type AuthActionResult =
  | { success: true; message: string }
  | { success: false; error: string };

/**
 * Sign up a new user
 *
 * Creates a Supabase auth user and corresponding app user in the database.
 * Sends a confirmation email that the user must click before they can sign in.
 */
export async function signUp(formData: FormData): Promise<AuthActionResult> {
  try {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const name = formData.get('name') as string;

    // Validate input
    const validation = signUpSchema.safeParse({ email, password, name });
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0].message,
      };
    }

    const supabase = await createSupabaseServerClient();

    // Create Supabase user (sends confirmation email)
    const { data, error } = await supabase.auth.signUp({
      email: validation.data.email,
      password: validation.data.password,
      options: {
        data: { name: validation.data.name },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`,
      },
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    // Upsert Prisma User so Supabase auth and app DB stay in sync (e.g. after account recreation)
    if (data.user) {
      const rawName =
        typeof data.user.user_metadata?.name === 'string'
          ? data.user.user_metadata.name.trim()
          : undefined;
      const metadataName = rawName && rawName.length > 0 ? rawName : undefined;

      await prisma.user.upsert({
        where: { email: data.user.email! },
        update: {
          supabaseUserId: data.user.id,
          ...(metadataName
            ? { name: metadataName }
            : { name: validation.data.name }),
        },
        create: {
          email: data.user.email!,
          name: metadataName ?? validation.data.name,
          supabaseUserId: data.user.id,
        },
      });
    }

    return {
      success: true,
      message:
        'Registrierung erfolgreich! Bitte bestätigen Sie Ihre E-Mail-Adresse, um sich einzuloggen.',
    };
  } catch (error) {
    console.error('Sign up error:', error);
    return {
      success: false,
      error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
    };
  }
}

/**
 * Sign in an existing user
 *
 * Validates email confirmation before allowing sign in.
 */
export async function signIn(
  formData: FormData
): Promise<AuthActionResult | never> {
  try {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    // Validate input
    const validation = signInSchema.safeParse({ email, password });
    if (!validation.success) {
      return {
        success: false,
        error: validation.error.issues[0].message,
      };
    }

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: validation.data.email,
      password: validation.data.password,
    });

    if (error) {
      // Specific error message for unconfirmed email
      if (error.message.includes('Email not confirmed')) {
        return {
          success: false,
          error: 'Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.',
        };
      }
      return {
        success: false,
        error: 'Ungültige E-Mail-Adresse oder Passwort.',
      };
    }

    // Upsert Prisma User so Supabase auth and app DB stay in sync (avoids redirect loop when record was missing or stale after account recreation)
    const { data: userData } = await supabase.auth.getUser();

    if (userData.user && userData.user.email) {
      const rawName =
        typeof userData.user.user_metadata?.name === 'string'
          ? userData.user.user_metadata.name.trim()
          : undefined;
      const metadataName = rawName && rawName.length > 0 ? rawName : undefined;
      const displayName =
        metadataName ?? userData.user.email.split('@')[0] ?? 'User';

      await prisma.user.upsert({
        where: { email: userData.user.email },
        update: {
          supabaseUserId: userData.user.id,
          ...(metadataName ? { name: metadataName } : {}),
        },
        create: {
          email: userData.user.email,
          name: displayName,
          supabaseUserId: userData.user.id,
        },
      });
    }

    // Redirect to dashboard on success
    redirect('/dashboard');
  } catch (error) {
    // redirect() throws, so we need to catch and rethrow
    if ((error as Error).message === 'NEXT_REDIRECT') {
      throw error;
    }
    console.error('Sign in error:', error);
    return {
      success: false,
      error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
    };
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<never> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}

/**
 * Request password reset email
 */
export async function requestPasswordReset(
  formData: FormData
): Promise<AuthActionResult> {
  try {
    const email = formData.get('email') as string;

    if (!email || !z.string().email().safeParse(email).success) {
      return {
        success: false,
        error: 'Ungültige E-Mail-Adresse',
      };
    }

    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback?type=recovery`,
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      message:
        'Wenn ein Konto mit dieser E-Mail-Adresse existiert, wurde eine E-Mail zum Zurücksetzen des Passworts gesendet.',
    };
  } catch (error) {
    console.error('Password reset error:', error);
    return {
      success: false,
      error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
    };
  }
}
