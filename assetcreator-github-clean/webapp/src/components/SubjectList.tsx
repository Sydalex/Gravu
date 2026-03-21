import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Subject } from '@/lib/store';
import { motion, AnimatePresence } from 'framer-motion';
import { Link2, X, ChevronRight } from 'lucide-react';

interface SubjectListProps {
  subjects: Subject[];
  onToggle: (id: number) => void;
  onMerge: (ids: number[], label: string) => void;
  onUnmerge: (id: number) => void;
}

export function SubjectList({ subjects, onToggle, onMerge, onUnmerge }: SubjectListProps) {
  const [mergeSelection, setMergeSelection] = useState<number[]>([]);
  const [mergeLabel, setMergeLabel] = useState('');
  const [showMergeInput, setShowMergeInput] = useState(false);

  const toggleMergeSelection = (id: number) => {
    setMergeSelection((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleOpenMerge = () => {
    const labels = mergeSelection
      .map((id) => subjects.find((s) => s.id === id)?.description ?? '')
      .filter(Boolean)
      .join(' + ');
    setMergeLabel(labels);
    setShowMergeInput(true);
  };

  const handleConfirmMerge = () => {
    if (mergeSelection.length < 2 || !mergeLabel.trim()) return;
    onMerge(mergeSelection, mergeLabel.trim());
    setMergeSelection([]);
    setMergeLabel('');
    setShowMergeInput(false);
  };

  const handleCancelMerge = () => {
    setMergeSelection([]);
    setMergeLabel('');
    setShowMergeInput(false);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Detected Subjects
        </p>
        {mergeSelection.length >= 2 && !showMergeInput && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={handleOpenMerge}
            className="flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/20 transition-colors"
          >
            <Link2 className="h-3 w-3" />
            Combine {mergeSelection.length}
          </motion.button>
        )}
      </div>

      {/* Merge label input */}
      <AnimatePresence>
        {showMergeInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 space-y-2.5">
              <p className="text-xs text-muted-foreground">
                Name the combined subject:
              </p>
              <Input
                autoFocus
                value={mergeLabel}
                onChange={(e) => setMergeLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmMerge();
                  if (e.key === 'Escape') handleCancelMerge();
                }}
                placeholder="e.g. Flowerpot"
                className="h-8 rounded-lg border-accent/30 bg-secondary text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleConfirmMerge}
                  disabled={!mergeLabel.trim()}
                  className="h-7 flex-1 rounded-lg bg-accent text-xs text-accent-foreground hover:bg-accent/90"
                >
                  <ChevronRight className="mr-1 h-3 w-3" />
                  Combine
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancelMerge}
                  className="h-7 rounded-lg text-xs text-muted-foreground"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subject rows */}
      <div className="space-y-1.5">
        {subjects.map((subject, i) => {
          const isMerged = !!subject.mergedIds?.length;
          const isInMergeSelection = mergeSelection.includes(subject.id);

          return (
            <motion.div
              key={subject.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
              className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                isMerged
                  ? 'border-accent/25 bg-accent/5'
                  : isInMergeSelection
                  ? 'border-accent/40 bg-accent/10'
                  : 'border-border bg-secondary/50 hover:bg-secondary'
              }`}
            >
              <Checkbox
                id={`subject-${subject.id}`}
                checked={subject.selected}
                onCheckedChange={() => onToggle(subject.id)}
                className="h-4 w-4 flex-shrink-0"
              />

              <Label
                htmlFor={`subject-${subject.id}`}
                className="flex-1 cursor-pointer text-sm text-foreground leading-snug"
              >
                {subject.description}
                {isMerged && (
                  <span className="ml-2 font-mono text-[10px] text-accent/60">
                    combined
                  </span>
                )}
              </Label>

              {isMerged ? (
                <button
                  onClick={() => onUnmerge(subject.id)}
                  className="flex-shrink-0 rounded-md p-1 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                  title="Split apart"
                >
                  <X className="h-3 w-3" />
                </button>
              ) : (
                <button
                  onClick={() => toggleMergeSelection(subject.id)}
                  className={`flex-shrink-0 rounded-md p-1 transition-all ${
                    isInMergeSelection
                      ? 'text-accent opacity-100'
                      : 'text-muted-foreground/30 opacity-0 group-hover:opacity-100 hover:text-muted-foreground'
                  }`}
                  title="Select to combine"
                >
                  <Link2 className="h-3 w-3" />
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      {subjects.length >= 2 && mergeSelection.length === 0 && !showMergeInput && (
        <p className="font-mono text-[10px] text-muted-foreground/40 text-center pt-0.5">
          Hover a subject and click the link icon to combine
        </p>
      )}
    </div>
  );
}
