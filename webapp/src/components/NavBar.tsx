import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { signOut } from '@/lib/auth-client';
import { HamburgerMenu } from '@/components/HamburgerMenu';

export function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <motion.nav
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="fixed top-0 left-0 right-0 z-50 h-14 bg-transparent flex items-center justify-between px-6 md:px-10"
    >
      {/* Two-dot logo */}
      <Link to="/" className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-neutral-900" />
          <div className="h-2 w-2 rounded-full bg-orange-500" />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
          Gravu
        </span>
      </Link>

      {/* Nav right side */}
      <div className="flex items-center gap-6">
        <Link
          to="/library"
          className={cn(
            'hidden sm:block font-mono text-[10px] uppercase tracking-[0.15em] transition-colors',
            isActive('/library')
              ? 'text-neutral-900'
              : 'text-neutral-400 hover:text-neutral-700'
          )}
        >
          Library
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
