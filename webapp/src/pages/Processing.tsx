import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useImageStore } from '@/lib/store';
import { api, ApiError } from '@/lib/api';
import { buildCombinedSelectionTitle, normalizeAssetTitle, stripExtension } from '@/lib/asset-naming';
import { base64ToPngFile, vectorizeRaster } from '@/lib/vectorize';
import type { CreateConversionResponse } from '../../../backend/src/types';

interface LineworkResult {
  results: Array<{ subjectId: number; imageBase64: string }>;
  trialConsumed?: boolean;
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
  const simplificationLevel = useImageStore((s) => s.simplificationLevel);
  const vectorizeMode = useImageStore((s) => s.vectorizeMode);
  const setResultImages = useImageStore((s) => s.setResultImages);
  const setCachedSvg = useImageStore((s) => s.setCachedSvg);
  const setCachedDxf = useImageStore((s) => s.setCachedDxf);

  const [status, setStatus] = useState('uploading');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const startedRef = useRef(false);

  const imageBase64 = imageUri?.split(',')[1] ?? '';

  useEffect(() => {
    if (!flowType || !imageUri) {
      navigate('/', { replace: true });
    }
  }, [flowType, imageUri, navigate]);

  useEffect(() => {
    if (!flowType || !imageUri || startedRef.current) return;
    startedRef.current = true;

    const processPhotoToVectorGenerationFlow = async () => {
      setStatus('analyzing');
      setProgress(15);

      const selectedSubjects = detectedSubjects?.filter((s) => s.selected) ?? [];
      const selectedIds = selectedSubjects.map((s) => s.id);
      const allSubjects = (detectedSubjects ?? []).map(({ id, description }) => ({ id, description }));
      const outputTitle = normalizeAssetTitle(buildCombinedSelectionTitle(detectedSubjects));

      setStatus('generating');
      setProgress(30);

      // Photo-to-Vector Generation: this creates the cleaned linework PNG only.
      // SVG/DXF export vectorization happens later from the Result page.
      const result = await api.post<LineworkResult>('/api/ai/generate-linework', {
        imageBase64,
        subjects: allSubjects,
        selectedSubjects: selectedIds,
        processingMode: 'keep_together',
        outputMode: 'vectorworks_centerline',
        viewAngle: 'perspective',
      });

      setProgress(85);
      setStatus('complete');
      setProgress(100);

      const titledResults = result.results.map((item) => ({
        ...item,
        title: outputTitle,
      }));

      setResultImages(titledResults);

      const store = useImageStore.getState();
      try {
        const saved = await api.post<CreateConversionResponse>('/api/conversions', {
          flowType: flowType,
          name: outputTitle,
          originalImageBase64: store.imageUri?.split(',')[1] ?? undefined,
          assets: titledResults.map((r) => ({
            subjectId: r.subjectId,
            imageBase64: r.imageBase64 || undefined,
            title: r.title,
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

    const processLineworkVectorizeOnlyFlow = async () => {
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

      const uploadData = (await uploadRes.json()) as { data: TraceUploadResult };
      const uploadedBase64 = uploadData.data.imageBase64;
      const outputTitle = normalizeAssetTitle(stripExtension(useImageStore.getState().imageName) || 'vector asset');

      setStatus('vectorizing');
      setProgress(30);

      // Vectorize Linework Only: this skips AI photo generation and immediately
      // creates SVG/DXF from the uploaded drawing.
      const vectorized = await vectorizeRaster(
        base64ToPngFile(uploadedBase64, 'image.png'),
        vectorizeMode,
        simplificationLevel
      );
      const dxfContent = vectorized.dxf;
      const svgContent = vectorized.svg;
      const previewBase64 = vectorized.previewBase64 ?? uploadedBase64;

      setProgress(95);
      setStatus('complete');
      setProgress(100);

      setCachedDxf(0, dxfContent);
      setCachedSvg(0, svgContent);
      setResultImages([{ subjectId: 0, imageBase64: previewBase64, title: outputTitle }]);

      const store = useImageStore.getState();
      try {
        const saved = await api.post<CreateConversionResponse>('/api/conversions', {
          flowType: flowType,
          name: outputTitle,
          originalImageBase64: store.imageUri?.split(',')[1] ?? undefined,
          assets: [
            {
              subjectId: 0,
              imageBase64: previewBase64,
              title: outputTitle,
              svgContent: svgContent || undefined,
              dxfContent: dxfContent || undefined,
            },
          ],
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
          await processPhotoToVectorGenerationFlow();
        } else {
          await processLineworkVectorizeOnlyFlow();
        }
      } catch (err) {
        setQuotaExceeded(err instanceof ApiError && err.status === 402);
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
  }, [flowType, imageUri]);

  const handleRetry = () => {
    setError(null);
    setQuotaExceeded(false);
    setProgress(0);
    startedRef.current = false;
    navigate('/processing', { replace: true });
    window.location.reload();
  };

  if (!flowType || !imageUri) {
    return null;
  }

  return (
    <div className="relative min-h-screen bg-[#f8f8f6] overflow-hidden flex flex-col items-center justify-center">
      {/* Progress bar at bottom */}
      {!error && (
        <div className="absolute bottom-0 left-0 right-0 h-px bg-neutral-200">
          <motion.div
            className="h-full bg-orange-500"
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex flex-col items-center gap-12 px-8 text-center"
      >
        {error ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-8"
          >
            <h2
              className="text-3xl font-light uppercase tracking-[-0.02em] text-neutral-900"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              Processing failed.
            </h2>
            <p className="max-w-xs font-mono text-xs text-neutral-500">{error}</p>
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              {quotaExceeded && (
                <button
                  onClick={() => navigate('/account')}
                  className="flex items-center justify-center gap-3 border border-orange-500 bg-orange-500 px-8 py-4 text-white transition-all hover:bg-orange-600"
                >
                  <span className="font-mono text-xs uppercase tracking-[0.15em]">Upgrade or Buy Credits</span>
                </button>
              )}
              <button
                onClick={handleRetry}
                className="flex items-center justify-center gap-3 border border-neutral-900 bg-neutral-900 px-8 py-4 text-white transition-all hover:bg-neutral-800"
              >
                <span className="font-mono text-xs uppercase tracking-[0.15em]">Try Again</span>
              </button>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Minimal spinning indicator */}
            <div className="relative flex h-20 w-20 items-center justify-center">
              <motion.div
                className="absolute inset-0 rounded-full border border-neutral-200"
                style={{ borderTopColor: '#f97316' }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              />
              <div className="h-2 w-2 rounded-full bg-orange-500" />
            </div>

            {/* Status text */}
            <div className="flex flex-col items-center gap-4">
              <AnimatePresence mode="wait">
                <motion.p
                  key={status}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="font-mono text-xs uppercase tracking-[0.15em] text-neutral-500"
                >
                  {statusMessages[status] ?? 'Processing...'}
                </motion.p>
              </AnimatePresence>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default Processing;
