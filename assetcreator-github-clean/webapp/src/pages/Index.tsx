import { useNavigate } from 'react-router-dom';
import { Sparkles, PenTool, FileCode, FileType, FileImage } from 'lucide-react';
import { motion } from 'framer-motion';
import { FlowCard } from '@/components/FlowCard';
import { Footer } from '@/components/Footer';
import { useImageStore } from '@/lib/store';

const Index = () => {
  const navigate = useNavigate();
  const setFlowType = useImageStore((s) => s.setFlowType);
  const reset = useImageStore((s) => s.reset);

  const handleFlow = (flow: 'full' | 'vectorize_only') => {
    reset();
    setFlowType(flow);
    navigate('/upload');
  };

  return (
    <div className="relative min-h-screen bg-background overflow-hidden flex flex-col items-center justify-center px-4 py-16">
      {/* Subtle grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.018]"
        style={{
          backgroundImage:
            'linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-10 w-full max-w-3xl">
        {/* Hero section */}
        <div className="text-center mt-5 mb-10">
          {/* Pill badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-glow-pulse" />
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              CAD Vectorization &middot; AI-Powered
            </span>
          </motion.div>

          {/* Giant headline */}
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="text-display mb-4 text-5xl font-extrabold tracking-tight text-foreground md:text-6xl lg:text-7xl"
          >
            Photo to{' '}
            <span className="text-accent">Vector.</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="mx-auto max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg"
          >
            Upload any photograph. Extract subjects. Export precision CAD files.
          </motion.p>

          {/* Thin divider */}
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mx-auto mt-8 h-px w-24 bg-gradient-to-r from-transparent via-border to-transparent"
          />
        </div>

        {/* Flow Cards */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="grid gap-4 md:grid-cols-2"
        >
          <FlowCard
            title="Photo to Vector"
            description="AI detects subjects, converts to architectural linework, and exports as vector files."
            icon={Sparkles}
            steps={[{ label: 'Photo' }, { label: 'AI' }, { label: 'Vector' }]}
            delay={0.35}
            cardNumber="01"
            onClick={() => handleFlow('full')}
          />
          <FlowCard
            title="Vectorize Linework"
            description="Already have a line drawing? Convert it directly to SVG or DXF format."
            icon={PenTool}
            steps={[{ label: 'Drawing' }, { label: 'Vector' }]}
            delay={0.45}
            cardNumber="02"
            onClick={() => handleFlow('vectorize_only')}
          />
        </motion.div>

        {/* Supported exports strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65, duration: 0.5 }}
          className="mt-10 flex items-center justify-center gap-5"
        >
          <div className="h-px flex-1 bg-border/40" />
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2 text-muted-foreground/60">
              <FileCode className="h-3.5 w-3.5" />
              <span className="font-mono text-xs tracking-wider">SVG</span>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground/30">·</span>
            <div className="flex items-center gap-2 text-muted-foreground/60">
              <FileType className="h-3.5 w-3.5" />
              <span className="font-mono text-xs tracking-wider">DXF</span>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground/30">·</span>
            <div className="flex items-center gap-2 text-muted-foreground/60">
              <FileImage className="h-3.5 w-3.5" />
              <span className="font-mono text-xs tracking-wider">PNG</span>
            </div>
          </div>
          <div className="h-px flex-1 bg-border/40" />
        </motion.div>
      </div>
      <Footer />
    </div>
  );
};

export default Index;
