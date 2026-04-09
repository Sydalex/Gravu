import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Crown, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageWrapper } from '@/components/PageWrapper';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { useImageStore, type SimplificationLevel, type VectorizeMode } from '@/lib/store';
import type { SubscriptionStatus } from '../../../backend/src/types';

const FULL_FLOW_MAX_DIMENSION = 1600;
const VECTORIZE_FLOW_MAX_DIMENSION = 2048;
const MAX_PROCESSED_UPLOAD_BYTES = 18 * 1024 * 1024;

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const stripExtension = (name: string) => name.replace(/\.[^/.]+$/, '');

const readFileAsDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read image data.'));
    reader.readAsDataURL(file);
  });

const loadImageElement = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to open the selected image.'));
    };

    img.src = objectUrl;
  });

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to prepare the upload image.'));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });

const optimizeUploadImage = async (file: File, flowType: 'full' | 'vectorize_only') => {
  const image = await loadImageElement(file);
  const maxDimension =
    flowType === 'full' ? FULL_FLOW_MAX_DIMENSION : VECTORIZE_FLOW_MAX_DIMENSION;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Failed to prepare the upload canvas.');
  }

  context.drawImage(image, 0, 0, width, height);

  const originalBase = stripExtension(file.name) || 'upload';
  const preferredType = flowType === 'full' ? 'image/jpeg' : 'image/png';
  const preferredBlob = await canvasToBlob(
    canvas,
    preferredType,
    preferredType === 'image/jpeg' ? 0.9 : undefined
  );

  let chosenBlob = preferredBlob;
  let chosenType = preferredType;

  if (preferredBlob.size > MAX_PROCESSED_UPLOAD_BYTES && flowType === 'vectorize_only') {
    const jpegFallback = await canvasToBlob(canvas, 'image/jpeg', 0.92);
    if (jpegFallback.size < preferredBlob.size) {
      chosenBlob = jpegFallback;
      chosenType = 'image/jpeg';
    }
  }

  if (chosenBlob.size > MAX_PROCESSED_UPLOAD_BYTES) {
    throw new Error('This image is still too large after optimization. Please use a smaller file.');
  }

  const optimizedFile = new File(
    [chosenBlob],
    `${originalBase}.${chosenType === 'image/png' ? 'png' : 'jpg'}`,
    { type: chosenType, lastModified: Date.now() }
  );

  return {
    uri: await readFileAsDataUrl(optimizedFile),
    file: optimizedFile,
    sizeLabel: formatSize(optimizedFile.size),
  };
};

const simplificationOptions: Array<{ value: SimplificationLevel; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'mid', label: 'Mid' },
  { value: 'high', label: 'High' },
];

const vectorizeModeOptions: Array<{ value: VectorizeMode; label: string; description: string }> = [
  {
    value: 'centerline',
    label: 'Centre Line',
    description: 'AI cleanup for centerline-ready CAD output.',
  },
  {
    value: 'outline',
    label: 'Outline',
    description: 'Trace the existing contours as SVG and DXF.',
  },
];

const Upload = () => {
  const navigate = useNavigate();
  const flowType = useImageStore((s) => s.flowType);
  const imageUri = useImageStore((s) => s.imageUri);
  const imageName = useImageStore((s) => s.imageName);
  const setImage = useImageStore((s) => s.setImage);
  const simplificationLevel = useImageStore((s) => s.simplificationLevel);
  const setSimplificationLevel = useImageStore((s) => s.setSimplificationLevel);
  const vectorizeMode = useImageStore((s) => s.vectorizeMode);
  const setVectorizeMode = useImageStore((s) => s.setVectorizeMode);
  const [dragActive, setDragActive] = useState(false);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isPreparingFile, setIsPreparingFile] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const subscriptionQuery = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.get<SubscriptionStatus>('/api/payments/subscription'),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  const subscription = subscriptionQuery.data;

  const shouldBlockVectorizeAction = (status?: SubscriptionStatus) =>
    !status?.isAdmin &&
    ((status?.freeTrialUsed ?? false) || (status?.deviceTrialUsed ?? false)) &&
    (status?.credits ?? 0) <= 0;

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        setFileError('Please choose a PNG, JPG, or WEBP image.');
        return;
      }

      setIsPreparingFile(true);
      setFileError(null);

      try {
        const optimized = await optimizeUploadImage(file, flowType);
        setFileSize(optimized.sizeLabel);
        setImage(optimized.uri, optimized.file, file.name);
      } catch (error) {
        setFileSize(null);
        setFileError(
          error instanceof Error ? error.message : 'Failed to prepare the selected image.'
        );
      } finally {
        setIsPreparingFile(false);
      }
    },
    [flowType, setImage]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        void handleFile(file);
      }
    },
    [handleFile]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = () => setDragActive(false);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void handleFile(file);
    }
  };

  const handleContinue = () => {
    const continueWithFreshStatus = async () => {
      const latestSubscription = (await subscriptionQuery.refetch()).data ?? subscription;

      if (flowType === 'vectorize_only' && shouldBlockVectorizeAction(latestSubscription)) {
        setShowUpgradeDialog(true);
        return;
      }

      if (flowType === 'full') {
        navigate('/selection');
      } else {
        navigate('/processing');
      }
    };

    void continueWithFreshStatus();
  };

  useEffect(() => {
    if (!flowType) {
      navigate('/', { replace: true });
    }
  }, [flowType, navigate]);

  if (!flowType) {
    return null;
  }

  return (
    <PageWrapper className="flex flex-col items-center justify-center px-6 pt-20 pb-12">
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="border-[#dfd8cc] bg-[#fbf7ef] sm:max-w-md">
          <DialogHeader className="text-left">
            <div className="mb-2 flex h-10 w-10 items-center justify-center border border-orange-500/20 bg-orange-500/10">
              <Crown className="h-4 w-4 text-orange-500" />
            </div>
            <DialogTitle className="text-[24px] font-black tracking-[-0.7px] text-[#332e24]">
              Free trial unavailable.
            </DialogTitle>
            <DialogDescription className="font-mono text-[11px] leading-5 text-[#6c6354]">
              This account or device has already used the free process. Start Lite, upgrade higher, or buy credits before starting another vector conversion.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-start">
            <button
              onClick={() => navigate('/account')}
              className="flex items-center justify-center gap-2 border border-orange-500 bg-orange-500 px-4 py-3 text-white transition-all hover:bg-orange-600"
            >
              <Zap className="h-3.5 w-3.5" />
              <span className="font-mono text-[10px] uppercase tracking-[0.1em]">Go to Billing</span>
            </button>
            <button
              onClick={() => setShowUpgradeDialog(false)}
              className="flex items-center justify-center gap-2 border border-neutral-300 bg-transparent px-4 py-3 text-neutral-700 transition-all hover:border-neutral-400"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.1em]">Later</span>
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="w-full max-w-xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400 mb-3">
            {flowType === 'full' ? '01 — Photo to Vector' : '01 — Vectorize Linework'}
          </p>
          <h1
            className="text-4xl md:text-5xl font-light uppercase tracking-[-0.02em] leading-[1.1] text-neutral-900"
            style={{ fontFamily: 'system-ui, sans-serif' }}
          >
            <span>{flowType === 'full' ? 'Upload' : 'Upload'}</span> {flowType === 'full' ? 'your photo.' : 'your drawing.'}
          </h1>
        </motion.div>

        {/* Vectorization settings */}
        {flowType === 'vectorize_only' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mb-8 space-y-6"
          >
            <div>
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-neutral-400">
                Vector Mode
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {vectorizeModeOptions.map((option) => {
                  const active = vectorizeMode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setVectorizeMode(option.value)}
                      className={`space-y-1 border px-4 py-4 text-left transition-all ${
                        active
                          ? 'border-orange-500 bg-orange-500/10 text-orange-600'
                          : 'border-neutral-300 text-neutral-600 hover:border-neutral-400'
                      }`}
                    >
                      <div className="font-mono text-xs uppercase tracking-[0.1em]">{option.label}</div>
                      <div className="font-mono text-[10px] leading-5 text-neutral-400">
                        {option.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {vectorizeMode === 'centerline' ? (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-neutral-400 mb-3">
                  Detail Level
                </p>
                <div className="flex gap-2">
                  {simplificationOptions.map((option) => {
                    const active = simplificationLevel === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSimplificationLevel(option.value)}
                        className={`flex-1 border px-4 py-3 font-mono text-xs uppercase tracking-[0.1em] transition-all ${
                          active
                            ? 'border-orange-500 bg-orange-500/10 text-orange-600'
                            : 'border-neutral-300 text-neutral-500 hover:border-neutral-400'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="font-mono text-[10px] leading-5 text-neutral-400">
                Outline mode keeps the original contours and skips the centerline simplification controls.
              </p>
            )}
          </motion.div>
        )}

        {/* Upload Zone or Preview */}
        <AnimatePresence mode="wait">
          {imageUri ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Image preview */}
              <div className="relative overflow-hidden border border-neutral-200 bg-white">
                <img
                  src={imageUri}
                  alt={imageName ?? 'Uploaded'}
                  className="w-full object-contain"
                  style={{ maxHeight: '400px' }}
                />
              </div>

              {/* File info */}
              <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
                <div>
                  <p className="font-mono text-xs text-neutral-900">{imageName}</p>
                  {fileSize && (
                    <p className="font-mono text-[10px] text-neutral-400">{fileSize}</p>
                  )}
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-orange-500">
                  Ready
                </span>
              </div>

              {/* Continue button */}
              <button
                onClick={handleContinue}
                className="group relative flex w-full items-center justify-center gap-3 border border-neutral-900 bg-neutral-900 px-8 py-4 text-white transition-all hover:bg-neutral-800"
              >
                <span className="font-mono text-xs uppercase tracking-[0.15em]">Continue</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>

              {/* Change image */}
              <button
                onClick={() => inputRef.current?.click()}
                className="w-full font-mono text-[10px] uppercase tracking-[0.15em] text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                Choose different file
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="dropzone"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.4, delay: 0.15 }}
            >
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                className={`group relative flex w-full cursor-pointer flex-col items-center justify-center gap-6 border-2 border-dashed px-8 py-24 transition-all ${
                  dragActive
                    ? 'border-orange-500 bg-orange-500/5'
                    : 'border-neutral-300 hover:border-neutral-400'
                }`}
              >
                {/* Upload icon */}
                <div className="flex h-16 w-16 items-center justify-center">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className={`h-8 w-8 transition-colors ${
                      dragActive ? 'stroke-orange-500' : 'stroke-neutral-400'
                    }`}
                    strokeWidth="1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 5v14M5 12l7-7 7 7" />
                  </svg>
                </div>

                <div className="space-y-2 text-center">
                  <p className="font-mono text-xs uppercase tracking-[0.1em] text-neutral-900">
                    {isPreparingFile
                      ? 'Preparing file...'
                      : dragActive
                        ? 'Release to upload'
                        : 'Drop your file here'}
                  </p>
                  <p className="font-mono text-[10px] text-neutral-400">
                    {isPreparingFile ? 'Optimizing image for upload' : 'or click to browse'}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  {['PNG', 'JPG', 'WEBP'].map((fmt) => (
                    <span
                      key={fmt}
                      className="font-mono text-[9px] uppercase tracking-[0.15em] text-neutral-400"
                    >
                      {fmt}
                    </span>
                  ))}
                </div>

                {fileError && (
                  <div className="border border-red-200 bg-red-50 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.1em] text-red-600">
                    {fileError}
                  </div>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden File Input */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onInputChange}
          className="hidden"
        />
      </div>
    </PageWrapper>
  );
};

export default Upload;
