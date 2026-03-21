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
import { PageWrapper } from '@/components/PageWrapper';
import { useImageStore } from '@/lib/store';
import { api } from '@/lib/api';
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
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
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
}

const VectoriseButtons = ({ asset, conversionId }: VectoriseButtonsProps) => {
  const queryClient = useQueryClient();
  const simplificationLevel = useImageStore((s) => s.simplificationLevel);
  const [convertingDxf, setConvertingDxf] = useState<boolean>(false);
  const [convertingSvg, setConvertingSvg] = useState<boolean>(false);

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
      const bytes = Uint8Array.from(atob(asset.imageBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'image/png' });
      const formData = new FormData();
      formData.append('image', blob, `asset-${asset.subjectId}.png`);
      formData.append('simplification', simplificationLevel);
      const res = await api.raw('/api/convert/vectorise-ai', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Vectorise failed');
      const json = (await res.json()) as { data: { dxf: string } };
      const dxfText = json.data.dxf;
      await saveAsset.mutateAsync({ dxfContent: dxfText });
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
      const bytes = Uint8Array.from(atob(asset.imageBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: 'image/png' });
      const formData = new FormData();
      formData.append('image', blob, `asset-${asset.subjectId}.png`);
      formData.append('simplification', simplificationLevel);
      const dxfRes = await api.raw('/api/convert/vectorise-ai', {
        method: 'POST',
        body: formData,
      });
      if (!dxfRes.ok) throw new Error('Vectorise failed');
      const dxfJson = (await dxfRes.json()) as { data: { dxf: string } };
      const dxfText = dxfJson.data.dxf;
      const svgData = await api.post<{ svg: string }>('/api/convert/dxf-to-svg', { dxf: dxfText });
      const svg = svgData.svg;
      await saveAsset.mutateAsync({ svgContent: svg, dxfContent: dxfText });
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

  const { data: conversion, isLoading, isError } = useQuery({
    queryKey: ['conversion', id],
    queryFn: () => api.get<ConversionDetail>(`/api/conversions/${id}`),
    enabled: !!id,
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
          <Button variant="secondary" onClick={() => navigate('/library')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Library
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
            onClick={() => navigate('/library')}
            className="gap-2 text-muted-foreground hover:text-foreground -ml-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Library
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
                      'original.png',
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
                          Subject {asset.subjectId}
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
                              `asset-${asset.subjectId}.png`,
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
                              `asset-${asset.subjectId}.webp`,
                            )
                          }
                        >
                          <Sparkles className="h-3 w-3" />
                          Convert &rarr; WEBP
                        </Button>
                      </div>

                      {!isVectorised ? (
                        <VectoriseButtons asset={asset} conversionId={conversion.id} />
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
              {vectorAssets.map((asset, index) => (
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
                      Subject {asset.subjectId}
                    </span>
                    {asset.svgContent ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="gap-1.5 h-7 text-xs"
                        onClick={() =>
                          downloadText(
                            asset.svgContent!,
                            `asset-${asset.subjectId}.svg`,
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
                            `asset-${asset.subjectId}.dxf`,
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
              ))}
            </div>
          </motion.div>
        ) : null}
      </div>
    </PageWrapper>
  );
};

export default LibraryDetail;
