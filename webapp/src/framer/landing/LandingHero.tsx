import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export const LandingHero = () => {
  return (
    <section className="flex-1 flex flex-col justify-center max-w-4xl">
      <motion.h1
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="text-[clamp(3rem,12vw,6rem)] font-light leading-[0.95] tracking-tight text-foreground uppercase"
      >
        <span>Photos</span>
        <br />
        become
        <br />
        <span className="text-primary">vectors.</span>
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="mt-16 md:mt-20 flex flex-col items-start gap-6"
      >
        <Link to="/register" className="group relative">
          <span
            className="absolute -inset-1 rounded-full border border-dashed border-foreground/20 animate-spin-slow"
            style={{ animationDuration: '12s' }}
          />
          <span className="relative inline-flex items-center gap-3 rounded-full border-2 border-foreground px-8 py-4 text-sm uppercase tracking-widest text-foreground transition-all hover:bg-foreground hover:text-background">
            Start Creating
          </span>
        </Link>

        <p className="max-w-sm text-sm leading-relaxed text-foreground/60">
          Start with one successful free process, then continue with Pro or credit purchases for clean SVG, DXF, and PNG exports.
        </p>
      </motion.div>
    </section>
  );
};
