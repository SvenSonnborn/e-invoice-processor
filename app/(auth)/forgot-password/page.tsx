'use client'

import { requestPasswordReset, type AuthActionResult } from '@/app/actions/auth'
import { Button } from '@/src/components/ui/button'
import { Input } from '@/src/components/ui/input'
import { Label } from '@/src/components/ui/label'
import { Separator } from '@/src/components/ui/separator'
import { Mail } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

export default function ForgotPasswordPage() {
  const [result, setResult] = useState<AuthActionResult | null>(null)

  async function handleSubmit(formData: FormData) {
    const response = await requestPasswordReset(formData)
    setResult(response)
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Passwort zurücksetzen</h1>
        <p className="text-sm text-muted-foreground">
          Wir senden Ihnen einen Link zum Zurücksetzen Ihres Passworts.
        </p>
      </div>

      {result && (
        <div
          className={`rounded-lg border p-4 ${
            result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}
        >
          <p className={`text-sm ${result.success ? 'text-green-800' : 'text-red-800'}`}>
            {'message' in result ? result.message : result.error}
          </p>
        </div>
      )}

      <form className="space-y-3" action={handleSubmit}>
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

        <Button type="submit" className="w-full">
          Link senden
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-muted-foreground">Zurück</span>
        </div>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Zurück zum{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Login
        </Link>{' '}
        oder{' '}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          neues Konto erstellen
        </Link>
        .
      </p>
    </div>
  )
}
