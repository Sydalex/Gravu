import { Link } from 'react-router-dom';

const footerLinks = [
  { label: 'Contact', href: 'mailto:Support@gravu.org' },
  { label: 'Terms of Use', href: '/policy/terms' },
  { label: 'Copyright & Illegal Content', href: '/policy/content' },
  { label: 'Distance Sales & Consumer Info', href: '/policy/distance-sales' },
  { label: 'Refund & Cancellation', href: '/policy/refunds' },
  { label: 'Privacy Policy', href: '/policy/privacy' },
  { label: 'Legal Notice', href: '/policy/legal-notice' },
];

export const Footer = () => (
  <footer className="w-full border-t border-neutral-200 bg-transparent px-6 py-6 shrink-0 mt-auto md:px-12">
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Links row */}
      <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {footerLinks.map((link) => (
          link.href.startsWith('mailto') ? (
            <a
              key={link.label}
              href={link.href}
              className="font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-400 transition-colors hover:text-neutral-700"
            >
              {link.label}
            </a>
          ) : (
            <Link
              key={link.label}
              to={link.href}
              className="font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-400 transition-colors hover:text-neutral-700"
            >
              {link.label}
            </Link>
          )
        ))}
      </nav>

      {/* Divider */}
      <div className="h-px bg-neutral-200" />

      {/* Company info */}
      <div className="text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-neutral-300">
          © {new Date().getFullYear()} Gravu. All rights reserved.
        </p>
      </div>
    </div>
  </footer>
);
