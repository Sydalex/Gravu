import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, User, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { signOut } from '@/lib/auth-client';

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
      className="fixed top-0 left-0 right-0 z-50 h-[52px] bg-background/80 backdrop-blur-xl border-b border-border/50 flex items-center px-4 md:px-6"
    >
      {/* Wordmark */}
      <Link
        to="/"
        className="mr-auto font-syne tracking-tight text-foreground hover:text-accent transition-colors text-2xl font-bold text-chart-3"
        style={{ fontFamily: "'Syne', sans-serif" }}
      >
        AssetCreator
      </Link>

      {/* Nav links */}
      <div className="flex items-center gap-1">
        <Link
          to="/library"
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            isActive('/library')
              ? 'text-accent bg-accent/10'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
          )}
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Library</span>
        </Link>

        <Link
          to="/account"
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
            isActive('/account')
              ? 'text-accent bg-accent/10'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
          )}
        >
          <User className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Account</span>
        </Link>

        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </motion.nav>
  );
}
