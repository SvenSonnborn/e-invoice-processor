import {
  AlertTriangle,
  Ban,
  Clock,
  Euro,
  FileWarning,
  TrendingDown,
} from 'lucide-react';

type Problem = {
  icon: React.ReactNode;
  title: string;
  description: string;
  stat?: string;
  statLabel?: string;
};

const problems: Problem[] = [
  {
    icon: <AlertTriangle className="h-5 w-5" />,
    title: 'Legal mandate, no practical tools',
    description:
      'E-invoices are mandatory in Germany since 2025. Most businesses are unprepared.',
    stat: '2025',
    statLabel: 'Deadline',
  },
  {
    icon: <FileWarning className="h-5 w-5" />,
    title: 'Constant media breaks',
    description:
      'Invoices arrive as PDFs, scans, or emails — requiring manual re-entry into accounting.',
    stat: '80%',
    statLabel: 'Still PDF',
  },
  {
    icon: <Clock className="h-5 w-5" />,
    title: 'Time lost to manual entry',
    description:
      'Manual data entry is slow, error-prone, and pulls focus from actual work.',
    stat: '15min',
    statLabel: 'Per invoice',
  },
  {
    icon: <Euro className="h-5 w-5" />,
    title: 'Expensive, bloated alternatives',
    description:
      'ERP systems cost thousands and do far more than small teams actually need.',
    stat: '€5k+',
    statLabel: 'Typical ERP',
  },
];

export const ProblemSection = () => {
  return (
    <section className="relative overflow-hidden bg-neutral-900 py-20 md:py-28">
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-[1200px] px-4 md:px-6">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-error/10 px-4 py-1.5 text-sm font-medium text-error">
            <Ban className="h-4 w-4" />
            The problem
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl lg:text-[2.75rem]">
            E-invoices are mandatory.{' '}
            <span className="text-neutral-400">
              Manual workflows don&apos;t scale.
            </span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-400">
            Most businesses face the same challenges when trying to comply with
            e-invoice regulations.
          </p>
        </div>

        {/* Problem cards */}
        <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {problems.map((problem, index) => (
            <div
              key={index}
              className="group relative rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 transition-colors hover:border-neutral-700 hover:bg-neutral-800/50"
            >
              {/* Icon */}
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-error/10 text-error">
                {problem.icon}
              </div>

              {/* Content */}
              <h3 className="text-base font-semibold text-white">
                {problem.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                {problem.description}
              </p>

              {/* Stat */}
              {problem.stat && (
                <div className="mt-6 flex items-baseline gap-2 border-t border-neutral-800 pt-4">
                  <span className="text-2xl font-bold text-error">
                    {problem.stat}
                  </span>
                  <span className="text-xs uppercase tracking-wider text-neutral-500">
                    {problem.statLabel}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom message */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-3 rounded-full border border-neutral-800 bg-neutral-900/80 px-6 py-3">
            <TrendingDown className="h-5 w-5 text-error" />
            <span className="text-sm text-neutral-300">
              These inefficiencies cost small businesses{' '}
              <span className="font-semibold text-white">€2,000+ per year</span>{' '}
              in wasted time
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
