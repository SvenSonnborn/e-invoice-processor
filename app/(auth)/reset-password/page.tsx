'use client';

import { updatePassword, type AuthActionResult } from '@/app/actions/auth';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Lock } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export default function ResetPasswordPage() {
  const [result, setResult] = useState<AuthActionResult | null>(null);

  async function handleSubmit(formData: FormData) {
    const response = await updatePassword(formData);
    setResult(response);
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          Neues Passwort setzen
        </h1>
        <p className="text-sm text-muted-foreground">
          Wählen Sie ein neues Passwort für Ihr Konto.
        </p>
      </div>

      {result && (
        <div
          className={`rounded-lg border p-4 ${
            result.success
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <p
            className={`text-sm ${result.success ? 'text-green-800' : 'text-red-800'}`}
          >
            {'message' in result ? result.message : result.error}
          </p>
        </div>
      )}

      <form className="space-y-3" action={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="password">Neues Passwort</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Mindestens 8 Zeichen"
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Passwort wiederholen"
              className="pl-10"
            />
          </div>
        </div>

        <Button type="submit" className="w-full">
          Passwort aktualisieren
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Zurück zum{' '}
        <Link
          href="/login"
          className="font-medium text-primary hover:underline"
        >
          Login
        </Link>
        .
      </p>
    </div>
  );
}
