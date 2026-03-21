import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepBadge {
  label: string;
}

interface FlowCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  steps: StepBadge[];
  delay?: number;
  onClick: () => void;
  cardNumber?: string;
}

export function FlowCard({
  title,
  description,
  icon: Icon,
  steps,
  delay = 0,
  onClick,
  cardNumber = '01',
}: FlowCardProps) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.6,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileHover={{
        scale: 1.01,
        y: -2,
        transition: { type: 'spring', stiffness: 300, damping: 30 },
      }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className={cn(
        'group relative flex w-full flex-col items-start gap-6 overflow-hidden rounded-2xl border border-border bg-card p-7 md:p-8 text-left',
        'transition-all duration-200',
        'hover:border-accent hover:shadow-[0_0_0_1px_hsl(160_84%_39%_/_0.6),_0_8px_40px_hsl(160_84%_39%_/_0.15)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'min-h-[240px]'
      )}
    >
      {/* Background card number — decorative texture */}
      <span
        className="pointer-events-none absolute -right-4 -bottom-6 select-none font-sans text-[120px] font-extrabold leading-none text-foreground/[0.03] tracking-tighter"
        aria-hidden="true"
      >
        {cardNumber}
      </span>

      {/* Hover gradient sweep */}
      <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-accent/10 via-accent/[0.03] to-transparent" />
      </div>

      {/* Icon */}
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-accent transition-all duration-300 group-hover:border-accent/40 group-hover:bg-accent/15">
        <Icon className="h-5 w-5" />
      </div>

      {/* Title & Description */}
      <div className="flex-1 space-y-2.5">
        <h3 className="font-sans text-xl font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>

      {/* Step flow — dots connected by lines */}
      <div className="flex items-center gap-0 pt-1">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div className="h-1.5 w-1.5 rounded-full bg-accent/50 transition-colors group-hover:bg-accent" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 ? (
              <div className="mb-4 mx-2 h-px w-8 bg-border" />
            ) : null}
          </div>
        ))}
      </div>
    </motion.button>
  );
}
