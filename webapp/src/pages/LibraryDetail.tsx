import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  FileCode,
  FileType,
  FileImage,
  Layers,
  AlertCircle,
  ImageIcon,
  Sparkles,
  Download,
  Loader2,
  FileArchive,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageWrapper } from '@/components/PageWrapper';
import { useImageStore, type VectorizeMode } from '@/lib/store';
import { api } from '@/lib/api';
import { buildDownloadFilename } from '@/lib/asset-naming';
import { downloadBase64File, downloadTextFile, triggerBlobDownload } from '@/lib/download';
import { base64ToPngFile, vectorizeRaster } from '@/lib/vectorize';
import { toast } from '@/components/ui/sonner';
import type { ConversionDetail, ConversionAsset } from '../../../backend/src/types';

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function downloadText(content: string, filename: string, mimeType: string) {
  downloadTextFile(content, filename, mimeType);
}

function downloadBase64Image(base64: string, filename: string, mimeType: string) {
  downloadBase64File(base64, filename, mimeType);
}

function getAssetTitle(asset: ConversionAsset, conversionName?: string | null) {
  return asset.title ?? asset.marketplaceTitle ?? conversionName ?? `Asset ${asset.subjectId}`;
}

function convertPngToWebp(base64: string, filename: string) {
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        triggerBlobDownload(blob, filename);
      },
      'image/webp',
      0.92,
    );
  };
  img.src = `data:image/png;base64,${base64}`;
}

// ─── Sub-component: Vectorise buttons ────────────────────────────────────────

interface VectoriseButtonsProps {
  asset: ConversionAsset;
  conversionId: string;
  conversionName?: string | null;
}

const VectoriseButtons = ({ asset, conversionId, conversionName }: VectoriseButtonsProps) => {
  const queryClient = useQueryClient();
  const simplificationLevel = useImageStore((s) => s.simplificationLevel);
  const [convertingDxf, setConvertingDxf] = useState<boolean>(false);
  const [convertingSvg, setConvertingSvg] = useState<boolean>(false);
  const [vectorizeMode, setVectorizeMode] = useState<VectorizeMode>('centerline');
  const assetTitle = getAssetTitle(asset, conversionName);

  const saveAsset = useMutation({
    mutationFn: (payload: { svgContent?: string; dxfContent?: string }) =>
      api.patch(`/api/conversions/${conversionId}/assets/${asset.id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversion', conversionId] });
    },
  });

  const handleConvertDxf = async () => {
    if (!asset.imageBase64) return;
    setConvertingDxf(true);
    try {
      const vectorized = await vectorizeRaster(
        base64ToPngFile(asset.imageBase64, buildDownloadFilename(assetTitle, 'png')),
        vectorizeMode,
        simplificationLevel
      );
      await saveAsset.mutateAsync({ dxfContent: vectorized.dxf, svgContent: vectorized.svg });
    } catch (e) {
      console.error('DXF conversion error', e);
    } finally {
      setConvertingDxf(false);
    }
  };

  const handleConvertSvg = async () => {
    if (!asset.imageBase64) return;
    setConvertingSvg(true);
    try {
      const vectorized = await vectorizeRaster(
        base64ToPngFile(asset.imageBase64, buildDownloadFilename(assetTitle, 'png')),
        vectorizeMode,
        simplificationLevel
      );
      await saveAsset.mutateAsync({ svgContent: vectorized.svg, dxfContent: vectorized.dxf });
    } catch (e) {
      console.error('SVG conversion error', e);
    } finally {
      setConvertingSvg(false);
    }
  };

  return (
    <div className="mt-2 pt-2 border-t border-border/50">
      <p className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider mb-1.5">
        Convert to vector:
      </p>
      <div className="mb-2 flex gap-1.5">
        {(['centerline', 'outline'] as VectorizeMode[]).map((mode) => {
          const active = vectorizeMode === mode;
          return (
            <Button
              key={mode}
              variant="secondary"
              size="sm"
              className={`h-7 px-2.5 text-[10px] uppercase tracking-[0.12em] ${
                active
                  ? 'border border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-50'
                  : 'border border-border/60 text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setVectorizeMode(mode)}
              disabled={convertingDxf || convertingSvg}
            >
              {mode === 'outline' ? 'Outline' : 'Centre Line'}
            </Button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          className="gap-1.5 h-7 text-xs border border-accent/20 hover:border-accent/50 hover:text-accent"
          onClick={handleConvertSvg}
          disabled={convertingSvg || convertingDxf}
        >
          {convertingSvg ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <FileCode className="h-3 w-3" />
          )}
          Convert &rarr; SVG
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="gap-1.5 h-7 text-xs border border-accent/20 hover:border-accent/50 hover:text-accent"
          onClick={handleConvertDxf}
          disabled={convertingDxf || convertingSvg}
        >
          {convertingDxf ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <FileType className="h-3 w-3" />
          )}
          Convert &rarr; DXF
        </Button>
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const LibraryDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [listingAsset, setListingAsset] = useState<ConversionAsset | null>(null);
  const [listingTitle, setListingTitle] = useState('');
  const [listingCategory, setListingCategory] = useState('Objects');

  const { data: conversion, isLoading, isError } = useQuery({
    queryKey: ['conversion', id],
    queryFn: () => api.get<ConversionDetail>(`/api/conversions/${id}`),
    enabled: !!id,
  });

  const listMutation = useMutation({
    mutationFn: (payload: { assetId: string; title: string; category: string }) =>
      api.post(`/api/marketplace/assets/${payload.assetId}/list`, {
        title: payload.title,
        category: payload.category,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['conversion', id] }),
        queryClient.invalidateQueries({ queryKey: ['marketplace'] }),
      ]);
      setListingAsset(null);
      toast.success('Asset listed in Marketplace');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to list asset');
    },
  });

  const unlistMutation = useMutation({
    mutationFn: (assetId: string) => api.post(`/api/marketplace/assets/${assetId}/unlist`, {}),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['conversion', id] }),
        queryClient.invalidateQueries({ queryKey: ['marketplace'] }),
      ]);
      toast.success('Asset removed from Marketplace');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to unlist asset');
    },
  });

  if (isLoading) {
    return (
      <PageWrapper className="pt-[72px]">
        <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
          <div className="h-8 w-40 bg-secondary rounded animate-pulse" />
          <div className="h-4 w-64 bg-secondary rounded animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-xl bg-secondary animate-pulse" />
            ))}
          </div>
        </div>
      </PageWrapper>
    );
  }

  if (isError || !conversion) {
    return (
      <PageWrapper className="pt-[72px]">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-destructive/20 bg-destructive/10">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <p className="text-base font-semibold text-foreground">Conversion not found</p>
          <Button variant="secondary" onClick={() => navigate('/archive')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Archive
          </Button>
        </div>
      </PageWrapper>
    );
  }

  const isVectorize = conversion.flowType === 'vectorize_only';

  const pngAssets = conversion.assets.filter((a) => !!a.imageBase64);
  const vectorAssets = conversion.assets.filter(
    (a) => !!a.svgContent || !!a.dxfContent,
  );

  const openListDialog = (asset: ConversionAsset) => {
    setListingAsset(asset);
    setListingTitle(getAssetTitle(asset, conversion.name));
    setListingCategory(asset.marketplaceCategory ?? 'Objects');
  };

  return (
    <PageWrapper className="pt-[72px]">
      <div className="mx-auto max-w-4xl px-4 py-8 md:py-12 space-y-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-4"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/archive')}
            className="gap-2 text-muted-foreground hover:text-foreground -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Archive
          </Button>
          <div>
            <h1 className="text-display text-2xl md:text-3xl text-foreground">
              {conversion.name ?? 'Untitled Conversion'}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <span className="font-data rounded-md border border-border bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                {isVectorize ? 'Vectorize' : 'Linework'}
              </span>
              <span className="font-data text-xs text-muted-foreground">
                {formatDate(conversion.createdAt)}
              </span>
              <span className="font-data text-xs text-muted-foreground">
                {conversion.assets.length}{' '}
                {conversion.assets.length === 1 ? 'asset' : 'assets'}
              </span>
            </div>
          </div>
        </motion.div>

        {/* ── Section 1: Uploaded Image ─────────────────────────────────── */}
        {conversion.originalImageBase64 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2">
              <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Uploaded Image
              </h2>
              <span className="rounded-full bg-secondary border border-border px-1.5 py-0.5 text-[10px] font-data text-muted-foreground">
                1
              </span>
            </div>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="bg-white flex items-center justify-center p-4 min-h-[200px]">
                <img
                  src={`data:image/png;base64,${conversion.originalImageBase64}`}
                  alt="Original upload"
                  className="mx-auto max-h-[400px] object-contain"
                />
              </div>
              <div className="px-4 py-3 flex items-center gap-2 border-t border-border">
                <span className="font-data text-xs text-muted-foreground mr-auto">
                  original
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  className="gap-1.5 h-7 text-xs"
                  onClick={() =>
                    downloadBase64Image(
                      conversion.originalImageBase64!,
                      buildDownloadFilename(conversion.name ?? 'original', 'png'),
                      'image/png',
                    )
                  }
                >
                  <Download className="h-3 w-3" />
                  Download
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}

        {/* ── Section 2: Result PNGs ────────────────────────────────────── */}
        {pngAssets.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.14 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2">
              <FileImage className="h-3.5 w-3.5 text-muted-foreground" />
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Result PNGs
              </h2>
              <span className="rounded-full bg-secondary border border-border px-1.5 py-0.5 text-[10px] font-data text-muted-foreground">
                {pngAssets.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pngAssets.map((asset, index) => {
                const isVectorised = !!asset.svgContent || !!asset.dxfContent;
                const assetTitle = getAssetTitle(asset, conversion.name);
                return (
                  <motion.div
                    key={asset.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.14 + index * 0.06 }}
                    className="rounded-xl border border-border bg-card overflow-hidden"
                  >
                    {/* Preview */}
                    <div className="bg-white min-h-[200px] flex items-center justify-center p-4">
                      <img
                        src={`data:image/png;base64,${asset.imageBase64}`}
                        alt={`Result ${index + 1}`}
                        className="max-h-[240px] w-full object-contain"
                      />
                    </div>

                    {/* Actions */}
                    <div className="px-4 py-3 border-t border-border space-y-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-data text-xs text-muted-foreground mr-auto">
                          {assetTitle}
                          {isVectorised ? (
                            <span className="ml-2 text-[10px] text-accent/70">
                              · vectorised
                            </span>
                          ) : null}
                        </span>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="gap-1.5 h-7 text-xs"
                          onClick={() =>
                            downloadBase64Image(
                              asset.imageBase64!,
                              buildDownloadFilename(assetTitle, 'png'),
                              'image/png',
                            )
                          }
                        >
                          <Download className="h-3 w-3" />
                          PNG
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="gap-1.5 h-7 text-xs border border-accent/20 hover:border-accent/50 hover:text-accent"
                          onClick={() =>
                            convertPngToWebp(
                              asset.imageBase64!,
                              buildDownloadFilename(assetTitle, 'webp'),
                            )
                          }
                        >
                          <Sparkles className="h-3 w-3" />
                          Convert &rarr; WEBP
                        </Button>
                        {asset.marketplaceStatus === 'listed' ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="gap-1.5 h-7 text-xs border border-orange-200 text-orange-600 hover:border-orange-300 hover:text-orange-700"
                            disabled={unlistMutation.isPending}
                            onClick={() => unlistMutation.mutate(asset.id)}
                          >
                            Marketplace Listed
                          </Button>
                        ) : asset.marketplaceStatus === 'pending_review' ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="gap-1.5 h-7 text-xs border border-amber-200 text-amber-700 hover:border-amber-300 hover:text-amber-800"
                            disabled
                          >
                            Pending Review
                          </Button>
                        ) : asset.marketplaceStatus === 'rejected' ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="gap-1.5 h-7 text-xs border border-red-200 text-red-600 hover:border-red-300 hover:text-red-700"
                            onClick={() => openListDialog(asset)}
                          >
                            Re-submit to Marketplace
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="gap-1.5 h-7 text-xs border border-neutral-200 hover:border-neutral-400"
                            onClick={() => openListDialog(asset)}
                          >
                            List in Marketplace
                          </Button>
                        )}
                      </div>

                      {!isVectorised ? (
                        <VectoriseButtons
                          asset={asset}
                          conversionId={conversion.id}
                          conversionName={conversion.name}
                        />
                      ) : null}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        ) : null}

        {/* ── Section 3: Vector Files ───────────────────────────────────── */}
        {vectorAssets.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Vector Files
              </h2>
              <span className="rounded-full bg-secondary border border-border px-1.5 py-0.5 text-[10px] font-data text-muted-foreground">
                {vectorAssets.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vectorAssets.map((asset, index) => {
                const assetTitle = getAssetTitle(asset, conversion.name);

                return (
                  <motion.div
                    key={asset.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 + index * 0.06 }}
                    className="rounded-xl border border-border bg-card overflow-hidden"
                  >
                  {/* SVG preview */}
                  {asset.svgContent ? (
                    <div className="bg-white min-h-[200px] flex items-center justify-center p-4 overflow-hidden">
                      <div
                        className="max-h-[240px] w-full flex items-center justify-center [&>svg]:max-h-[240px] [&>svg]:w-full [&>svg]:object-contain"
                        dangerouslySetInnerHTML={{ __html: asset.svgContent }}
                      />
                    </div>
                  ) : (
                    <div className="bg-secondary/30 min-h-[100px] flex items-center justify-center p-4 gap-2 text-muted-foreground/50">
                      <FileArchive className="h-8 w-8" />
                      <span className="text-xs">DXF only</span>
                    </div>
                  )}

                  {/* Download actions */}
                  <div className="px-4 py-3 flex flex-wrap items-center gap-2 border-t border-border">
                    <span className="font-data text-xs text-muted-foreground mr-auto">
                      {assetTitle}
                    </span>
                    {asset.svgContent ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="gap-1.5 h-7 text-xs"
                        onClick={() =>
                          downloadText(
                            asset.svgContent!,
                            buildDownloadFilename(assetTitle, 'svg'),
                            'image/svg+xml',
                          )
                        }
                      >
                        <FileCode className="h-3 w-3" />
                        SVG
                      </Button>
                    ) : null}
                    {asset.dxfContent ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="gap-1.5 h-7 text-xs"
                        onClick={() =>
                          downloadText(
                            asset.dxfContent!,
                            buildDownloadFilename(assetTitle, 'dxf'),
                            'application/dxf',
                          )
                        }
                      >
                        <FileType className="h-3 w-3" />
                        DXF
                      </Button>
                    ) : null}
                  </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        ) : null}
      </div>

      <Dialog
        open={!!listingAsset}
        onOpenChange={(open) => {
          if (!open) {
            setListingAsset(null);
          }
        }}
      >
        <DialogContent className="border-[#e3dbcf] bg-[#faf7f0]">
          <DialogHeader>
            <DialogTitle className="text-[24px] font-light uppercase tracking-[-0.04em] text-neutral-900">
              List In Marketplace
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <p className="text-sm leading-6 text-neutral-600">
              Give this shared asset a clear title and category so it can live in the Marketplace as a
              reusable public item.
            </p>

            <Input
              value={listingTitle}
              onChange={(e) => setListingTitle(e.target.value)}
              placeholder="Title"
              className="h-11 border-neutral-200 bg-white"
            />

            <select
              value={listingCategory}
              onChange={(e) => setListingCategory(e.target.value)}
              className="h-11 w-full border border-neutral-200 bg-white px-4 text-sm text-neutral-900"
            >
              {['People', 'Furniture', 'Objects', 'Plants', 'Architecture', 'Decor'].map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <Button
              className="h-11 w-full rounded-none bg-orange-500 text-white hover:bg-orange-600"
              disabled={listMutation.isPending || listingTitle.trim().length < 2}
              onClick={() => {
                if (!listingAsset) return;
                listMutation.mutate({
                  assetId: listingAsset.id,
                  title: listingTitle.trim(),
                  category: listingCategory,
                });
              }}
            >
              {listMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Publish Asset
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
};

export default LibraryDetail;
