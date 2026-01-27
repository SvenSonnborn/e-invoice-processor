'use client'

import { createOrganization } from '@/app/actions/organizations'
import { useState } from 'react'

export default function OnboardingPage() {
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    const result = await createOrganization(formData)
    if ('error' in result) {
      setError(result.error)
    }
    // On success, the action will redirect
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Willkommen!
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Erstellen Sie Ihre erste Organisation, um loszulegen.
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <form className="mt-8 space-y-6" action={handleSubmit}>
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Organisationsname
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              minLength={3}
              className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="z.B. Ihre Firma GmbH"
            />
            <p className="mt-1 text-xs text-gray-500">
              Mindestens 3 Zeichen. Sie können später weitere Organisationen erstellen.
            </p>
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Organisation erstellen
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
