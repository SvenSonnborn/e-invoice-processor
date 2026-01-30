import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Code2,
  FileCode,
  HelpCircle,
  Plug,
  Terminal,
} from 'lucide-react';
import Link from 'next/link';

type DocLink = {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  badge?: string;
};

const docLinks: DocLink[] = [
  {
    icon: <BookOpen className="h-5 w-5" />,
    title: 'Getting Started',
    description:
      'Upload your first invoice and get a compliant e-invoice in under 5 minutes.',
    href: '/docs/getting-started',
    badge: 'Start here',
  },
  {
    icon: <FileCode className="h-5 w-5" />,
    title: 'Supported Formats',
    description:
      'Deep dive into ZUGFeRD 2.1.1, XRechnung 3.0, and EN 16931 compliance.',
    href: '/docs/formats',
  },
  {
    icon: <Plug className="h-5 w-5" />,
    title: 'Export & Integration',
    description:
      'Export to CSV, XML, or JSON. Learn how to integrate with your accounting software.',
    href: '/docs/export',
  },
  {
    icon: <HelpCircle className="h-5 w-5" />,
    title: 'FAQ',
    description:
      'Answers to common questions about e-invoicing requirements and our platform.',
    href: '/docs/faq',
  },
];

const codeExample = `// Validate an invoice with our API
const response = await fetch('/api/v1/invoices', {
  method: 'POST',
  body: formData,
  headers: {
    'Authorization': 'Bearer your_api_key'
  }
});

const { invoice, validation } = await response.json();
console.log(validation.status); // "valid"`;

export const DocsPreviewSection = () => {
  return (
    <section id="docs" className="relative overflow-hidden bg-neutral-900 py-20 md:py-28">
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-[1200px] px-4 md:px-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: Content */}
          <div>
            {/* Header */}
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-500/10 px-4 py-1.5 text-sm font-medium text-brand-400">
              <BookOpen className="h-4 w-4" />
              Documentation
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Everything you need to{' '}
              <span className="text-brand-400">get started</span>
            </h2>
            <p className="mt-4 text-lg text-neutral-400">
              Comprehensive guides, API references, and examples to help you
              integrate quickly and stay compliant.
            </p>

            {/* Doc links */}
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {docLinks.map((doc, index) => (
                <Link
                  key={index}
                  href={doc.href}
                  className="group relative rounded-xl border border-neutral-800 bg-neutral-900/50 p-5 transition-all hover:border-neutral-700 hover:bg-neutral-800/50"
                >
                  {doc.badge && (
                    <span className="absolute right-4 top-4 rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-400">
                      {doc.badge}
                    </span>
                  )}
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-800 text-neutral-400 transition-colors group-hover:bg-brand-500/10 group-hover:text-brand-400">
                    {doc.icon}
                  </div>
                  <h3 className="mt-4 flex items-center gap-2 text-base font-semibold text-white">
                    {doc.title}
                    <ArrowUpRight className="h-4 w-4 text-neutral-600 transition-colors group-hover:text-brand-400" />
                  </h3>
                  <p className="mt-2 text-sm text-neutral-400">
                    {doc.description}
                  </p>
                </Link>
              ))}
            </div>

            {/* View all docs link */}
            <div className="mt-8">
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 text-sm font-medium text-brand-400 hover:text-brand-300"
              >
                View all documentation
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Right: Code preview */}
          <div className="flex items-center">
            <div className="w-full overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 shadow-2xl">
              {/* Window chrome */}
              <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-900 px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-neutral-700" />
                  <div className="h-3 w-3 rounded-full bg-neutral-700" />
                  <div className="h-3 w-3 rounded-full bg-neutral-700" />
                </div>
                <div className="ml-4 flex items-center gap-2 rounded-md bg-neutral-800 px-3 py-1">
                  <Terminal className="h-3.5 w-3.5 text-neutral-500" />
                  <span className="text-xs text-neutral-400">api-example.ts</span>
                </div>
              </div>

              {/* Code content */}
              <div className="p-6">
                <pre className="overflow-x-auto text-sm leading-relaxed">
                  <code className="font-mono text-neutral-300">
                    {codeExample.split('\n').map((line, i) => (
                      <div key={i} className="flex">
                        <span className="mr-4 select-none text-neutral-600">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <span
                          dangerouslySetInnerHTML={{
                            __html: highlightCode(line),
                          }}
                        />
                      </div>
                    ))}
                  </code>
                </pre>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-neutral-800 bg-neutral-900 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-neutral-500" />
                  <span className="text-xs text-neutral-500">TypeScript</span>
                </div>
                <Link
                  href="/docs/api"
                  className="text-xs font-medium text-brand-400 hover:text-brand-300"
                >
                  View API docs →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const highlightCode = (line: string): string => {
  return line
    .replace(
      /(\/\/.*)/g,
      '<span class="text-neutral-500">$1</span>'
    )
    .replace(
      /('.*?'|".*?")/g,
      '<span class="text-success">$1</span>'
    )
    .replace(
      /\b(const|await|method|body|headers)\b/g,
      '<span class="text-brand-400">$1</span>'
    )
    .replace(
      /\b(fetch|console|log)\b/g,
      '<span class="text-warning">$1</span>'
    );
};
