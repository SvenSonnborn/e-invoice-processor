import {
  Award,
  Building2,
  FileCheck,
  Globe,
  LockKeyhole,
  Server,
  Shield,
  Unlock,
  Users,
} from 'lucide-react';

type TrustPoint = {
  icon: React.ReactNode;
  title: string;
  description: string;
};

const trustPoints: TrustPoint[] = [
  {
    icon: <Users className="h-6 w-6" />,
    title: 'Built for small teams',
    description:
      'Designed specifically for freelancers, small businesses, and tax advisors who need simple compliance tools without ERP overhead.',
  },
  {
    icon: <Unlock className="h-6 w-6" />,
    title: 'No lock-in. Ever.',
    description:
      'Export your data anytime in open formats. We integrate with your existing workflow without forcing you into a closed ecosystem.',
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: 'Laser-focused on compliance',
    description:
      'We do one thing extremely well: convert your invoices to compliant e-invoice formats. No feature bloat. No distractions.',
  },
];

const complianceItems = [
  {
    icon: <FileCheck className="h-5 w-5" />,
    label: 'EN 16931 compliant',
  },
  {
    icon: <Award className="h-5 w-5" />,
    label: 'ZUGFeRD certified',
  },
  {
    icon: <Globe className="h-5 w-5" />,
    label: 'XRechnung ready',
  },
  {
    icon: <LockKeyhole className="h-5 w-5" />,
    label: 'GDPR compliant',
  },
  {
    icon: <Server className="h-5 w-5" />,
    label: 'EU data hosting',
  },
  {
    icon: <Building2 className="h-5 w-5" />,
    label: 'German company',
  },
];

const stats = [
  { value: '10,000+', label: 'Invoices processed' },
  { value: '99.9%', label: 'Uptime' },
  { value: '<10s', label: 'Processing time' },
  { value: '100%', label: 'Compliance rate' },
];

export const TrustSection = () => {
  return (
    <section className="relative overflow-hidden bg-white py-20 md:py-28">
      <div className="mx-auto max-w-[1200px] px-4 md:px-6">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
            <Shield className="h-4 w-4" />
            Why trust us
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-900 md:text-4xl lg:text-[2.75rem]">
            The missing link between{' '}
            <span className="bg-gradient-to-r from-brand-600 to-brand-500 bg-clip-text text-transparent">
              invoice receipt
            </span>{' '}
            and accounting software
          </h2>
        </div>

        {/* Stats bar */}
        <div className="mt-12 flex justify-center">
          <div className="grid w-full max-w-4xl grid-cols-2 gap-4 md:grid-cols-4 md:gap-0 md:divide-x md:divide-neutral-200">
            {stats.map((stat) => (
              <div key={stat.label} className="px-6 py-4 text-center">
                <p className="text-3xl font-bold text-brand-600">{stat.value}</p>
                <p className="mt-1 text-sm text-neutral-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Trust points */}
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {trustPoints.map((point, index) => (
            <div
              key={index}
              className="group rounded-2xl border border-neutral-200 bg-white p-8 text-center transition-all hover:border-brand-200 hover:shadow-lg"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-100">
                {point.icon}
              </div>
              <h3 className="mt-6 text-xl font-semibold text-neutral-900">
                {point.title}
              </h3>
              <p className="mt-3 leading-relaxed text-neutral-600">
                {point.description}
              </p>
            </div>
          ))}
        </div>

        {/* Compliance badges */}
        <div className="mt-16">
          <p className="mb-6 text-center text-sm font-medium uppercase tracking-wider text-neutral-500">
            Compliance & Security
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {complianceItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2"
              >
                <span className="text-brand-600">{item.icon}</span>
                <span className="text-sm font-medium text-neutral-700">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quote/testimonial placeholder */}
        <div className="mt-20">
          <div className="mx-auto max-w-3xl rounded-2xl border border-neutral-200 bg-gradient-to-br from-neutral-50 to-white p-8 md:p-12">
            <div className="text-center">
              <div className="mb-6 inline-flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    className="h-5 w-5 text-warning"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <blockquote className="text-xl font-medium text-neutral-900 md:text-2xl">
                &ldquo;Finally, a tool that does exactly what it promises.
                Simple, fast, and reliable. Our invoice processing time dropped
                by 80%.&rdquo;
              </blockquote>
              <div className="mt-6">
                <p className="font-semibold text-neutral-900">Sarah M.</p>
                <p className="text-sm text-neutral-500">
                  Freelance Tax Advisor, Munich
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
