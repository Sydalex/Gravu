import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { signOut, useSession } from '@/lib/auth-client';

const menuLinks = [
  { label: 'Home', href: '/', auth: false },
  { label: 'Upload', href: '/upload', auth: true },
  { label: 'Library', href: '/library', auth: true },
  { label: 'Account', href: '/account', auth: true },
  { label: 'Refund Policy', href: '/policy', auth: false },
  { label: 'Privacy Policy', href: '/privacy-policy', auth: false },
];

export function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session } = useSession();

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate('/login');
  };

  const visibleLinks = menuLinks.filter(
    (l) => !l.auth || !!session?.user
  );

  return (
    <>
      {/* Trigger button — two horizontal lines */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        className="group relative z-[60] flex flex-col items-end gap-[6px] p-2"
      >
        <motion.span
          animate={open ? { rotate: 45, y: 7, width: '20px' } : { rotate: 0, y: 0, width: '20px' }}
          transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="block h-px bg-neutral-900 origin-center"
          style={{ width: 20 }}
        />
        <motion.span
          animate={open ? { rotate: -45, y: -7, width: '20px' } : { rotate: 0, y: 0, width: '14px' }}
          transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="block h-px bg-neutral-900 origin-center"
          style={{ width: 14 }}
        />
      </button>

      {/* Overlay */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-40 bg-neutral-900/10 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            {/* Menu panel — slides in from right */}
            <motion.div
              key="panel"
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="fixed top-0 right-0 bottom-0 z-50 flex w-full max-w-sm flex-col bg-[#f8f8f6]"
            >
              {/* Warm gradient blob inside menu */}
              <div
                className="pointer-events-none absolute top-0 right-0 h-64 w-64 opacity-50 blur-3xl"
                style={{
                  background:
                    'radial-gradient(circle, hsl(30 80% 70% / 0.4) 0%, hsl(15 70% 60% / 0.2) 60%, transparent 100%)',
                }}
              />

              {/* Top bar inside panel */}
              <div className="relative flex items-center justify-between px-8 pt-8 pb-6">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-neutral-900" />
                  <span className="h-2 w-2 rounded-full bg-orange-500" />
                  <span className="ml-1 font-light uppercase tracking-[0.15em] text-sm text-neutral-900">
                    Gravu
                  </span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="flex flex-col items-end gap-[6px] p-2"
                >
                  <span className="block h-px w-5 rotate-45 translate-y-[3.5px] bg-neutral-900" />
                  <span className="block h-px w-5 -rotate-45 -translate-y-[3.5px] bg-neutral-900" />
                </button>
              </div>

              {/* Divider */}
              <div className="mx-8 h-px bg-neutral-200" />

              {/* Nav links */}
              <nav className="relative flex-1 flex flex-col justify-center px-8 gap-1">
                {visibleLinks.map((link, i) => {
                  const isActive = location.pathname === link.href;
                  return (
                    <motion.div
                      key={link.href}
                      initial={{ opacity: 0, x: 24 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 + i * 0.06, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                    >
                      <Link
                        to={link.href}
                        onClick={() => setOpen(false)}
                        className={`group flex items-baseline justify-between py-4 border-b border-neutral-100 transition-colors ${
                          isActive
                            ? 'text-neutral-900'
                            : 'text-neutral-400 hover:text-neutral-900'
                        }`}
                      >
                        <span className="text-2xl font-light uppercase tracking-tight">
                          {link.label}
                        </span>
                        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-neutral-300 group-hover:text-orange-400 transition-colors">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>

              {/* Bottom: sign in / sign out */}
              <div className="relative px-8 pb-10 pt-6 border-t border-neutral-100">
                {session?.user ? (
                  <div className="flex flex-col gap-3">
                    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-neutral-400">
                      {session.user.email}
                    </p>
                    <button
                      onClick={handleSignOut}
                      className="text-left font-light uppercase tracking-widest text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-6">
                    <Link
                      to="/login"
                      onClick={() => setOpen(false)}
                      className="font-light uppercase tracking-widest text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
                    >
                      Sign in
                    </Link>
                    <Link
                      to="/register"
                      onClick={() => setOpen(false)}
                      className="font-light uppercase tracking-widest text-sm text-neutral-900 underline underline-offset-4"
                    >
                      Get started
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
