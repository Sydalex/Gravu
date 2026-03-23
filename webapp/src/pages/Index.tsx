import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
    <div className="relative min-h-screen bg-[#f8f8f6] overflow-hidden">
      {/* Main content */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6">
        {/* Large editorial headline */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center"
        >
          <h1
            className="text-[12vw] md:text-[10vw] lg:text-[8vw] font-light uppercase tracking-[-0.02em] leading-[0.85] text-neutral-900"
            style={{ fontFamily: 'system-ui, sans-serif' }}
          >
            <span>Photo</span> to
            <br />
            <span className="text-orange-500">Vector.</span>
          </h1>
        </motion.div>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mt-8 max-w-md text-center font-mono text-xs uppercase tracking-[0.15em] text-neutral-500"
        >
          Upload any photograph. Extract subjects. Export precision CAD files.
        </motion.p>

        {/* Horizontal rule */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-12 h-px w-24 bg-neutral-300"
        />

        {/* Flow selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
          className="mt-12 flex flex-col gap-4 sm:flex-row sm:gap-6"
        >
          {/* Photo to Vector */}
          <button
            onClick={() => handleFlow('full')}
            className="group relative flex flex-col items-center gap-3 rounded-none border border-neutral-300 bg-transparent px-10 py-8 transition-all hover:border-orange-500 hover:bg-orange-500/5"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400">01</span>
            <span className="text-sm font-medium uppercase tracking-[0.1em] text-neutral-900">Photo to Vector</span>
            <span className="max-w-[180px] text-center font-mono text-[10px] text-neutral-500">
              AI detects subjects, converts to architectural linework
            </span>
          </button>

          {/* Vectorize Linework */}
          <button
            onClick={() => handleFlow('vectorize_only')}
            className="group relative flex flex-col items-center gap-3 rounded-none border border-neutral-300 bg-transparent px-10 py-8 transition-all hover:border-orange-500 hover:bg-orange-500/5"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400">02</span>
            <span className="text-sm font-medium uppercase tracking-[0.1em] text-neutral-900">Vectorize Linework</span>
            <span className="max-w-[180px] text-center font-mono text-[10px] text-neutral-500">
              Convert line drawings directly to SVG or DXF
            </span>
          </button>
        </motion.div>

        {/* Bottom formats strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-6"
        >
          <div className="h-px w-16 bg-neutral-200" />
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-neutral-400">
            SVG · DXF · PNG
          </span>
          <div className="h-px w-16 bg-neutral-200" />
        </motion.div>
      </div>
    </div>
  );
};

export default Index;
