import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useImageStore } from '@/lib/store';
import { api, ApiError } from '@/lib/api';
import type { CreateConversionResponse } from '../../../backend/src/types';

interface LineworkResult {
  results: Array<{ subjectId: number; imageBase64: string }>;
}

interface TraceUploadResult {
  imageBase64: string;
}

const statusMessages: Record<string, string> = {
  uploading: 'Uploading image...',
  analyzing: 'Analyzing subjects...',
  generating: 'Generating linework...',
  vectorizing: 'Vectorizing linework...',
  converting: 'Converting formats...',
  complete: 'Complete!',
};

const Processing = () => {
  const navigate = useNavigate();
  const flowType = useImageStore((s) => s.flowType);
  const imageUri = useImageStore((s) => s.imageUri);
  const imageFile = useImageStore((s) => s.imageFile);
  const detectedSubjects = useImageStore((s) => s.detectedSubjects);
  const viewAngle = useImageStore((s) => s.viewAngle);
  const customViewDescription = useImageStore((s) => s.customViewDescription);
  const processingMode = useImageStore((s) => s.processingMode);
  const simplificationLevel = useImageStore((s) => s.simplificationLevel);
  const setResultImages = useImageStore((s) => s.setResultImages);
  const setCachedSvg = useImageStore((s) => s.setCachedSvg);
  const setCachedDxf = useImageStore((s) => s.setCachedDxf);

  const [status, setStatus] = useState('uploading');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const imageBase64 = imageUri?.split(',')[1] ?? '';

  // Redirect guard
  useEffect(() => {
    if (!flowType || !imageUri) {
      navigate('/', { replace: true });
    }
  }, [flowType, imageUri, navigate]);

  // Main processing effect
  useEffect(() => {
    if (!flowType || !imageUri || startedRef.current) return;
    startedRef.current = true;

    const processFullFlow = async () => {
      setStatus('analyzing');
      setProgress(15);

      const selectedSubjects =
        detectedSubjects?.filter((s) => s.selected) ?? [];
      const selectedIds = selectedSubjects.map((s) => s.id);
      const allSubjects = (detectedSubjects ?? []).map(({ id, description }) => ({ id, description }));

      setStatus('generating');
      setProgress(30);

      const result = await api.post<LineworkResult>(
        '/api/ai/generate-linework',
        {
          imageBase64,
          subjects: allSubjects,
          selectedSubjects: selectedIds,
          processingMode,
          outputMode: 'vectorworks_centerline',
          viewAngle,
          customViewDescription:
            viewAngle === 'custom' ? customViewDescription : undefined,
        }
      );

      setProgress(85);
      setStatus('complete');
      setProgress(100);

      setResultImages(result.results);

      const store = useImageStore.getState();
      try {
        const saved = await api.post<CreateConversionResponse>('/api/conversions', {
          flowType: flowType,
          name: store.imageName ?? undefined,
          originalImageBase64: store.imageUri?.split(',')[1] ?? undefined,
          assets: result.results.map((r) => ({
            subjectId: r.subjectId,
            imageBase64: r.imageBase64 || undefined,
          })),
        });
        const assetIds: Record<number, string> = {};
        for (const asset of saved.assets) {
          assetIds[asset.subjectId] = asset.id;
        }
        useImageStore.getState().setSavedConversion(saved.id, assetIds);
      } catch (e) {
        console.warn('Failed to save conversion:', e);
      }

      await new Promise((r) => setTimeout(r, 600));
      navigate('/result', { replace: true });
    };

    const processVectorizeFlow = async () => {
      setStatus('uploading');
      setProgress(10);

      const uploadForm = new FormData();
      if (imageFile) {
        uploadForm.append('file', imageFile);
      }

      const uploadRes = await api.raw('/api/trace/upload', {
        method: 'POST',
        body: uploadForm,
      });

      if (!uploadRes.ok) {
        const errJson = await uploadRes.json().catch(() => null);
        throw new Error(errJson?.error?.message ?? 'Upload failed');
      }

      const uploadData = (await uploadRes.json()) as {
        data: TraceUploadResult;
      };
      const uploadedBase64 = uploadData.data.imageBase64;

      // Step 1: AI vectorization → DXF
      setStatus('vectorizing');
      setProgress(30);

      const imageBytes = Uint8Array.from(atob(uploadedBase64), (c) =>
        c.charCodeAt(0)
      );
      const imageBlob = new File([imageBytes], 'image.png', {
        type: 'image/png',
      });

      const vectorForm = new FormData();
      vectorForm.append('image', imageBlob);
      vectorForm.append('simplification', simplificationLevel);

      const vectorRes = await api.raw('/api/convert/vectorise-ai', {
        method: 'POST',
        body: vectorForm,
      });

      if (!vectorRes.ok) {
        const errJson = await vectorRes.json().catch(() => null);
        throw new Error(
          errJson?.error?.message ?? 'Vectorization failed'
        );
      }

      const vectorData = (await vectorRes.json()) as {
        data: { dxf: string };
      };
      const dxfContent = vectorData.data.dxf;

      // Step 2: Convert DXF → SVG for display
      setStatus('converting');
      setProgress(70);

      const { svg: svgContent } = await api.post<{ svg: string }>(
        '/api/convert/dxf-to-svg',
        { dxf: dxfContent }
      );

      setProgress(95);
      setStatus('complete');
      setProgress(100);

      setCachedDxf(0, dxfContent);
      setCachedSvg(0, svgContent);
      // Pass the uploaded PNG base64 so the original image shows on the Result page
      setResultImages([{ subjectId: 0, imageBase64: uploadedBase64 }]);

      const store = useImageStore.getState();
      try {
        const saved = await api.post<CreateConversionResponse>('/api/conversions', {
          flowType: flowType,
          name: store.imageName ?? undefined,
          originalImageBase64: store.imageUri?.split(',')[1] ?? undefined,
          assets: [{ subjectId: 0, svgContent: svgContent || undefined, dxfContent: dxfContent || undefined }],
        });
        const assetIds: Record<number, string> = {};
        for (const asset of saved.assets) {
          assetIds[asset.subjectId] = asset.id;
        }
        useImageStore.getState().setSavedConversion(saved.id, assetIds);
      } catch (e) {
        console.warn('Failed to save conversion:', e);
      }

      await new Promise((r) => setTimeout(r, 600));
      navigate('/result', { replace: true });
    };

    const run = async () => {
      try {
        if (flowType === 'full') {
          await processFullFlow();
        } else {
          await processVectorizeFlow();
        }
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'An unexpected error occurred';
        setError(message);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowType, imageUri]);

  const handleRetry = () => {
    setError(null);
    setProgress(0);
    startedRef.current = false;
    navigate('/processing', { replace: true });
    window.location.reload();
  };

  if (!flowType || !imageUri) {
    return null;
  }

  return (
    <div className="relative min-h-screen bg-background overflow-hidden flex flex-col items-center justify-center">
      {/* Subtle drifting particle dots */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-0.5 w-0.5 rounded-full bg-accent/20"
            style={{
              left: `${10 + (i * 7.5) % 85}%`,
              top: `${15 + (i * 11) % 70}%`,
            }}
            animate={{
              y: [0, -30, 0],
              opacity: [0.2, 0.6, 0.2],
            }}
            transition={{
              duration: 4 + (i % 3),
              repeat: Infinity,
              delay: i * 0.4,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Thin bottom progress bar */}
      {!error ? (
        <div className="absolute bottom-0 left-0 right-0 h-px bg-border/40">
          <motion.div
            className="h-full bg-accent shadow-[0_0_8px_hsl(160_84%_39%_/_0.6)]"
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      ) : null}

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex flex-col items-center gap-10 px-8 text-center"
      >
        {error ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-6"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-destructive/20 bg-destructive/10">
              <AlertTriangle className="h-9 w-9 text-destructive" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                Processing Failed
              </h2>
              <p className="max-w-xs text-sm text-muted-foreground">{error}</p>
            </div>
            <Button
              onClick={handleRetry}
              className="group relative min-h-[44px] overflow-hidden rounded-xl bg-accent px-6 text-accent-foreground font-semibold hover:bg-accent/90 hover:shadow-[0_0_24px_hsl(160_84%_39%_/_0.3)]"
            >
              <span className="pointer-events-none absolute inset-0 translate-x-[-200%] skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-[200%]" />
              <RotateCcw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </motion.div>
        ) : (
          <>
            {/* Concentric rotating rings */}
            <div className="relative flex h-28 w-28 items-center justify-center">
              {/* Outer ring — slowest */}
              <motion.div
                className="absolute inset-0 rounded-full border border-accent/20"
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                style={{
                  borderTopColor: 'hsl(160 84% 39% / 0.6)',
                  borderRightColor: 'transparent',
                  borderBottomColor: 'transparent',
                  borderLeftColor: 'transparent',
                }}
              />
              {/* Mid ring — medium */}
              <motion.div
                className="absolute inset-3 rounded-full border border-accent/15"
                animate={{ rotate: -360 }}
                transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
                style={{
                  borderTopColor: 'transparent',
                  borderRightColor: 'hsl(160 84% 39% / 0.5)',
                  borderBottomColor: 'transparent',
                  borderLeftColor: 'transparent',
                }}
              />
              {/* Inner ring — fastest */}
              <motion.div
                className="absolute inset-6 rounded-full border border-accent/10"
                animate={{ rotate: 360 }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                style={{
                  borderTopColor: 'hsl(160 84% 39% / 0.8)',
                  borderRightColor: 'transparent',
                  borderBottomColor: 'transparent',
                  borderLeftColor: 'transparent',
                }}
              />
              {/* Center dot */}
              <div className="h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_hsl(160_84%_39%_/_0.8)] animate-glow-pulse" />
            </div>

            {/* Animated status text — slides up on change */}
            <div className="flex flex-col items-center gap-3">
              <AnimatePresence mode="wait">
                <motion.p
                  key={status}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="font-mono text-sm tracking-wide text-muted-foreground"
                >
                  {statusMessages[status] ?? 'Processing...'}
                </motion.p>
              </AnimatePresence>

              {/* Progress percentage */}
              <motion.span
                className="font-mono text-xs text-muted-foreground/50"
                key={`pct-${Math.round(progress)}`}
              >
                {Math.round(progress)}%
              </motion.span>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default Processing;
