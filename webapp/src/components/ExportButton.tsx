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
        'min-h-[44px] rounded-xl font-mono text-xs uppercase tracking-wider',
        variant === 'accent'
          ? 'bg-accent text-accent-foreground hover:bg-accent/90'
          : 'bg-primary text-primary-foreground hover:bg-primary/90',
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
