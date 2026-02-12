import {
  ArrowRight,
  Boxes,
  Download,
  FileCheck,
  FileCode2,
  ScanLine,
  ShieldCheck,
  Upload,
  Zap,
} from 'lucide-react';

type Feature = {
  icon: React.ReactNode;
  title: string;
  description: string;
  highlight?: boolean;
};

const features: Feature[] = [
  {
    icon: <Upload className="h-6 w-6" />,
    title: 'Multi-source Upload',
    description:
      'PDF, scanned documents, or photos. Drag & drop or click to upload from any device.',
  },
  {
    icon: <ScanLine className="h-6 w-6" />,
    title: 'Smart Data Extraction',
    description:
      'Advanced OCR and intelligent field parsing automatically extract invoice data with high accuracy.',
  },
  {
    icon: <FileCheck className="h-6 w-6" />,
    title: 'E-Invoice Conversion',
    description:
      'Generate ZUGFeRD 2.1.1 and XRechnung 3.0 compliant files that meet EN 16931 standards.',
    highlight: true,
  },
  {
    icon: <ShieldCheck className="h-6 w-6" />,
    title: 'Automatic Validation',
    description:
      'Real-time validation ensures all required fields are present and correctly formatted.',
  },
  {
    icon: <Download className="h-6 w-6" />,
    title: 'Flexible Export',
    description:
      'Download as XML, CSV, or structured JSON. Ready for any accounting system.',
  },
  {
    icon: <Boxes className="h-6 w-6" />,
    title: 'Batch Processing',
    description:
      'Process multiple invoices at once. Perfect for month-end invoice handling.',
  },
];

const highlights = [
  {
    icon: <Zap className="h-5 w-5" />,
    label: 'Fast processing',
    value: '< 10 sec',
  },
  {
    icon: <FileCode2 className="h-5 w-5" />,
    label: 'Formats supported',
    value: 'ZUGFeRD, XRechnung',
  },
  {
    icon: <ShieldCheck className="h-5 w-5" />,
    label: 'Compliance',
    value: 'EN 16931',
  },
];

export const FeaturesSection = () => {
  return (
    <section
      id="features"
      className="relative overflow-hidden bg-white py-20 md:py-28"
    >
      {/* Background gradient */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-white via-brand-50/30 to-white"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-[1200px] px-4 md:px-6">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
            <Boxes className="h-4 w-4" />
            Features
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl lg:text-[2.75rem]">
            Everything you need for{' '}
            <span className="bg-gradient-to-r from-brand-600 to-brand-500 bg-clip-text text-transparent">
              e-invoice compliance
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600">
            Simple, focused features without ERP complexity. Built specifically
            for freelancers and small businesses.
          </p>
        </div>

        {/* Highlights bar */}
        <div className="mt-12 flex justify-center">
          <div className="inline-flex flex-wrap justify-center gap-4 rounded-2xl border border-neutral-200 bg-white px-2 py-2 shadow-sm md:gap-0 md:divide-x md:divide-neutral-200 md:px-0">
            {highlights.map((highlight) => (
              <div
                key={highlight.label}
                className="flex items-center gap-3 px-6 py-2"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  {highlight.icon}
                </div>
                <div>
                  <p className="text-xs text-neutral-500">{highlight.label}</p>
                  <p className="text-sm font-semibold text-neutral-900">
                    {highlight.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Features grid */}
        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <div
              key={index}
              className={`group relative overflow-hidden rounded-2xl border p-8 transition-all hover:shadow-lg ${
                feature.highlight
                  ? 'border-brand-200 bg-gradient-to-br from-brand-50 to-white hover:border-brand-300'
                  : 'border-neutral-200 bg-white hover:border-neutral-300'
              }`}
            >
              {/* Highlight badge */}
              {feature.highlight && (
                <div className="absolute right-4 top-4">
                  <span className="rounded-full bg-brand-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
                    Core
                  </span>
                </div>
              )}

              {/* Icon */}
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-xl transition-colors ${
                  feature.highlight
                    ? 'bg-brand-100 text-brand-600 group-hover:bg-brand-200'
                    : 'bg-neutral-100 text-neutral-600 group-hover:bg-brand-50 group-hover:text-brand-600'
                }`}
              >
                {feature.icon}
              </div>

              {/* Content */}
              <h3 className="mt-6 text-lg font-semibold text-neutral-900">
                {feature.title}
              </h3>
              <p className="mt-3 leading-relaxed text-neutral-600">
                {feature.description}
              </p>

              {/* Learn more link */}
              <div className="mt-6 flex items-center gap-1 text-sm font-medium text-brand-600 opacity-0 transition-opacity group-hover:opacity-100">
                <span>Learn more</span>
                <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <p className="text-neutral-600">
            Not finding what you need?{' '}
            <a
              href="#docs"
              className="font-medium text-brand-600 hover:text-brand-700"
            >
              Check our documentation
            </a>{' '}
            or{' '}
            <a
              href="mailto:support@e-invoice-hub.de"
              className="font-medium text-brand-600 hover:text-brand-700"
            >
              contact us
            </a>
          </p>
        </div>
      </div>
    </section>
  );
};
