'use client'

import { signUp } from '@/app/actions/auth'
import Link from 'next/link'
import { useState } from 'react'

export default function SignUpPage() {
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  async function handleSubmit(formData: FormData) {
    const res = await signUp(formData)
    if (res.success) {
      setResult({ success: true, message: res.message })
    } else {
      setResult({ success: false, message: res.error })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Konto erstellen
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Bereits ein Konto?{' '}
            <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              Jetzt anmelden
            </Link>
          </p>
        </div>

        {result && (
          <div
            className={`rounded-md p-4 ${
              result.success ? 'bg-green-50' : 'bg-red-50'
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

        <form className="mt-8 space-y-6" action={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-2">
            <div>
              <label htmlFor="name" className="sr-only">
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Vollständiger Name"
              />
            </div>
            <div>
              <label htmlFor="email" className="sr-only">
                E-Mail-Adresse
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="E-Mail-Adresse"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Passwort
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Passwort (min. 6 Zeichen)"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Registrieren
            </button>
          </div>

          <p className="text-xs text-gray-500 text-center">
            Durch die Registrierung stimmen Sie unseren{' '}
            <Link href="/terms" className="underline">
              Nutzungsbedingungen
            </Link>{' '}
            und{' '}
            <Link href="/privacy" className="underline">
              Datenschutzrichtlinien
            </Link>{' '}
            zu.
          </p>
        </form>
      </div>
    </div>
  )
}
