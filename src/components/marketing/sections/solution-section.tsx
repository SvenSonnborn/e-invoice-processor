import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileSearch,
  RefreshCw,
  Sparkles,
  Upload,
} from 'lucide-react';

type Step = {
  icon: React.ReactNode;
  number: number;
  title: string;
  description: string;
};

const steps: Step[] = [
  {
    icon: <Upload className="h-5 w-5" />,
    number: 1,
    title: 'Upload invoice',
    description: 'Drag & drop your PDF or scanned invoice.',
  },
  {
    icon: <FileSearch className="h-5 w-5" />,
    number: 2,
    title: 'Extract data',
    description: 'OCR and parsing extract all relevant fields.',
  },
  {
    icon: <RefreshCw className="h-5 w-5" />,
    number: 3,
    title: 'Convert format',
    description: 'Generate ZUGFeRD or XRechnung output.',
  },
  {
    icon: <Download className="h-5 w-5" />,
    number: 4,
    title: 'Export',
    description: 'Download CSV, XML, or integrate directly.',
  },
];

export const SolutionSection = () => {
  return (
    <section className="relative overflow-hidden bg-white py-20 md:py-28">
      {/* Subtle gradient */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-neutral-50/50 to-white"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-[1200px] px-4 md:px-6">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-success/10 px-4 py-1.5 text-sm font-medium text-success">
            <Sparkles className="h-4 w-4" />
            The solution
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl lg:text-[2.75rem]">
            A simple workflow that{' '}
            <span className="bg-gradient-to-r from-brand-600 to-brand-500 bg-clip-text text-transparent">
              just works
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600">
            A lightweight layer between invoice receipt and accounting software.
            No ERP complexity. No learning curve.
          </p>
        </div>

        {/* Process flow - Desktop */}
        <div className="mt-16 hidden lg:block">
          <div className="relative">
            {/* Connecting line */}
            <div className="absolute left-0 right-0 top-10 flex items-center justify-between px-[120px]">
              <div className="flex-1 border-t-2 border-dashed border-neutral-200" />
            </div>

            {/* Steps */}
            <div className="relative grid grid-cols-4 gap-6">
              {steps.map((step, index) => (
                <div key={step.number} className="relative">
                  {/* Arrow between steps */}
                  {index < steps.length - 1 && (
                    <div className="absolute -right-3 top-10 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-white">
                      <ArrowRight className="h-4 w-4 text-brand-400" />
                    </div>
                  )}

                  <div className="flex flex-col items-center text-center">
                    {/* Number badge + Icon */}
                    <div className="relative">
                      <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-neutral-200 bg-white shadow-sm transition-all hover:border-brand-200 hover:shadow-md">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                          {step.icon}
                        </div>
                      </div>
                      <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                        {step.number}
                      </div>
                    </div>

                    {/* Content */}
                    <h3 className="mt-5 text-base font-semibold text-neutral-900">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Process flow - Mobile/Tablet */}
        <div className="mt-12 lg:hidden">
          <div className="space-y-6">
            {steps.map((step, index) => (
              <div key={step.number} className="flex gap-4">
                {/* Left: Icon + line */}
                <div className="flex flex-col items-center">
                  <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white shadow-sm">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                      {step.icon}
                    </div>
                    <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                      {step.number}
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="mt-2 h-full w-0.5 bg-neutral-200" />
                  )}
                </div>

                {/* Right: Content */}
                <div className="pb-6">
                  <h3 className="text-base font-semibold text-neutral-900">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-sm text-neutral-600">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Result indicator */}
        <div className="mt-12 flex justify-center lg:mt-16">
          <div className="inline-flex items-center gap-3 rounded-full border border-success/20 bg-success-bg/50 px-6 py-3">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <span className="text-sm font-medium text-neutral-700">
              Compliant e-invoice in{' '}
              <span className="text-success">under 10 seconds</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
