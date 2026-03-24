import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Pen, Trash2, ArrowRight } from 'lucide-react';
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
    return <Pen className="h-6 w-6 text-neutral-300" />;
  }
  return <Layers className="h-6 w-6 text-neutral-300" />;
}

function SkeletonCard() {
  return (
    <div className="border border-neutral-200 bg-white overflow-hidden animate-pulse">
      <div className="aspect-square bg-neutral-100" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-neutral-100 w-2/3" />
        <div className="h-3 bg-neutral-100 w-1/3" />
      </div>
    </div>
  );
}

const containerVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
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
    <PageWrapper className="pt-20">
      <div className="mx-auto max-w-5xl px-6 py-8 md:py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400 mb-3">
              Private Archive
            </p>
            <h1
              className="text-4xl md:text-5xl font-light uppercase tracking-[-0.02em] leading-[1.1] text-neutral-900"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              <span data-bird-perch="library">Archive.</span>
            </h1>
            {!isLoading && list.length > 0 && (
              <p className="mt-2 font-mono text-[10px] text-neutral-400">
                {list.length} conversion{list.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-3 self-start sm:self-auto">
            <button
              onClick={() => navigate('/marketplace')}
              className="group flex items-center gap-3 border border-neutral-200 bg-white px-5 py-3 text-neutral-700 transition-all hover:border-neutral-400 hover:text-neutral-900"
            >
              <span className="font-mono text-xs uppercase tracking-[0.15em]">Marketplace</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
            <button
              onClick={() => navigate('/app')}
              className="group flex items-center gap-3 border border-neutral-900 bg-neutral-900 px-6 py-3 text-white transition-all hover:bg-neutral-800"
            >
              <span className="font-mono text-xs uppercase tracking-[0.15em]">New Conversion</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
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
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center gap-6 border border-neutral-200 bg-white py-20 text-center"
          >
            <div className="flex h-16 w-16 items-center justify-center border border-neutral-200">
              <Layers className="h-6 w-6 text-neutral-300" />
            </div>
            <div className="space-y-2">
              <p className="font-mono text-xs uppercase tracking-[0.1em] text-neutral-900">No conversions yet</p>
              <p className="font-mono text-[10px] text-neutral-400">
                Your private conversions and editable outputs will appear here.
              </p>
            </div>
            <button
              onClick={() => navigate('/app')}
              className="flex items-center gap-3 border border-orange-500 bg-orange-500 px-6 py-3 text-white transition-all hover:bg-orange-600"
            >
              <span className="font-mono text-xs uppercase tracking-[0.15em]">Start Converting</span>
            </button>
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
                  onClick={() => navigate(`/archive/${item.id}`)}
                  className="group relative cursor-pointer border border-neutral-200 bg-white overflow-hidden transition-all hover:border-orange-500/50 hover:shadow-lg"
                >
                  {/* Thumbnail */}
                  <div className="aspect-square overflow-hidden bg-neutral-50 flex items-center justify-center relative">
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
                    <span className="absolute top-2 left-2 font-mono bg-white/90 backdrop-blur-sm px-2 py-1 text-[9px] uppercase tracking-[0.1em] text-neutral-500 border border-neutral-200">
                      {item.flowType === 'full' ? 'Linework' : 'Vectorize'}
                    </span>
                  </div>

                  {/* Info bar */}
                  <div className="px-3 py-3 flex items-center justify-between gap-2 border-t border-neutral-100">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-xs text-neutral-900">
                        {item.name ?? 'Untitled'}
                      </p>
                      <span className="font-mono text-[9px] text-neutral-400">
                        {formatDate(item.createdAt)}
                      </span>
                    </div>
                    <span className="font-mono flex-shrink-0 text-[9px] text-neutral-400">
                      {item.assets.length} asset{item.assets.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Delete button on hover */}
                  <button
                    onClick={(e) => handleDelete(e, item.id)}
                    disabled={deletingId === item.id}
                    className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center bg-white/90 backdrop-blur-sm border border-neutral-200 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500 hover:border-red-200"
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
