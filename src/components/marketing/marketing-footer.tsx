import { FileText, Mail } from 'lucide-react';
import Link from 'next/link';

type FooterLink = {
  label: string;
  href: string;
};

type FooterSection = {
  title: string;
  links: FooterLink[];
};

const footerSections: FooterSection[] = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'Documentation', href: '#docs' },
      { label: 'API Reference', href: '/docs/api' },
    ],
  },
  {
    title: 'Formats',
    links: [
      { label: 'ZUGFeRD 2.1.1', href: '/docs/formats#zugferd' },
      { label: 'XRechnung 3.0', href: '/docs/formats#xrechnung' },
      { label: 'EN 16931', href: '/docs/formats#en16931' },
      { label: 'CSV Export', href: '/docs/export' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About us', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Contact', href: '/contact' },
      { label: 'Careers', href: '/careers' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Cookie Policy', href: '/cookies' },
      { label: 'Imprint', href: '/imprint' },
    ],
  },
];

const socialLinks = [
  {
    icon: (
      <svg
        className="h-5 w-5"
        fill="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
    href: '#',
    label: 'X (Twitter)',
  },
  {
    icon: (
      <svg
        className="h-5 w-5"
        fill="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
    href: '#',
    label: 'LinkedIn',
  },
  {
    icon: (
      <svg
        className="h-5 w-5"
        fill="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
          clipRule="evenodd"
        />
      </svg>
    ),
    href: '#',
    label: 'GitHub',
  },
  {
    icon: <Mail className="h-5 w-5" />,
    href: 'mailto:hello@e-invoice-hub.de',
    label: 'Email',
  },
];

export const MarketingFooter = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-[1200px] px-4 py-16 md:px-6">
        {/* Main footer content */}
        <div className="grid gap-12 lg:grid-cols-6">
          {/* Brand column */}
          <div className="lg:col-span-2">
            <Link
              href="/"
              className="flex items-center gap-2.5 text-lg font-semibold text-neutral-900"
              aria-label="E-Invoice Hub Home"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
                <FileText className="h-4.5 w-4.5 text-white" />
              </div>
              <span>E-Invoice Hub</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-neutral-600">
              The missing link between invoice receipt and accounting software.
              Simplify your e-invoice compliance today.
            </p>

            {/* Social links */}
            <div className="mt-6 flex items-center gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-900"
                  aria-label={social.label}
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-neutral-900">
                {section.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-neutral-600 transition-colors hover:text-neutral-900"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-neutral-200 pt-8 md:flex-row">
          <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-500">
            <p>&copy; {currentYear} E-Invoice Hub. All rights reserved.</p>
            <span className="hidden md:inline">|</span>
            <p>Made with care in Germany</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <span className="inline-block h-2 w-2 rounded-full bg-success" />
              <span>All systems operational</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
