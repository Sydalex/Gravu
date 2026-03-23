import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { signOut, useSession } from '@/lib/auth-client';

export function HamburgerMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session } = useSession();
  const isAuthed = !!session?.user;

  const menuLinks = [
    { label: 'Home', href: isAuthed ? '/app' : '/', match: isAuthed ? '/app' : '/', auth: false },
    { label: 'Upload', href: '/upload', match: '/upload', auth: true },
    { label: 'Library', href: '/library', match: '/library', auth: true },
    { label: 'Account', href: '/account', match: '/account', auth: true },
    { label: 'Terms', href: '/policy/terms', match: '/policy/terms', auth: false },
    { label: 'Privacy', href: '/policy/privacy', match: '/policy/privacy', auth: false },
    { label: 'Refunds', href: '/policy/refunds', match: '/policy/refunds', auth: false },
  ];

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
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close menu' : 'Open menu'}
        className="group relative z-[60] flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300/80 bg-[#f8f8f6]/98 text-neutral-900 transition-colors hover:border-neutral-500"
      >
        <motion.span
          animate={open ? { rotate: 45, y: 0 } : { rotate: 0, y: -4 }}
          transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="absolute block h-0.5 w-5 rounded-full bg-current"
        />
        <motion.span
          animate={open ? { rotate: -45, y: 0 } : { rotate: 0, y: 4 }}
          transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="absolute block h-0.5 w-5 rounded-full bg-current"
        />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 z-[55] bg-neutral-900/16"
              onClick={() => setOpen(false)}
            />

            <motion.div
              key="panel"
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="fixed top-0 right-0 bottom-0 z-50 flex w-full max-w-sm flex-col border-l border-neutral-200 bg-[#f8f8f6]"
            >
              <div className="relative flex items-center justify-between px-8 pt-8 pb-6">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-neutral-900" />
                  <span className="h-2 w-2 rounded-full bg-orange-500" />
                  <span className="ml-1 font-light uppercase tracking-[0.15em] text-sm text-neutral-900">
                    Gravu
                  </span>
                </div>
              </div>

              <div className="mx-8 h-px bg-neutral-200" />

              <nav className="relative flex-1 flex flex-col justify-center px-8 gap-1">
                {visibleLinks.map((link, i) => {
                  const isActive =
                    location.pathname === link.match ||
                    location.pathname.startsWith(`${link.match}/`);
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
