import { Button } from '@/src/components/ui/button';
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Play,
  Upload,
} from 'lucide-react';
import Link from 'next/link';

type Step = {
  number: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  details: string[];
};

const steps: Step[] = [
  {
    number: '01',
    icon: <Upload className="h-6 w-6" />,
    title: 'Upload your invoice',
    description:
      'Drag and drop your PDF invoice or scanned document into the upload area.',
    details: ['PDF, JPG, PNG supported', 'Up to 10MB per file', 'Batch upload'],
  },
  {
    number: '02',
    icon: <Eye className="h-6 w-6" />,
    title: 'Review extracted data',
    description:
      'Our system extracts all invoice fields automatically. Review and correct if needed.',
    details: [
      'OCR-powered extraction',
      'Smart field detection',
      'Easy corrections',
    ],
  },
  {
    number: '03',
    icon: <Download className="h-6 w-6" />,
    title: 'Export compliant files',
    description:
      'Download your ZUGFeRD or XRechnung file, or export structured data as CSV.',
    details: ['ZUGFeRD 2.1.1', 'XRechnung 3.0', 'CSV export'],
  },
];

export const HowItWorksSection = () => {
  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden bg-neutral-50 py-20 md:py-28"
    >
      <div className="mx-auto max-w-[1200px] px-4 md:px-6">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
            <Play className="h-4 w-4" />
            How it works
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl lg:text-[2.75rem]">
            Three steps to{' '}
            <span className="bg-gradient-to-r from-brand-600 to-brand-500 bg-clip-text text-transparent">
              compliant invoices
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600">
            No training required. No complex setup. Just upload and go.
          </p>
        </div>

        {/* Steps grid */}
        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              {/* Connector line - desktop only */}
              {index < steps.length - 1 && (
                <div
                  className="absolute -right-4 top-14 hidden h-0.5 w-8 bg-gradient-to-r from-brand-200 to-transparent lg:block"
                  aria-hidden="true"
                />
              )}

              <div className="group h-full rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm transition-all hover:border-brand-200 hover:shadow-md">
                {/* Step number + icon */}
                <div className="mb-6 flex items-start justify-between">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-100">
                    {step.icon}
                  </div>
                  <span className="text-4xl font-bold text-neutral-100 transition-colors group-hover:text-brand-100">
                    {step.number}
                  </span>
                </div>

                {/* Content */}
                <h3 className="text-xl font-semibold text-neutral-900">
                  {step.title}
                </h3>
                <p className="mt-3 text-neutral-600">{step.description}</p>

                {/* Details */}
                <ul className="mt-6 space-y-2">
                  {step.details.map((detail) => (
                    <li
                      key={detail}
                      className="flex items-center gap-2 text-sm text-neutral-600"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Result card */}
        <div className="mt-16">
          <div className="mx-auto max-w-3xl rounded-2xl border border-success/20 bg-gradient-to-br from-success-bg/50 to-white p-8 md:p-12">
            <div className="flex flex-col items-center text-center md:flex-row md:text-left">
              <div className="mb-6 flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-success/10 md:mb-0 md:mr-8">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-neutral-900 md:text-2xl">
                  Done! Your invoice is compliant.
                </h3>
                <p className="mt-2 text-neutral-600">
                  Your e-invoice is now ready for your accounting system. No
                  manual data entry. No compliance worries.
                </p>
              </div>
              <div className="mt-6 md:ml-8 md:mt-0">
                <Button size="lg" asChild>
                  <Link href="/signup">
                    Try it now
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Demo preview placeholder */}
        <div className="mt-16 flex justify-center">
          <div className="w-full max-w-4xl">
            <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-neutral-300" />
                  <div className="h-3 w-3 rounded-full bg-neutral-300" />
                  <div className="h-3 w-3 rounded-full bg-neutral-300" />
                </div>
                <div className="ml-4 flex-1 rounded-md bg-neutral-200 px-3 py-1.5 text-xs text-neutral-500">
                  app.e-invoice-hub.de/upload
                </div>
              </div>

              {/* Content area - upload mockup */}
              <div className="p-8">
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-neutral-200 bg-neutral-50 p-12 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50">
                    <FileText className="h-8 w-8 text-brand-600" />
                  </div>
                  <p className="text-lg font-medium text-neutral-900">
                    Drop your invoice here
                  </p>
                  <p className="mt-1 text-sm text-neutral-500">
                    PDF, JPG, or PNG up to 10MB
                  </p>
                  <Button variant="outline" className="mt-4">
                    Browse files
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
