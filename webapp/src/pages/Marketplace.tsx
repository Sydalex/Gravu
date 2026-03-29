import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Download, FileCode, FileImage, FileType, Layers, Search } from 'lucide-react';
import { PageWrapper } from '@/components/PageWrapper';
import { api } from '@/lib/api';
import { buildDownloadFilename } from '@/lib/asset-naming';
import { toast } from '@/components/ui/sonner';
import type {
  MarketplaceDownloadResponse,
  SubscriptionStatus,
} from '../../../backend/src/types';

type MarketplaceAsset = {
  id: string;
  conversionId: string;
  subjectId: number;
  title: string;
  category: string;
  previewBase64: string | null;
  flowType: string;
  createdAt: string;
  hasSvg: boolean;
  hasDxf: boolean;
  downloadCount: number;
};

const categoryOrder = ['All', 'People', 'Furniture', 'Objects', 'Plants', 'Architecture', 'Decor'];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function downloadText(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadBase64Image(base64: string, filename: string, mimeType: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function triggerMarketplaceDownload(payload: MarketplaceDownloadResponse) {
  if (payload.format === 'png') {
    downloadBase64Image(
      payload.content,
      buildDownloadFilename(payload.title, 'png'),
      payload.mimeType
    );
    return;
  }

  downloadText(
    payload.content,
    buildDownloadFilename(payload.title, payload.format),
    payload.mimeType
  );
}

const Marketplace = () => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace'],
    queryFn: () => api.get<MarketplaceAsset[]>('/api/marketplace'),
  });
  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.get<SubscriptionStatus>('/api/payments/subscription'),
    staleTime: 30_000,
  });

  const downloadMutation = useMutation({
    mutationFn: (params: { assetId: string; format: 'png' | 'svg' | 'dxf' }) =>
      api.post<MarketplaceDownloadResponse>(
        `/api/marketplace/assets/${params.assetId}/download`,
        { format: params.format }
      ),
    onSuccess: async (payload) => {
      triggerMarketplaceDownload(payload);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['marketplace'] }),
        queryClient.invalidateQueries({ queryKey: ['subscription'] }),
      ]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Download failed');
    },
  });

  const items = data ?? [];

  const categories = useMemo(() => {
    const dynamic = Array.from(new Set(items.map((item) => item.category).filter(Boolean))).sort();
    return Array.from(new Set([...categoryOrder, ...dynamic]));
  }, [items]);

  const filtered = items.filter((item) => {
    const matchesCategory = activeCategory === 'All' || item.category === activeCategory;
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      item.title.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  return (
    <PageWrapper className="pt-20">
      <div className="mx-auto max-w-6xl px-6 py-8 md:py-12">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="border-b border-[#e7e0d5] pb-8"
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.4fr)] lg:gap-12">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-400">
                Shared Library
              </p>
              <h1
                className="mt-3 max-w-[10ch] text-4xl font-light uppercase leading-[0.94] tracking-[-0.05em] text-neutral-900 md:text-6xl"
                style={{ fontFamily: "'Syne', sans-serif" }}
              >
                Marketplace.
              </h1>
            </div>

            <div className="space-y-4">
              <div className="max-w-xl">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search titles or categories"
                    className="h-11 w-full border border-neutral-200 bg-white pl-10 pr-4 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-400"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={`border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
                      activeCategory === category
                        ? 'border-orange-500 bg-orange-500 text-white'
                        : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-400 hover:text-neutral-900'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>

              {subscription ? (
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-400">
                  {subscription.isAdmin || subscription.marketplaceDownloadsRemaining === null
                    ? 'Marketplace downloads: unlimited'
                    : `Marketplace downloads left this month: ${subscription.marketplaceDownloadsRemaining} / ${subscription.marketplaceDownloadsLimit ?? 0}`}
                </div>
              ) : null}
            </div>
          </div>
        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="mt-8"
        >
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="overflow-hidden border border-neutral-200 bg-white animate-pulse">
                  <div className="aspect-[4/3] bg-neutral-100" />
                  <div className="space-y-3 p-4">
                    <div className="h-4 w-2/3 bg-neutral-100" />
                    <div className="h-3 w-1/3 bg-neutral-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center border border-dashed border-neutral-200 bg-white px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center border border-neutral-200 bg-neutral-50">
                <Layers className="h-6 w-6 text-neutral-300" />
              </div>
              <p className="mt-6 font-mono text-xs uppercase tracking-[0.14em] text-neutral-900">
                No marketplace assets yet
              </p>
              <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">
                Shared assets will appear here once users list work from their private archive into the
                marketplace.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((item, index) => (
                <motion.article
                  key={item.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.32, delay: 0.03 * index }}
                  className="overflow-hidden border border-neutral-200 bg-white transition-colors hover:border-orange-300"
                >
                  <div className="relative aspect-[4/3] border-b border-neutral-100 bg-neutral-50">
                    {item.previewBase64 ? (
                      <img
                        src={`data:image/png;base64,${item.previewBase64}`}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Layers className="h-8 w-8 text-neutral-300" />
                      </div>
                    )}
                    <div className="absolute left-3 top-3 flex gap-2">
                      <span className="border border-white/80 bg-white/90 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500 backdrop-blur-sm">
                        {item.category}
                      </span>
                      <span className="border border-white/80 bg-white/90 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500 backdrop-blur-sm">
                        {item.flowType === 'full' ? 'Photo to Vector' : 'Vectorize'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4 p-4">
                    <div className="space-y-2">
                      <h2 className="text-xl font-light uppercase tracking-[-0.03em] text-neutral-900">
                        {item.title}
                      </h2>
                      <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-400">
                        <span>{formatDate(item.createdAt)}</span>
                        <span className="h-1 w-1 rounded-full bg-neutral-300" />
                        <span>{item.downloadCount} downloads</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
                      {item.previewBase64 ? (
                        <button
                          type="button"
                          onClick={() =>
                            downloadMutation.mutate({
                              assetId: item.id,
                              format: 'png',
                            })
                          }
                          disabled={downloadMutation.isPending}
                          className="inline-flex items-center gap-2 border border-neutral-200 px-3 py-2 text-[11px] uppercase tracking-[0.12em] text-neutral-700 transition-colors hover:border-neutral-400"
                        >
                          <FileImage className="h-3.5 w-3.5" />
                          PNG
                        </button>
                      ) : null}
                      {item.hasSvg ? (
                        <button
                          type="button"
                          disabled={downloadMutation.isPending}
                          className="inline-flex items-center gap-2 border border-neutral-200 px-3 py-2 text-[11px] uppercase tracking-[0.12em] text-neutral-700 transition-colors hover:border-neutral-400"
                          onClick={() =>
                            downloadMutation.mutate({
                              assetId: item.id,
                              format: 'svg',
                            })
                          }
                        >
                          <FileCode className="h-3.5 w-3.5" />
                          SVG
                        </button>
                      ) : null}
                      {item.hasDxf ? (
                        <button
                          type="button"
                          disabled={downloadMutation.isPending}
                          className="inline-flex items-center gap-2 border border-neutral-200 px-3 py-2 text-[11px] uppercase tracking-[0.12em] text-neutral-700 transition-colors hover:border-neutral-400"
                          onClick={() =>
                            downloadMutation.mutate({
                              assetId: item.id,
                              format: 'dxf',
                            })
                          }
                        >
                          <FileType className="h-3.5 w-3.5" />
                          DXF
                        </button>
                      ) : null}
                      <span className="ml-auto inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-400">
                        <Download className="h-3.5 w-3.5" />
                        Shared asset
                      </span>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </PageWrapper>
  );
};

export default Marketplace;
