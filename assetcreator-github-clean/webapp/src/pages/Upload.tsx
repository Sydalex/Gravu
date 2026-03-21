import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image as ImageIcon, ArrowRight, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { PageWrapper } from '@/components/PageWrapper';
import { useImageStore, type SimplificationLevel } from '@/lib/store';

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const simplificationOptions: Array<{ value: SimplificationLevel; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'mid', label: 'Mid' },
  { value: 'high', label: 'High' },
];

const Upload = () => {
  const navigate = useNavigate();
  const flowType = useImageStore((s) => s.flowType);
  const imageUri = useImageStore((s) => s.imageUri);
  const imageName = useImageStore((s) => s.imageName);
  const setImage = useImageStore((s) => s.setImage);
  const simplificationLevel = useImageStore((s) => s.simplificationLevel);
  const setSimplificationLevel = useImageStore((s) => s.setSimplificationLevel);
  const [dragActive, setDragActive] = useState(false);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/')) return;
      setFileSize(formatSize(file.size));
      const reader = new FileReader();
      reader.onload = (e) => {
        const uri = e.target?.result as string;
        setImage(uri, file, file.name);
      };
      reader.readAsDataURL(file);
    },
    [setImage]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
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
    if (file) handleFile(file);
  };

  const handleContinue = () => {
    if (flowType === 'full') {
      navigate('/selection');
    } else {
      navigate('/processing');
    }
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
    <PageWrapper className="flex flex-col items-center justify-center px-4 py-12 md:py-0">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="space-y-1.5"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 opacity-100 bg-chart-3 shadow">
            <span className="h-1 w-1 rounded-full bg-accent opacity-100" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {flowType === 'full' ? 'Photo to Vector' : 'Vectorize Linework'}
            </span>
          </div>
          <h1 className="text-display text-foreground text-7xl tracking-normal font-bold">
            Upload Image
          </h1>
          <p className="text-sm text-muted-foreground">
            {flowType === 'full'
              ? 'Upload a photo to extract and vectorize subjects'
              : 'Upload a line drawing to convert to vector'}
          </p>
        </motion.div>

        {flowType === 'vectorize_only' ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="space-y-2"
          >
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Simplification
            </p>
            <div className="inline-flex rounded-xl border border-white/8 bg-card p-1">
              {simplificationOptions.map((option) => {
                const active = simplificationLevel === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSimplificationLevel(option.value)}
                    className={`min-w-[72px] rounded-lg px-3 py-2 text-sm transition-colors ${
                      active
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </motion.div>
        ) : null}

        {/* Upload Zone or Preview */}
        <AnimatePresence mode="wait">
          {imageUri ? (
            <motion.div
              key="preview"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* Edge-to-edge image preview */}
              <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-card">
                <img
                  src={imageUri}
                  alt={imageName ?? 'Uploaded'}
                  className="w-full object-cover"
                  style={{ maxHeight: '420px', objectFit: 'contain' }}
                />
                {/* Frosted glass metadata bar */}
                <div className="absolute bottom-0 left-0 right-0 flex items-center gap-3 border-t border-white/5 bg-background/70 px-4 py-3 backdrop-blur-xl">
                  <ImageIcon className="h-4 w-4 shrink-0 text-accent" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs text-foreground">
                      {imageName}
                    </p>
                    {fileSize ? (
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {fileSize}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 rounded-md border border-white/10 bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Ready
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="min-h-[44px] flex-1 rounded-xl border border-white/8 bg-card hover:border-white/16 hover:bg-card/80 transition-all"
                  onClick={() => inputRef.current?.click()}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Change Image
                </Button>
                <Button
                  className="group relative min-h-[44px] flex-1 overflow-hidden rounded-xl bg-accent text-accent-foreground font-semibold transition-all hover:bg-accent/90 hover:shadow-[0_0_24px_hsl(160_84%_39%_/_0.25)]"
                  onClick={handleContinue}
                >
                  <span className="pointer-events-none absolute inset-0 translate-x-[-200%] skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-[200%]" />
                  {flowType === 'full' ? 'Continue' : 'Vectorize'}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="dropzone"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                className={`group relative flex w-full cursor-pointer flex-col items-center justify-center gap-6 overflow-hidden rounded-2xl border-2 border-dashed px-8 py-20 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  dragActive
                    ? 'border-accent bg-accent/[0.06] shadow-[0_0_40px_hsl(160_84%_39%_/_0.1)]'
                    : 'border-border bg-card hover:border-muted-foreground/20 hover:bg-card/80'
                }`}
              >
                {/* Drag active pulse ring */}
                {dragActive ? (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="pointer-events-none absolute inset-0 rounded-2xl border border-accent/20"
                  />
                ) : null}

                {/* Upload icon — custom arrow into circle */}
                <motion.div
                  animate={dragActive ? { y: -4, scale: 1.05 } : { y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className={`flex h-16 w-16 items-center justify-center rounded-full border transition-all duration-300 ${
                    dragActive
                      ? 'border-accent/40 bg-accent/10 shadow-[0_0_20px_hsl(160_84%_39%_/_0.2)]'
                      : 'border-border bg-muted group-hover:border-muted-foreground/20'
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className={`h-7 w-7 transition-colors duration-300 ${
                      dragActive ? 'stroke-accent' : 'stroke-muted-foreground group-hover:stroke-foreground/60'
                    }`}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v8M8.5 11.5 12 8l3.5 3.5" />
                  </svg>
                </motion.div>

                <div className="space-y-1.5 text-center">
                  <p className="text-base font-semibold text-foreground">
                    {dragActive ? 'Release to upload' : 'Drop your image here'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    or click to browse files
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {['PNG', 'JPG', 'WEBP'].map((fmt) => (
                    <span
                      key={fmt}
                      className="rounded-md border border-white/8 bg-white/[0.04] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
                    >
                      {fmt}
                    </span>
                  ))}
                  <span className="font-mono text-xs text-muted-foreground/40">
                    up to 20MB
                  </span>
                </div>
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
