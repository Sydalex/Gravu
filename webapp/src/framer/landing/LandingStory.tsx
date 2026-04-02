import { motion } from 'framer-motion';

export const LandingStory = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.5 }}
      className="mt-20 md:mt-32 pb-12"
    >
      <div className="flex items-center gap-4 mb-4">
        <span className="h-px w-12 bg-foreground" />
        <span className="text-sm uppercase tracking-widest text-foreground/70">What We Do</span>
      </div>
      <p className="max-w-xl text-sm leading-relaxed text-foreground/60">
        Gravu transforms photographs into precision CAD-ready vectors. Upload any image, let AI detect and extract subjects, then export clean linework for Vectorworks, AutoCAD, SketchUp, and beyond. Every account includes one successful free process to test the workflow, then you can upgrade or buy credits to continue.
      </p>
    </motion.div>
  );
};
