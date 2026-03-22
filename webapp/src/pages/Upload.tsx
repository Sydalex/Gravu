import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
    <PageWrapper className="flex flex-col items-center justify-center px-6 pt-20 pb-12">
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
            {flowType === 'full' ? 'Upload your photo.' : 'Upload your drawing.'}
          </h1>
        </motion.div>

        {/* Simplification level for vectorize flow */}
        {flowType === 'vectorize_only' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mb-8"
          >
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
                    {dragActive ? 'Release to upload' : 'Drop your file here'}
                  </p>
                  <p className="font-mono text-[10px] text-neutral-400">
                    or click to browse
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
