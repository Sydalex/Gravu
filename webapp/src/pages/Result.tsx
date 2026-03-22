import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Eye, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageWrapper } from '@/components/PageWrapper';
import { useImageStore, type SimplificationLevel } from '@/lib/store';
import { api } from '@/lib/api';

interface UpdateAssetPayload {
  svgContent?: string;
  dxfContent?: string;
}

function base64ToFile(base64: string, filename: string): File {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new File([bytes], filename, { type: 'image/png' });
}

async function vectoriseToDxf(imageFile: File, simplificationLevel: SimplificationLevel): Promise<string> {
  const form = new FormData();
  form.append('image', imageFile);
  form.append('simplification', simplificationLevel);
  const res = await api.raw('/api/convert/vectorise-ai', { method: 'POST', body: form });
  if (!res.ok) {
    const e = await res.json().catch(() => null);
    throw new Error(e?.error?.message ?? 'Vectorisation failed');
  }
  const json = (await res.json()) as { data: { dxf: string } };
  return json.data.dxf;
}

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
    [savedConversionId, savedAssetIds]
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
    (content: string, filename: string, type: string) => downloadBlob(new Blob([content], { type }), filename),
    [downloadBlob]
  );

  const dxfMutation = useMutation({
    mutationFn: async (subjectId: number) => {
      const existing = cachedDxf[subjectId];
      if (existing) return { subjectId, dxf: existing };
      const item = resultImages?.find((r) => r.subjectId === subjectId);
      if (!item?.imageBase64) throw new Error('No image data for this subject');
      const dxf = await vectoriseToDxf(base64ToFile(item.imageBase64, 'image.png'), simplificationLevel);
      return { subjectId, dxf };
    },
    onSuccess: ({ subjectId, dxf }) => {
      setCachedDxf(subjectId, dxf);
      downloadText(dxf, `asset-${subjectId}.dxf`, 'application/dxf');
      void patchAssetToDb(subjectId, { dxfContent: dxf });
    },
  });

  const svgMutation = useMutation({
    mutationFn: async (subjectId: number) => {
      const existing = cachedSvg[subjectId];
      if (existing) return { subjectId, svg: existing, dxf: undefined as string | undefined };
      let dxf = cachedDxf[subjectId];
      if (!dxf) {
        const item = resultImages?.find((r) => r.subjectId === subjectId);
        if (!item?.imageBase64) throw new Error('No image data for this subject');
        dxf = await vectoriseToDxf(base64ToFile(item.imageBase64, 'image.png'), simplificationLevel);
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
        onSuccess: ({ svg }) => downloadText(svg, `asset-${current.subjectId}.svg`, 'image/svg+xml'),
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
      img.crossOrigin = 'anonymous';
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
      return <img src={imageUri} alt="Original" className="mx-auto max-h-[400px] w-full object-contain" />;

    if (isVectorizeOnly && cachedSvg[current.subjectId])
      return (
        <div
          className="mx-auto flex max-h-[400px] items-center justify-center overflow-auto [&_svg]:max-w-full [&_svg]:h-auto"
          dangerouslySetInnerHTML={{ __html: cachedSvg[current.subjectId] }}
        />
      );

    if (current.imageBase64)
      return (
        <img
          src={`data:image/png;base64,${current.imageBase64}`}
          alt={`Result ${current.subjectId}`}
          className="mx-auto max-h-[400px] w-full object-contain"
        />
      );

    if (cachedSvg[current.subjectId])
      return (
        <div
          className="mx-auto flex max-h-[400px] items-center justify-center overflow-auto [&_svg]:max-w-full [&_svg]:h-auto"
          dangerouslySetInnerHTML={{ __html: cachedSvg[current.subjectId] }}
        />
      );

    return (
      <div className="flex h-[300px] items-center justify-center font-mono text-xs text-neutral-400">
        No preview available
      </div>
    );
  };

  return (
    <PageWrapper className="flex flex-col items-center px-6 pt-20 pb-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400 mb-3">
            {isVectorizeOnly ? '03 — Vectorization Complete' : '04 — Generation Complete'}
          </p>
          <div className="flex items-end justify-between gap-4">
            <h1
              className="text-4xl md:text-5xl font-light uppercase tracking-[-0.02em] leading-[1.1] text-neutral-900"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              <span data-bird-perch="result">Your</span> asset.
            </h1>
            <button
              onPointerDown={() => setShowOriginal(true)}
              onPointerUp={() => setShowOriginal(false)}
              onPointerLeave={() => setShowOriginal(false)}
              className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              <Eye className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Hold to compare</span>
            </button>
          </div>
          {hasMultiple && (
            <p className="mt-2 font-mono text-[10px] text-neutral-400">
              Viewing {currentIndex + 1} of {resultImages.length}
            </p>
          )}
        </motion.div>

        {/* Result Display */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="relative overflow-hidden border border-neutral-200 bg-white"
        >
          {hasMultiple && (
            <>
              <button
                onClick={() => setCurrentIndex((i) => Math.max(i - 1, 0))}
                disabled={currentIndex === 0}
                className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center border border-neutral-200 bg-white text-neutral-600 transition-all disabled:opacity-30 hover:bg-neutral-50"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => setCurrentIndex((i) => Math.min(i + 1, resultImages.length - 1))}
                disabled={currentIndex === resultImages.length - 1}
                className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center border border-neutral-200 bg-white text-neutral-600 transition-all disabled:opacity-30 hover:bg-neutral-50"
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
              className="relative min-h-[350px] p-6"
            >
              {renderResult()}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Thumbnail Strip */}
        {hasMultiple && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-4 flex gap-2 overflow-x-auto pb-2"
          >
            {resultImages.map((item, i) => (
              <button
                key={item.subjectId}
                onClick={() => setCurrentIndex(i)}
                className={`flex-shrink-0 overflow-hidden border-2 transition-all ${
                  i === currentIndex ? 'border-orange-500' : 'border-neutral-200 opacity-60 hover:opacity-100'
                }`}
              >
                {item.imageBase64 ? (
                  <img
                    src={`data:image/png;base64,${item.imageBase64}`}
                    alt={`Subject ${i + 1}`}
                    className="h-16 w-16 object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center bg-neutral-100 font-mono text-xs text-neutral-400">
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
          className="mt-8 space-y-4"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-neutral-400">
            Export Formats
          </p>

          {/* Primary DXF export */}
          <button
            onClick={handleExportDxf}
            disabled={dxfMutation.isPending && dxfMutation.variables === current.subjectId}
            className="flex w-full items-center justify-center gap-3 border border-orange-500 bg-orange-500 px-6 py-4 text-white transition-all hover:bg-orange-600 disabled:opacity-50"
          >
            {dxfMutation.isPending && dxfMutation.variables === current.subjectId ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="font-mono text-xs uppercase tracking-[0.15em]">Exporting...</span>
              </>
            ) : (
              <span className="font-mono text-xs uppercase tracking-[0.15em]">Download DXF (CAD)</span>
            )}
          </button>

          {/* Secondary exports */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleExportSvg}
              disabled={svgMutation.isPending && svgMutation.variables === current.subjectId}
              className="flex items-center justify-center gap-2 border border-neutral-300 bg-transparent px-4 py-3 text-neutral-700 transition-all hover:border-neutral-400 disabled:opacity-50"
            >
              {svgMutation.isPending && svgMutation.variables === current.subjectId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className="font-mono text-xs uppercase tracking-[0.1em]">SVG</span>
              )}
            </button>
            <button
              onClick={handleSavePng}
              className="flex items-center justify-center gap-2 border border-neutral-300 bg-transparent px-4 py-3 text-neutral-700 transition-all hover:border-neutral-400"
            >
              <span className="font-mono text-xs uppercase tracking-[0.1em]">PNG</span>
            </button>
          </div>

          {/* Horizontal rule */}
          <div className="h-px bg-neutral-200" />

          {/* Convert another */}
          <button
            onClick={() => {
              reset();
              navigate('/');
            }}
            className="flex w-full items-center justify-center gap-3 border border-neutral-300 bg-transparent px-6 py-4 text-neutral-700 transition-all hover:border-neutral-400"
          >
            <span className="font-mono text-xs uppercase tracking-[0.15em]">Convert Another</span>
          </button>
        </motion.div>
      </div>
    </PageWrapper>
  );
};

export default Result;
