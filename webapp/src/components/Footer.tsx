import { Link } from 'react-router-dom';

const footerLinks = [
  { label: 'Contact', href: 'mailto:info@gravu.app' },
  { label: 'Distance Sales Agreement', href: '/policy/distance-sales' },
  { label: 'Contact', href: 'mailto:info@asset-creator.com' },
  { label: 'Terms of Use', href: '/policy/terms' },
  { label: 'Copyright & Illegal Content', href: '/policy/content' },
  { label: 'Distance Sales & Consumer Info', href: '/policy/distance-sales' },
  { label: 'Refund & Cancellation', href: '/policy/refunds' },
  { label: 'Privacy Policy', href: '/policy/privacy' },
  { label: 'Legal Notice', href: '/policy/legal-notice' },
];

export const Footer = () => (
  <footer className="w-full border-t border-border/40 bg-background/60 px-4 py-6 shrink-0 mt-auto">
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Links row */}
      <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {footerLinks.map((link) => (
          link.href.startsWith('mailto') ? (
            <a
              key={link.label}
              href={link.href}
              className="font-mono text-[11px] text-muted-foreground/60 transition-colors hover:text-muted-foreground"
            >
              {link.label}
            </a>
          ) : (
            <Link
              key={link.label}
              to={link.href}
              className="font-mono text-[11px] text-muted-foreground/60 transition-colors hover:text-muted-foreground"
            >
              {link.label}
            </Link>
          )
        ))}
      </nav>

      {/* Divider */}
      <div className="h-px bg-border/30" />

      {/* Company info */}
      <div className="text-center">
        <p className="font-mono text-[10px] text-muted-foreground/30">
          © {new Date().getFullYear()}. All rights reserved.
        </p>
      </div>
    </div>
  </footer>
);
