import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Crown, Loader2, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageWrapper } from '@/components/PageWrapper';
import { SubjectList } from '@/components/SubjectList';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useImageStore, type Subject } from '@/lib/store';
import { api } from '@/lib/api';
import type { SubscriptionStatus } from '../../../backend/src/types';

interface DetectResponse {
  subjects: Array<{ id: number; description: string }>;
}

const Selection = () => {
  const navigate = useNavigate();
  const imageUri = useImageStore((s) => s.imageUri);
  const flowType = useImageStore((s) => s.flowType);
  const detectedSubjects = useImageStore((s) => s.detectedSubjects);
  const setDetectedSubjects = useImageStore((s) => s.setDetectedSubjects);
  const toggleSubject = useImageStore((s) => s.toggleSubject);
  const mergeSubjects = useImageStore((s) => s.mergeSubjects);
  const unmergeSubject = useImageStore((s) => s.unmergeSubject);
  const [description, setDescription] = useState('');
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  const imageBase64 = imageUri?.split(',')[1] ?? '';

  const subscriptionQuery = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.get<SubscriptionStatus>('/api/payments/subscription'),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
  const subscription = subscriptionQuery.data;

  const shouldBlockAiAction = (status?: SubscriptionStatus) =>
    !status?.isAdmin &&
    ((status?.freeTrialUsed ?? false) || (status?.deviceTrialUsed ?? false)) &&
    (status?.credits ?? 0) <= 0;

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

  const handleProcess = () => {
    const processWithFreshStatus = async () => {
      const latestSubscription = (await subscriptionQuery.refetch()).data ?? subscription;

      if (shouldBlockAiAction(latestSubscription)) {
        setShowUpgradeDialog(true);
        return;
      }

      navigate('/processing');
    };

    void processWithFreshStatus();
  };

  const handleDetect = () => {
    const detectWithFreshStatus = async () => {
      const latestSubscription = (await subscriptionQuery.refetch()).data ?? subscription;

      if (shouldBlockAiAction(latestSubscription)) {
        setShowUpgradeDialog(true);
        return;
      }

      detectMutation.mutate();
    };

    void detectWithFreshStatus();
  };

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
    <PageWrapper className="px-6 pt-20 pb-12">
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
              This account or device has already used the free process. Start Lite, upgrade higher, or buy credits before detecting subjects or starting another photo-to-vector conversion.
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

      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400 mb-3">
            02 — Select Subjects
          </p>
          <h1
            className="text-4xl md:text-5xl font-light uppercase tracking-[-0.02em] leading-[1.1] text-neutral-900"
            style={{ fontFamily: 'system-ui, sans-serif' }}
          >
            <span>Select</span> your subjects.
          </h1>
        </motion.div>

        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Left - Image Preview */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="w-full lg:w-1/2"
          >
            <div className="overflow-hidden border border-neutral-200 bg-white">
              <img
                src={imageUri}
                alt="Uploaded"
                className="mx-auto max-h-[450px] w-full object-contain p-4"
              />
            </div>
          </motion.div>

          {/* Right - Controls */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="flex w-full flex-col gap-6 lg:w-1/2"
          >
            {/* Description Input */}
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-neutral-400 mb-2">
                Description (optional)
              </p>
              <input
                placeholder="Describe what to extract..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border-b border-neutral-300 bg-transparent py-3 font-mono text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-orange-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Detect Button */}
            <button
              onClick={handleDetect}
              disabled={detectMutation.isPending}
              className="flex items-center justify-center gap-3 border border-neutral-900 bg-neutral-900 px-6 py-4 text-white transition-all hover:bg-neutral-800 disabled:opacity-50"
            >
              {detectMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="font-mono text-xs uppercase tracking-[0.15em]">Analyzing...</span>
                </>
              ) : (
                <span className="font-mono text-xs uppercase tracking-[0.15em]">Detect Subjects</span>
              )}
            </button>

            {/* Error State */}
            {detectMutation.isError && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="border border-red-200 bg-red-50 px-4 py-3 font-mono text-xs text-red-600"
              >
                {detectMutation.error?.message ?? 'Failed to detect subjects. Please try again.'}
              </motion.div>
            )}

            {/* Detected Subjects */}
            {detectedSubjects && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                <SubjectList
                  subjects={detectedSubjects}
                  onToggle={toggleSubject}
                  onMerge={mergeSubjects}
                  onUnmerge={unmergeSubject}
                />

                <div className="border-t border-neutral-200 pt-4">
                  <button
                    onClick={handleProcess}
                    disabled={selectedCount === 0}
                    className="flex w-full items-center justify-center gap-3 border border-orange-500 bg-orange-500 px-6 py-4 text-white transition-all hover:bg-orange-600 disabled:opacity-50"
                  >
                    <span className="font-mono text-xs uppercase tracking-[0.15em]">Process Selected ({selectedCount})</span>
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        </div>
      </div>
    </PageWrapper>
  );
};

export default Selection;
