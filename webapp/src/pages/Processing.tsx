import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  const simplificationLevel = useImageStore((s) => s.simplificationLevel);
  const setResultImages = useImageStore((s) => s.setResultImages);
  const setCachedSvg = useImageStore((s) => s.setCachedSvg);
  const setCachedDxf = useImageStore((s) => s.setCachedDxf);

  const [status, setStatus] = useState('uploading');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
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

    const processFullFlow = async () => {
      setStatus('analyzing');
      setProgress(15);

      const selectedSubjects = detectedSubjects?.filter((s) => s.selected) ?? [];
      const selectedIds = selectedSubjects.map((s) => s.id);
      const allSubjects = (detectedSubjects ?? []).map(({ id, description }) => ({ id, description }));

      setStatus('generating');
      setProgress(30);

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

      const uploadData = (await uploadRes.json()) as { data: TraceUploadResult };
      const uploadedBase64 = uploadData.data.imageBase64;

      setStatus('vectorizing');
      setProgress(30);

      const imageBytes = Uint8Array.from(atob(uploadedBase64), (c) => c.charCodeAt(0));
      const imageBlob = new File([imageBytes], 'image.png', { type: 'image/png' });

      const vectorForm = new FormData();
      vectorForm.append('image', imageBlob);
      vectorForm.append('simplification', simplificationLevel);

      const vectorRes = await api.raw('/api/convert/vectorise-ai', {
        method: 'POST',
        body: vectorForm,
      });

      if (!vectorRes.ok) {
        const errJson = await vectorRes.json().catch(() => null);
        throw new Error(errJson?.error?.message ?? 'Vectorization failed');
      }

      const vectorData = (await vectorRes.json()) as { data: { dxf: string } };
      const dxfContent = vectorData.data.dxf;

      setStatus('converting');
      setProgress(70);

      const { svg: svgContent } = await api.post<{ svg: string }>('/api/convert/dxf-to-svg', { dxf: dxfContent });

      setProgress(95);
      setStatus('complete');
      setProgress(100);

      setCachedDxf(0, dxfContent);
      setCachedSvg(0, svgContent);
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
            <button
              onClick={handleRetry}
              className="flex items-center justify-center gap-3 border border-neutral-900 bg-neutral-900 px-8 py-4 text-white transition-all hover:bg-neutral-800"
            >
              <span className="font-mono text-xs uppercase tracking-[0.15em]">Try Again</span>
            </button>
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

              <span className="font-mono text-[10px] text-neutral-400">
                {Math.round(progress)}%
              </span>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default Processing;
