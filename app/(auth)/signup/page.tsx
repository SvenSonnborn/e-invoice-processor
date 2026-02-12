'use client';

import { signUp } from '@/app/actions/auth';
import { Button } from '@/src/components/ui/button';
import { Checkbox } from '@/src/components/ui/checkbox';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Separator } from '@/src/components/ui/separator';
import { User, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function SignUpPage() {
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(formData: FormData) {
    const res = await signUp(formData);
    if (res.success) {
      setResult({ success: true, message: res.message });
    } else {
      setResult({ success: false, message: res.error });
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          Konto erstellen
        </h1>
        <p className="text-sm text-muted-foreground">
          Erstellen Sie ein kostenloses Konto
        </p>
      </div>

      {/* Result message */}
      {result && (
        <div
          className={`rounded-lg border p-4 ${
            result.success
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <p
            className={`text-sm ${
              result.success ? 'text-green-800' : 'text-red-800'
            }`}
          >
            {result.message}
          </p>
        </div>
      )}

      {/* Form */}
      <form className="space-y-3" action={handleSubmit}>
        {/* Name field */}
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              placeholder="Max Mustermann"
              className="pl-10"
            />
          </div>
        </div>

        {/* Email field */}
        <div className="space-y-2">
          <Label htmlFor="email">E-Mail</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="name@beispiel.de"
              className="pl-10"
            />
          </div>
        </div>

        {/* Password field */}
        <div className="space-y-2">
          <Label htmlFor="password">Passwort</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={6}
              placeholder="Mindestens 6 Zeichen"
              className="pl-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={
                showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'
              }
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Terms checkbox */}
        <div className="flex items-start space-x-2">
          <Checkbox id="terms" name="terms" required className="mt-1" />
          <div className="grid gap-1 leading-none">
            <Label
              htmlFor="terms"
              className="text-sm font-medium leading-none cursor-pointer"
            >
              Nutzungsbedingungen akzeptieren
            </Label>
            <p className="text-xs text-muted-foreground">
              Ich stimme den{' '}
              <Link href="/terms" className="text-primary hover:underline">
                Nutzungsbedingungen
              </Link>{' '}
              und{' '}
              <Link href="/privacy" className="text-primary hover:underline">
                Datenschutzrichtlinien
              </Link>{' '}
              zu.
            </p>
          </div>
        </div>

        {/* Submit button */}
        <Button type="submit" className="w-full mt-1">
          Registrieren
        </Button>
      </form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-muted-foreground">Oder</span>
        </div>
      </div>

      {/* Login link */}
      <p className="text-center text-sm text-muted-foreground">
        Bereits ein Konto?{' '}
        <Link
          href="/login"
          className="font-medium text-primary hover:underline"
        >
          Jetzt anmelden
        </Link>
      </p>

      {/* Social logins */}
      <div className="grid gap-2">
        <Button variant="outline" type="button" size="sm" className="w-full">
          <GoogleIcon />
          Mit Google registrieren
        </Button>
        <Button
          type="button"
          size="sm"
          className="w-full bg-[#1877F2] hover:bg-[#166FE5] text-white"
        >
          <FacebookIcon />
          Mit Facebook registrieren
        </Button>
        <Button
          type="button"
          size="sm"
          className="w-full bg-black hover:bg-gray-800 text-white"
        >
          <AppleIcon />
          Mit Apple registrieren
        </Button>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}
