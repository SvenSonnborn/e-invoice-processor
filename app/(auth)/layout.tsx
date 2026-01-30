'use client';

import Image from 'next/image';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 sm:p-6 lg:p-8">
      {/* Main Card */}
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex">
        {/* Left side - Form */}
        <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 lg:px-12 py-10 lg:py-12">
          <div className="w-full max-w-sm mx-auto">
            {/* Logo */}
            <div className="flex items-center gap-2 mb-8">
              <Image
                src="/assets/logo-clean.png"
                alt="E-Rechnung Logo"
                width={36}
                height={36}
                className="rounded-lg"
              />
              <span className="text-lg font-semibold text-foreground">
                E-Rechnung
              </span>
            </div>

            {children}

            {/* Footer */}
            <p className="mt-8 text-center text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} E-Rechnung. Alle Rechte
              vorbehalten.
            </p>
          </div>
        </div>

        {/* Right side - Marketing */}
        <div className="hidden lg:flex lg:w-[45%] bg-slate-50/80 items-center justify-center p-10">
          <div className="max-w-md text-center">
            <h1 className="text-3xl font-bold text-foreground mb-1">
              Digitale Rechnungen
            </h1>
            <h2 className="text-3xl font-bold mb-4">
              <span className="text-foreground">einfach mit </span>
              <span className="text-primary">E-Rechnung</span>
              <span className="text-foreground">!</span>
            </h2>
            <p className="text-sm text-muted-foreground mb-8">
              Verwalten Sie Ihre elektronischen Rechnungen sicher und effizient.
              Konform mit XRechnung und ZUGFeRD Standards.
            </p>

            {/* Illustration */}
            <div className="relative w-full max-w-xs mx-auto">
              <Image
                src="/assets/login.png"
                alt="Digitale Rechnungen einfach mit E-Rechnung"
                width={320}
                height={240}
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
