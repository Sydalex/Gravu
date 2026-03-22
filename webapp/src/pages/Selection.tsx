import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Sparkles, Loader2, Users, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageWrapper } from '@/components/PageWrapper';
import { SubjectList } from '@/components/SubjectList';
import { ViewAngleSelector } from '@/components/ViewAngleSelector';
import { useImageStore, type SimplificationLevel, type Subject } from '@/lib/store';
import { api } from '@/lib/api';

interface DetectResponse {
  subjects: Array<{ id: number; description: string }>;
}

const simplificationOptions: Array<{ value: SimplificationLevel; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'mid', label: 'Mid' },
  { value: 'high', label: 'High' },
];

const Selection = () => {
  const navigate = useNavigate();
  const imageUri = useImageStore((s) => s.imageUri);
  const flowType = useImageStore((s) => s.flowType);
  const detectedSubjects = useImageStore((s) => s.detectedSubjects);
  const setDetectedSubjects = useImageStore((s) => s.setDetectedSubjects);
  const toggleSubject = useImageStore((s) => s.toggleSubject);
  const mergeSubjects = useImageStore((s) => s.mergeSubjects);
  const unmergeSubject = useImageStore((s) => s.unmergeSubject);
  const viewAngle = useImageStore((s) => s.viewAngle);
  const setViewAngle = useImageStore((s) => s.setViewAngle);
  const customViewDescription = useImageStore((s) => s.customViewDescription);
  const setCustomViewDescription = useImageStore((s) => s.setCustomViewDescription);
  const setProcessingMode = useImageStore((s) => s.setProcessingMode);
  const simplificationLevel = useImageStore((s) => s.simplificationLevel);
  const setSimplificationLevel = useImageStore((s) => s.setSimplificationLevel);
  const [description, setDescription] = useState('');

  const imageBase64 = imageUri?.split(',')[1] ?? '';

  const detectMutation = useMutation({
    mutationFn: () =>
      api.post<DetectResponse>('/api/ai/detect-subjects', {
        imageBase64,
        description: description || undefined,
      }),
    onSuccess: (data) => {
      const subjects: Subject[] = data.subjects.map((s) => ({
        id: s.id,
        description: s.description,
        selected: true,
      }));
      setDetectedSubjects(subjects);
    },
  });

  const selectedCount = detectedSubjects?.filter((s) => s.selected).length ?? 0;

  const handleProcess = (mode: 'keep_together' | 'extract_all') => {
    setProcessingMode(mode);
    navigate('/processing');
  };

  // Redirect guards
  useEffect(() => {
    if (!flowType || flowType !== 'full' || !imageUri) {
      navigate('/', { replace: true });
    }
  }, [flowType, imageUri, navigate]);

  const shouldRender = flowType === 'full' && !!imageUri;

  if (!shouldRender) {
    return null;
  }

  return (
    <PageWrapper className="px-4 pt-[72px] pb-8 md:pt-[80px] md:pb-12">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-6 space-y-1"
        >
          <h1 className="text-2xl font-bold text-foreground">
            Detect Subjects
          </h1>
          <p className="text-sm text-muted-foreground">
            AI will identify objects in your photo for individual processing
          </p>
        </motion.div>

        <div className="flex flex-col gap-6 md:flex-row">
          {/* Left - Image Preview */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="w-full md:w-1/2"
          >
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <img
                src={imageUri}
                alt="Uploaded"
                className="mx-auto max-h-[450px] w-full object-contain p-4"
              />
            </div>
          </motion.div>

          {/* Right - Controls */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="flex w-full flex-col gap-5 md:w-1/2"
          >
            {/* Description Input */}
            <div className="space-y-2">
              <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Description (optional)
              </p>
              <Input
                placeholder="Describe what to extract..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-xl border-border bg-secondary"
              />
            </div>

            {/* Detect Button */}
            <Button
              onClick={() => detectMutation.mutate()}
              disabled={detectMutation.isPending}
              className="min-h-[44px] rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {detectMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              {detectMutation.isPending ? 'Analyzing...' : 'Detect Subjects'}
            </Button>

            {/* Error State */}
            {detectMutation.isError ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              >
                {detectMutation.error?.message ?? 'Failed to detect subjects. Please try again.'}
              </motion.div>
            ) : null}

            {/* Detected Subjects */}
            {detectedSubjects ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-5"
              >
                <SubjectList
                  subjects={detectedSubjects}
                  onToggle={toggleSubject}
                  onMerge={mergeSubjects}
                  onUnmerge={unmergeSubject}
                />

                {/* View Angle */}
                <ViewAngleSelector
                  value={viewAngle}
                  onChange={setViewAngle}
                  customDescription={customViewDescription}
                  onCustomChange={setCustomViewDescription}
                />

                <div className="space-y-2">
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
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                  <Button
                    onClick={() => handleProcess('keep_together')}
                    disabled={selectedCount === 0}
                    className="min-h-[44px] flex-1 rounded-xl"
                  >
                    <User className="mr-2 h-4 w-4" />
                    Process Combined
                  </Button>
                  <Button
                    onClick={() => handleProcess('extract_all')}
                    disabled={selectedCount === 0}
                    className="min-h-[44px] flex-1 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Process Separately
                    <span className="ml-1 font-mono text-xs opacity-70">
                      ({selectedCount})
                    </span>
                  </Button>
                </div>
              </motion.div>
            ) : null}
          </motion.div>
        </div>
      </div>
    </PageWrapper>
  );
};

export default Selection;
