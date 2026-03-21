import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ViewAngle } from '@/lib/store';
import { Box, Layers, PanelTop, PenLine } from 'lucide-react';
import { cn } from '@/lib/utils';

const angles: { value: ViewAngle; label: string; icon: typeof Box }[] = [
  { value: 'perspective', label: 'Perspective', icon: Box },
  { value: 'top', label: 'Top', icon: PanelTop },
  { value: 'side', label: 'Side', icon: Layers },
  { value: 'custom', label: 'Custom', icon: PenLine },
];

interface ViewAngleSelectorProps {
  value: ViewAngle;
  onChange: (angle: ViewAngle) => void;
  customDescription: string | null;
  onCustomChange: (desc: string) => void;
}

export function ViewAngleSelector({
  value,
  onChange,
  customDescription,
  onCustomChange,
}: ViewAngleSelectorProps) {
  return (
    <div className="space-y-3">
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        View Angle
      </p>
      <div className="grid grid-cols-2 gap-2">
        {angles.map((angle) => {
          const Icon = angle.icon;
          return (
            <Button
              key={angle.value}
              variant={value === angle.value ? 'default' : 'secondary'}
              onClick={() => onChange(angle.value)}
              className={cn(
                'min-h-[44px] justify-start gap-2 rounded-xl text-sm',
                value === angle.value && 'ring-1 ring-accent'
              )}
            >
              <Icon className="h-4 w-4" />
              {angle.label}
            </Button>
          );
        })}
      </div>
      {value === 'custom' ? (
        <Input
          placeholder="Describe the view angle..."
          value={customDescription ?? ''}
          onChange={(e) => onCustomChange(e.target.value)}
          className="mt-2 rounded-xl border-border bg-secondary"
        />
      ) : null}
    </div>
  );
}
