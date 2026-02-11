import { Metadata } from 'next';
import { getCurrentUser } from '@/src/lib/auth/session';
import { Pricing } from '@/src/components/marketing/pricing';
import { Button } from '@/src/components/ui/button';
import { ArrowLeft, HelpCircle, Shield } from 'lucide-react';
import Link from 'next/link';
import type { PlanId } from '@/src/lib/stripe/config';

export const metadata: Metadata = {
  title: 'Preise | E-Invoice Hub',
  description: 'Wählen Sie den passenden Plan für Ihr Unternehmen. Starten Sie kostenlos mit einer 14-tägigen Testphase.',
};

const faqs = [
  {
    question: 'Kann ich später den Plan wechseln?',
    answer: 'Ja, Sie können jederzeit upgraden oder downgraden. Änderungen werden sofort wirksam.',
  },
  {
    question: 'Was passiert nach der Testphase?',
    answer: 'Nach 14 Tagen wird Ihre Zahlungsmethode belastet, sofern Sie nicht vorher kündigen.',
  },
  {
    question: 'Gibt es eine Mindestlaufzeit?',
    answer: 'Nein, Sie können monatlich kündigen. Es gibt keine versteckten Gebühren oder Mindestlaufzeiten.',
  },
  {
    question: 'Wie kann ich kündigen?',
    answer: 'Sie können Ihr Abonnement jederzeit in den Einstellungen oder über das Stripe-Kundenportal kündigen.',
  },
];

export default async function PricingPage() {
  const user = await getCurrentUser();

  const currentPlan = user?.subscriptionTier !== 'FREE'
    ? (user?.subscriptionTier as PlanId | undefined)
    : undefined;

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="border-b bg-white">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Zurück
            </Button>
          </Link>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" />
            SSL-gesicherte Zahlung
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        {/* Hero */}
        <div className="mb-16 text-center">
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-neutral-900 md:text-5xl">
            Einfache, transparente{' '}
            <span className="text-primary">Preise</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Wählen Sie den passenden Plan für Ihr Unternehmen. 
            Alle Pläne beinhalten eine 14-tägige kostenlose Testphase.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="mx-auto max-w-4xl">
          <Pricing 
            currentPlan={currentPlan} 
            isAuthenticated={!!user} 
          />
        </div>

        {/* Trust Badges */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <span>SSL-verschlüsselt</span>
          </div>
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            <span>14 Tage kostenlos testen</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <span>Jederzeit kündbar</span>
          </div>
        </div>

        {/* FAQs */}
        <div className="mx-auto mt-20 max-w-3xl">
          <h2 className="mb-8 text-center text-2xl font-bold">
            Häufig gestellte Fragen
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {faqs.map((faq) => (
              <div
                key={faq.question}
                className="rounded-lg border bg-white p-6"
              >
                <h3 className="mb-2 font-semibold">{faq.question}</h3>
                <p className="text-sm text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Support CTA */}
        <div className="mt-16 text-center">
          <p className="text-muted-foreground">
            Noch Fragen?{' '}
            <Link href="/contact" className="text-primary hover:underline">
              Kontaktieren Sie uns
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
