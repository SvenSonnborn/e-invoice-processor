import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            E-Rechnung Test Navigation
          </h1>
          <p className="text-gray-600 mb-8">
            Testen Sie alle Bereiche der Anwendung
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Marketing Bereich */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="bg-purple-100 text-purple-600 rounded-full w-8 h-8 flex items-center justify-center mr-3 text-sm">
                  M
                </span>
                Marketing
              </h2>
              <div className="space-y-3">
                <Link
                  href="/pricing"
                  className="block w-full px-4 py-2 text-left bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-md transition-colors"
                >
                  → Pricing
                </Link>
              </div>
            </div>

            {/* Auth Bereich */}
            <div className="border border-gray-200 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="bg-green-100 text-green-600 rounded-full w-8 h-8 flex items-center justify-center mr-3 text-sm">
                  A
                </span>
                Authentifizierung
              </h2>
              <div className="space-y-3">
                <Link
                  href="/login"
                  className="block w-full px-4 py-2 text-left bg-green-50 hover:bg-green-100 text-green-700 rounded-md transition-colors"
                >
                  → Login
                </Link>
                <Link
                  href="/signup"
                  className="block w-full px-4 py-2 text-left bg-green-50 hover:bg-green-100 text-green-700 rounded-md transition-colors"
                >
                  → Signup / Registrierung
                </Link>
                <Link
                  href="/onboarding"
                  className="block w-full px-4 py-2 text-left bg-green-50 hover:bg-green-100 text-green-700 rounded-md transition-colors"
                >
                  → Onboarding
                </Link>
              </div>
            </div>

            {/* App Bereich */}
            <div className="border border-gray-200 rounded-lg p-6 md:col-span-2">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <span className="bg-blue-100 text-blue-600 rounded-full w-8 h-8 flex items-center justify-center mr-3 text-sm">
                  App
                </span>
                Hauptanwendung (erfordert Login)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Link
                  href="/dashboard"
                  className="block px-4 py-3 text-left bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md transition-colors font-medium"
                >
                  → Dashboard
                </Link>
                <Link
                  href="/invoices"
                  className="block px-4 py-3 text-left bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md transition-colors"
                >
                  → Rechnungen (Invoices)
                </Link>
                <Link
                  href="/exports"
                  className="block px-4 py-3 text-left bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md transition-colors"
                >
                  → Exporte
                </Link>
                <Link
                  href="/settings"
                  className="block px-4 py-3 text-left bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md transition-colors"
                >
                  → Einstellungen (Settings)
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Hinweis:</strong> Die App-Bereiche (Dashboard, Invoices, Exports, Settings)
              erfordern eine Authentifizierung. Sie werden automatisch zum Login weitergeleitet,
              wenn Sie nicht angemeldet sind.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
