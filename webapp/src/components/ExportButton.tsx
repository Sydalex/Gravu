import { Button } from '@/components/ui/button';
import { Loader2, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExportButtonProps {
  label: string;
  icon: LucideIcon;
  loading?: boolean;
  variant?: 'default' | 'accent';
  onClick: () => void;
  className?: string;
}

export function ExportButton({
  label,
  icon: Icon,
  loading = false,
  variant = 'default',
  onClick,
  className,
}: ExportButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={loading}
      className={cn(
        'min-h-[44px] gap-2 rounded-xl font-mono text-xs uppercase tracking-wider transition-all',
        variant === 'accent'
          ? 'border border-accent/30 bg-accent/10 text-accent-foreground hover:bg-accent/20'
          : 'border border-white/8 bg-card text-foreground hover:border-white/16 hover:bg-card/80',
        className
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      {label}
    </Button>
  );
}
