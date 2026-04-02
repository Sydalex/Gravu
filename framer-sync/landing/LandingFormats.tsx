import { motion } from '@framer-runtime/motion';

export const LandingFormats = () => {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.7 }}
      className="py-12 border-t border-foreground/10"
    >
      <div className="flex flex-wrap items-center gap-8 text-sm uppercase tracking-widest text-foreground/40">
        <span>SVG</span>
        <span className="h-1 w-1 rounded-full bg-foreground/20" />
        <span>DXF</span>
        <span className="h-1 w-1 rounded-full bg-foreground/20" />
        <span>PNG</span>
        <span className="h-1 w-1 rounded-full bg-foreground/20" />
        <span>Vectorworks</span>
        <span className="h-1 w-1 rounded-full bg-foreground/20" />
        <span>AutoCAD</span>
      </div>
    </motion.section>
  );
};
