import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { HamburgerMenu } from '@/components/HamburgerMenu';
import { api } from '@/lib/api';
import type { SubscriptionStatus } from '../../../backend/src/types';

export function NavBar() {
  const location = useLocation();
  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.get<SubscriptionStatus>('/api/payments/subscription'),
    staleTime: 30_000,
  });

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');
  const creditsLabel = subscription?.isAdmin
    ? 'Credits ∞'
    : `Credits ${subscription?.credits ?? 0}`;

  return (
    <motion.nav
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="fixed top-0 left-0 right-0 z-50 h-14 bg-transparent flex items-center justify-between px-6 md:px-10"
    >
      {/* Two-dot logo */}
      <Link to="/app" className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-neutral-900" />
          <div className="h-2 w-2 rounded-full bg-neutral-900" />
        </div>
        <span className="font-mono text-sm uppercase tracking-[0.2em] text-neutral-500">
          Gravu
        </span>
      </Link>

      {/* Nav right side */}
      <div className="flex items-center gap-6">
        <Link
          to="/account"
          className="flex items-center gap-2 border border-neutral-200 bg-[#f8f8f6]/95 px-3 py-1.5 text-neutral-700 transition-colors hover:border-neutral-300"
        >
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-400">Balance</span>
          <span className="font-mono text-[10px] font-semibold text-neutral-900">{creditsLabel}</span>
        </Link>

        <Link
          to="/marketplace"
          className={cn(
            'hidden sm:block font-mono text-[10px] uppercase tracking-[0.15em] transition-colors',
            isActive('/marketplace')
              ? 'text-neutral-900'
              : 'text-neutral-400 hover:text-neutral-700'
          )}
        >
          Marketplace
        </Link>

        <Link
          to="/account"
          className={cn(
            'hidden sm:block font-mono text-[10px] uppercase tracking-[0.15em] transition-colors',
            isActive('/account')
              ? 'text-neutral-900'
              : 'text-neutral-400 hover:text-neutral-700'
          )}
        >
          Account
        </Link>

        <HamburgerMenu />
      </div>
    </motion.nav>
  );
}
