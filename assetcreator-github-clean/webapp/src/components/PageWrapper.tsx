import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface PageWrapperProps {
  children: ReactNode;
  className?: string;
}

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export function PageWrapper({ children, className = '' }: PageWrapperProps) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`relative min-h-screen bg-background overflow-hidden ${className}`}
    >
      {/* Atmospheric gradient background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Top-left radial accent */}
        <div
          className="absolute -top-48 -left-48 h-[600px] w-[600px] rounded-full animate-glow-pulse"
          style={{
            background:
              'radial-gradient(circle, hsl(160 84% 39% / 0.05) 0%, transparent 70%)',
          }}
        />
        {/* Bottom-right radial accent */}
        <div
          className="absolute -bottom-64 -right-64 h-[700px] w-[700px] rounded-full animate-glow-pulse"
          style={{
            background:
              'radial-gradient(circle, hsl(160 84% 39% / 0.03) 0%, transparent 70%)',
            animationDelay: '1.5s',
          }}
        />
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              'linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
