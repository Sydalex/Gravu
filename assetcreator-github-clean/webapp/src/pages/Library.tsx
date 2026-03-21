import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Layers, Pen, Trash2, ArrowRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageWrapper } from '@/components/PageWrapper';
import { api } from '@/lib/api';
import type { ConversionSummary } from '../../../backend/src/types';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function FlowTypeIcon({ flowType }: { flowType: string }) {
  if (flowType === 'full') {
    return <Pen className="h-8 w-8 text-muted-foreground/40" />;
  }
  return <Layers className="h-8 w-8 text-muted-foreground/40" />;
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden animate-pulse">
      <div className="aspect-square bg-secondary" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-secondary rounded w-2/3" />
        <div className="h-3 bg-secondary rounded w-1/3" />
      </div>
    </div>
  );
}

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1 },
};

const Library = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: conversions, isLoading } = useQuery({
    queryKey: ['conversions'],
    queryFn: () => api.get<ConversionSummary[]>('/api/conversions'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/conversions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversions'] });
      setDeletingId(null);
    },
    onError: () => {
      setDeletingId(null);
    },
  });

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Delete this conversion? This cannot be undone.')) {
      setDeletingId(id);
      deleteMutation.mutate(id);
    }
  };

  const list = conversions ?? [];

  return (
    <PageWrapper className="pt-[52px]">
      <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
        {/* Hero section */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1
                className="text-display text-3xl md:text-4xl text-foreground"
              >
                Your Library
              </h1>
              {!isLoading && list.length > 0 && (
                <span className="font-data rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">
                  {list.length}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              All your past conversions in one place.
            </p>
          </div>
          <Button
            onClick={() => navigate('/')}
            className="group relative min-h-[40px] overflow-hidden rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground hover:bg-accent/90 self-start sm:self-auto"
          >
            <span className="pointer-events-none absolute inset-0 translate-x-[-200%] skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-[200%]" />
            New Conversion
            <ArrowRight className="ml-2 h-3.5 w-3.5" />
          </Button>
        </motion.div>

        {/* Loading skeletons */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : list.length === 0 ? (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-border bg-card/50 py-20 text-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-secondary">
              <BookOpen className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">No conversions yet</p>
              <p className="text-sm text-muted-foreground">
                Your completed conversions will appear here.
              </p>
            </div>
            <Button
              onClick={() => navigate('/')}
              className="group relative min-h-[40px] overflow-hidden rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground hover:bg-accent/90"
            >
              <span className="pointer-events-none absolute inset-0 translate-x-[-200%] skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-[200%]" />
              Start Converting
            </Button>
          </motion.div>
        ) : (
          /* Conversion grid */
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          >
            <AnimatePresence>
              {list.map((item) => (
                <motion.div
                  key={item.id}
                  variants={cardVariants}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  layout
                  onClick={() => navigate(`/library/${item.id}`)}
                  className="group relative cursor-pointer rounded-xl border border-border bg-card overflow-hidden transition-all duration-200 hover:border-accent/30 hover:shadow-[0_4px_24px_hsl(160_84%_39%_/_0.1)] hover:scale-[1.02]"
                >
                  {/* Thumbnail */}
                  <div className="aspect-square overflow-hidden bg-secondary flex items-center justify-center relative">
                    {item.thumbnailBase64 ? (
                      <img
                        src={`data:image/png;base64,${item.thumbnailBase64}`}
                        alt={item.name ?? 'Conversion'}
                        className="w-full h-full object-cover"
                      />
                    ) : item.originalImageBase64 ? (
                      <img
                        src={`data:image/png;base64,${item.originalImageBase64}`}
                        alt={item.name ?? 'Conversion'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FlowTypeIcon flowType={item.flowType} />
                    )}
                    {/* Flow type badge */}
                    <span className="absolute top-2 left-2 font-data rounded-md bg-background/70 backdrop-blur-sm px-1.5 py-0.5 text-[10px] text-muted-foreground border border-border/50">
                      {item.flowType === 'full' ? 'Linework' : 'Vectorize'}
                    </span>
                  </div>

                  {/* Info bar */}
                  <div className="px-3 py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-foreground">
                        {item.name ?? 'Untitled'}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Calendar className="h-2.5 w-2.5 text-muted-foreground/60 flex-shrink-0" />
                        <span className="font-data text-[10px] text-muted-foreground">
                          {formatDate(item.createdAt)}
                        </span>
                      </div>
                    </div>
                    <span className="font-data flex-shrink-0 rounded-full border border-border/60 bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {item.assets.length} {item.assets.length === 1 ? 'asset' : 'assets'}
                    </span>
                  </div>

                  {/* Delete button on hover */}
                  <button
                    onClick={(e) => handleDelete(e, item.id)}
                    disabled={deletingId === item.id}
                    className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-lg bg-background/70 backdrop-blur-sm border border-border/50 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive hover:border-destructive/30"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </PageWrapper>
  );
};

export default Library;
