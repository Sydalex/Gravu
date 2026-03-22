import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  FileCode,
  FileType,
  FileImage,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Layers,
  Eye,
  Check,
  Download,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ExportButton } from '@/components/ExportButton';
import { PageWrapper } from '@/components/PageWrapper';
import { useImageStore, type SimplificationLevel } from '@/lib/store';
import { api } from '@/lib/api';

interface UpdateAssetPayload {
  svgContent?: string;
  dxfContent?: string;
}

/** Convert a base64-encoded PNG string to a File object suitable for FormData. */
function base64ToFile(base64: string, filename: string): File {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new File([bytes], filename, { type: 'image/png' });
}

/** Vectorise PNG via the centerline vectorizer service and return DXF. */
async function vectoriseToDxf(
  imageFile: File,
  simplificationLevel: SimplificationLevel,
): Promise<string> {
  const form = new FormData();
  form.append('image', imageFile);
  form.append('simplification', simplificationLevel);
  const res = await api.raw('/api/convert/vectorise-ai', { method: 'POST', body: form });
  if (!res.ok) {
    const e = await res.json().catch(() => null);
    throw new Error(e?.error?.message ?? 'Vectorisation failed');
  }
  const json = await res.json() as { data: { dxf: string } };
  return json.data.dxf;
}

/** Convert DXF string to SVG via backend. */
async function dxfToSvg(dxf: string): Promise<string> {
  const res = await api.post<{ svg: string }>('/api/convert/dxf-to-svg', { dxf });
  return res.svg;
}

const Result = () => {
  const navigate = useNavigate();
  const flowType = useImageStore((s) => s.flowType);
  const imageUri = useImageStore((s) => s.imageUri);
  const resultImages = useImageStore((s) => s.resultImages);
  const cachedSvg = useImageStore((s) => s.cachedSvg);
  const setCachedSvg = useImageStore((s) => s.setCachedSvg);
  const cachedDxf = useImageStore((s) => s.cachedDxf);
  const setCachedDxf = useImageStore((s) => s.setCachedDxf);
  const simplificationLevel = useImageStore((s) => s.simplificationLevel);
  const savedConversionId = useImageStore((s) => s.savedConversionId);
  const savedAssetIds = useImageStore((s) => s.savedAssetIds);
  const reset = useImageStore((s) => s.reset);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [showOriginal, setShowOriginal] = useState(false);

  // Silently save vector data back to DB (convert once, store forever)
  const patchAssetToDb = useCallback(
    async (subjectId: number, payload: UpdateAssetPayload) => {
      const assetId = savedAssetIds[subjectId];
      if (!savedConversionId || !assetId) return;
      try {
        await api.patch(`/api/conversions/${savedConversionId}/assets/${assetId}`, payload);
      } catch (e) {
        console.warn('Failed to patch asset to DB:', e);
      }
    },
    [savedConversionId, savedAssetIds],
  );

  const downloadBlob = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const downloadText = useCallback(
    (content: string, filename: string, type: string) =>
      downloadBlob(new Blob([content], { type }), filename),
    [downloadBlob],
  );

  // DXF export — primary path, calls the centerline vectorizer endpoint directly
  const dxfMutation = useMutation({
    mutationFn: async (subjectId: number) => {
      const existing = cachedDxf[subjectId];
      if (existing) return { subjectId, dxf: existing };

      const item = resultImages?.find((r) => r.subjectId === subjectId);
      if (!item?.imageBase64) throw new Error('No image data for this subject');

      const dxf = await vectoriseToDxf(
        base64ToFile(item.imageBase64, 'image.png'),
        simplificationLevel,
      );
      return { subjectId, dxf };
    },
    onSuccess: ({ subjectId, dxf }) => {
      setCachedDxf(subjectId, dxf);
      downloadText(dxf, `asset-${subjectId}.dxf`, 'application/dxf');
      void patchAssetToDb(subjectId, { dxfContent: dxf });
    },
  });

  // SVG export — derives from DXF
  const svgMutation = useMutation({
    mutationFn: async (subjectId: number) => {
      const existing = cachedSvg[subjectId];
      if (existing) return { subjectId, svg: existing, dxf: undefined as string | undefined };

      // Get or fetch the DXF first
      let dxf = cachedDxf[subjectId];
      if (!dxf) {
        const item = resultImages?.find((r) => r.subjectId === subjectId);
        if (!item?.imageBase64) throw new Error('No image data for this subject');
        dxf = await vectoriseToDxf(
          base64ToFile(item.imageBase64, 'image.png'),
          simplificationLevel,
        );
      }

      const svg = await dxfToSvg(dxf);
      return { subjectId, svg, dxf };
    },
    onSuccess: ({ subjectId, svg, dxf }) => {
      setCachedSvg(subjectId, svg);
      void patchAssetToDb(subjectId, { svgContent: svg });
      if (dxf) {
        setCachedDxf(subjectId, dxf);
        void patchAssetToDb(subjectId, { dxfContent: dxf });
      }
    },
  });

  // Combined SVG — all subjects (derives from DXF)
  const combinedSvgMutation = useMutation({
    mutationFn: async () => {
      const svgs: string[] = [];
      for (const item of resultImages ?? []) {
        let svg = cachedSvg[item.subjectId];
        if (!svg) {
          // Get or fetch DXF first
          let dxf = cachedDxf[item.subjectId];
          if (!dxf && item.imageBase64) {
            dxf = await vectoriseToDxf(
              base64ToFile(item.imageBase64, 'image.png'),
              simplificationLevel,
            );
            setCachedDxf(item.subjectId, dxf);
            void patchAssetToDb(item.subjectId, { dxfContent: dxf });
          }
          if (dxf) {
            svg = await dxfToSvg(dxf);
            setCachedSvg(item.subjectId, svg);
            void patchAssetToDb(item.subjectId, { svgContent: svg });
          }
        }
        if (svg) svgs.push(svg);
      }
      return svgs;
    },
    onSuccess: (svgs) => {
      if (svgs.length > 0)
        downloadText(
          `<svg xmlns="http://www.w3.org/2000/svg">${svgs.join('')}</svg>`,
          'combined-assets.svg',
          'image/svg+xml',
        );
    },
  });

  // Combined DXF — all subjects (DXF fetched directly)
  const combinedDxfMutation = useMutation({
    mutationFn: async () => {
      const dxfs: string[] = [];
      for (const item of resultImages ?? []) {
        let dxf = cachedDxf[item.subjectId];
        if (!dxf && item.imageBase64) {
          dxf = await vectoriseToDxf(
            base64ToFile(item.imageBase64, 'image.png'),
            simplificationLevel,
          );
          setCachedDxf(item.subjectId, dxf);
          void patchAssetToDb(item.subjectId, { dxfContent: dxf });
        }
        if (dxf) dxfs.push(dxf);
      }
      return dxfs;
    },
    onSuccess: (dxfs) => {
      if (dxfs.length > 0)
        downloadText(dxfs.join('\n'), 'combined-assets.dxf', 'application/dxf');
    },
  });

  useEffect(() => {
    if (!resultImages || resultImages.length === 0) navigate('/', { replace: true });
  }, [resultImages, navigate]);

  if (!resultImages || resultImages.length === 0) return null;

  const current = resultImages[currentIndex];
  const isVectorizeOnly = flowType === 'vectorize_only';
  const hasMultiple = resultImages.length > 1;

  const handleExportSvg = () => {
    if (cachedSvg[current.subjectId]) {
      downloadText(cachedSvg[current.subjectId], `asset-${current.subjectId}.svg`, 'image/svg+xml');
    } else {
      svgMutation.mutate(current.subjectId, {
        onSuccess: ({ svg }) =>
          downloadText(svg, `asset-${current.subjectId}.svg`, 'image/svg+xml'),
      });
    }
  };

  const handleExportDxf = () => {
    if (cachedDxf[current.subjectId]) {
      downloadText(cachedDxf[current.subjectId], `asset-${current.subjectId}.dxf`, 'application/dxf');
    } else {
      dxfMutation.mutate(current.subjectId);
    }
  };

  const handleSavePng = () => {
    if (isVectorizeOnly && cachedSvg[current.subjectId]) {
      const svg = cachedSvg[current.subjectId];
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 800;
        canvas.height = img.naturalHeight || 600;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) downloadBlob(blob, `asset-${current.subjectId}.png`);
          });
        }
        URL.revokeObjectURL(url);
      };
      img.src = url;
    } else if (current.imageBase64) {
      const bytes = Uint8Array.from(atob(current.imageBase64), (c) => c.charCodeAt(0));
      downloadBlob(new Blob([bytes], { type: 'image/png' }), `asset-${current.subjectId}.png`);
    }
  };

  const renderResult = () => {
    if (showOriginal && imageUri)
      return (
        <img 
          src={imageUri} 
          alt="Original" 
          className="mx-auto max-h-[380px] w-full object-contain rounded-lg" 
        />
      );

    if (isVectorizeOnly && cachedSvg[current.subjectId])
      return (
        <div
          className="mx-auto flex max-h-[380px] items-center justify-center overflow-auto [&_svg]:max-w-full [&_svg]:h-auto"
          dangerouslySetInnerHTML={{ __html: cachedSvg[current.subjectId] }}
        />
      );

    if (current.imageBase64)
      return (
        <img
          src={`data:image/png;base64,${current.imageBase64}`}
          alt={`Result ${current.subjectId}`}
          className="mx-auto max-h-[380px] w-full object-contain rounded-lg"
        />
      );

    if (cachedSvg[current.subjectId])
      return (
        <div
          className="mx-auto flex max-h-[380px] items-center justify-center overflow-auto [&_svg]:max-w-full [&_svg]:h-auto"
          dangerouslySetInnerHTML={{ __html: cachedSvg[current.subjectId] }}
        />
      );

    return (
      <div className="flex h-[280px] items-center justify-center text-muted-foreground font-mono text-sm">
        No preview available
      </div>
    );
  };

  return (
    <PageWrapper className="flex flex-col items-center px-4 pt-20 pb-8 md:pt-24 md:pb-12">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="space-y-1.5"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 shadow">
            <Check className="h-3 w-3 text-primary" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {isVectorizeOnly ? 'Vectorization Complete' : 'Generation Complete'}
            </span>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-display text-foreground text-4xl md:text-5xl tracking-normal font-bold">
                Your Asset
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {hasMultiple
                  ? `Viewing ${currentIndex + 1} of ${resultImages.length} subjects`
                  : 'Ready to export'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onPointerDown={() => setShowOriginal(true)}
              onPointerUp={() => setShowOriginal(false)}
              onPointerLeave={() => setShowOriginal(false)}
              className="gap-2 text-xs text-muted-foreground shrink-0"
            >
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Hold to compare</span>
              <span className="sm:hidden">Compare</span>
            </Button>
          </div>
        </motion.div>

        {/* Result Display */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="relative overflow-hidden rounded-2xl border border-white/8 bg-card"
        >
          {/* Subtle checkerboard pattern for transparency indication */}
          <div 
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(45deg, currentColor 25%, transparent 25%), 
                               linear-gradient(-45deg, currentColor 25%, transparent 25%), 
                               linear-gradient(45deg, transparent 75%, currentColor 75%), 
                               linear-gradient(-45deg, transparent 75%, currentColor 75%)`,
              backgroundSize: '16px 16px',
              backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
            }}
          />
          
          {hasMultiple && (
            <>
              <button
                onClick={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
                disabled={currentIndex === 0}
                className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl border border-white/10 bg-background/80 text-foreground backdrop-blur-sm transition-all disabled:opacity-30 hover:bg-background hover:border-white/20"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => setCurrentIndex((i) => Math.min(i + 1, resultImages.length - 1))}
                disabled={currentIndex === resultImages.length - 1}
                className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl border border-white/10 bg-background/80 text-foreground backdrop-blur-sm transition-all disabled:opacity-30 hover:bg-background hover:border-white/20"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
          
          <AnimatePresence mode="wait">
            <motion.div
              key={`${currentIndex}-${showOriginal}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative min-h-[320px] p-6 pb-20"
            >
              {renderResult()}
            </motion.div>
          </AnimatePresence>

          {/* Frosted glass metadata bar - matches Upload page */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center gap-3 border-t border-white/5 bg-background/70 px-4 py-3 backdrop-blur-xl">
            <Download className="h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-xs text-foreground">
                asset-{current.subjectId}
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">
                {showOriginal ? 'Original' : isVectorizeOnly ? 'Vector Preview' : 'Linework'}
              </p>
            </div>
            <span className="shrink-0 rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
              Ready
            </span>
          </div>
        </motion.div>

        {/* Thumbnail Strip */}
        {hasMultiple && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex gap-2 overflow-x-auto pb-2 scrollbar-none"
          >
            {resultImages.map((item, i) => (
              <button
                key={item.subjectId}
                onClick={() => setCurrentIndex(i)}
                className={`flex-shrink-0 overflow-hidden rounded-xl border-2 transition-all ${
                  i === currentIndex 
                    ? 'border-primary ring-2 ring-primary/20' 
                    : 'border-white/8 opacity-60 hover:opacity-100 hover:border-white/16'
                }`}
              >
                {item.imageBase64 ? (
                  <img
                    src={`data:image/png;base64,${item.imageBase64}`}
                    alt={`Subject ${i + 1}`}
                    className="h-16 w-16 object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center bg-card text-xs text-muted-foreground font-mono">
                    {i + 1}
                  </div>
                )}
              </button>
            ))}
          </motion.div>
        )}

        {/* Export Actions */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="space-y-4"
        >
          {/* Section label */}
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Export Formats
          </p>

          {/* Primary export - DXF (most valuable for target users) */}
          <Button
            onClick={handleExportDxf}
            disabled={dxfMutation.isPending && dxfMutation.variables === current.subjectId}
            className="group relative min-h-[52px] w-full overflow-hidden rounded-xl bg-primary text-primary-foreground font-semibold transition-all hover:bg-primary/90 hover:shadow-[0_0_24px_hsl(var(--primary)_/_0.25)]"
          >
            <span className="pointer-events-none absolute inset-0 translate-x-[-200%] skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-[200%]" />
            {dxfMutation.isPending && dxfMutation.variables === current.subjectId ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                Exporting...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <FileType className="h-5 w-5" />
                Download DXF
                <span className="ml-1 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-medium">CAD</span>
              </span>
            )}
          </Button>

          {/* Secondary exports */}
          <div className="grid grid-cols-2 gap-2">
            <ExportButton
              label="SVG"
              icon={FileCode}
              loading={svgMutation.isPending && svgMutation.variables === current.subjectId}
              onClick={handleExportSvg}
              className="w-full"
            />
            <ExportButton 
              label="PNG" 
              icon={FileImage} 
              onClick={handleSavePng} 
              className="w-full" 
            />
          </div>

          {hasMultiple && (
            <>
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-border" />
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  All Subjects
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ExportButton
                  label="All DXF"
                  icon={Layers}
                  variant="accent"
                  loading={combinedDxfMutation.isPending}
                  onClick={() => combinedDxfMutation.mutate()}
                  className="w-full"
                />
                <ExportButton
                  label="All SVG"
                  icon={Layers}
                  variant="accent"
                  loading={combinedSvgMutation.isPending}
                  onClick={() => combinedSvgMutation.mutate()}
                  className="w-full"
                />
              </div>
            </>
          )}

          {/* Export error messages */}
          {(dxfMutation.isError || combinedDxfMutation.isError || svgMutation.isError || combinedSvgMutation.isError) && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {dxfMutation.isError && (
                <p>DXF export failed: {dxfMutation.error instanceof Error ? dxfMutation.error.message : 'Unknown error'}</p>
              )}
              {combinedDxfMutation.isError && (
                <p>Combined DXF export failed: {combinedDxfMutation.error instanceof Error ? combinedDxfMutation.error.message : 'Unknown error'}</p>
              )}
              {svgMutation.isError && (
                <p>SVG export failed: {svgMutation.error instanceof Error ? svgMutation.error.message : 'Unknown error'}</p>
              )}
              {combinedSvgMutation.isError && (
                <p>Combined SVG export failed: {combinedSvgMutation.error instanceof Error ? combinedSvgMutation.error.message : 'Unknown error'}</p>
              )}
            </div>
          )}

          <Button
            variant="secondary"
            onClick={() => { reset(); navigate('/'); }}
            className="min-h-[44px] w-full rounded-xl border border-white/8 bg-card hover:border-white/16 hover:bg-card/80 transition-all"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Convert Another
          </Button>
        </motion.div>
      </div>
    </PageWrapper>
  );
};

export default Result;
