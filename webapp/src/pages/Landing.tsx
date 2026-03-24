import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Footer } from '@/components/Footer';
import { HamburgerMenu } from '@/components/HamburgerMenu';

const Landing = () => {
  return (
    <div className="relative min-h-screen bg-[#f8f8f6] overflow-hidden flex flex-col">


      {/* Navigation */}
      <header className="relative z-20 flex items-center justify-between px-6 py-6 md:px-12 md:py-8">
        {/* Logo - two dots with text */}
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          className="flex items-center gap-2"
        >
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-neutral-900" />
            <span className="h-2 w-2 rounded-full bg-neutral-900" />
          </div>
          <span className="font-mono text-sm uppercase tracking-[0.2em] text-neutral-500">Gravu</span>
        </motion.div>

        {/* Nav items */}
        <nav className="flex items-center space-x-6">
          <Link 
            to="/login" 
            className="text-sm uppercase tracking-widest text-foreground/70 hover:text-foreground transition-colors hover:underline underline-offset-4"
          >
            Sign In
          </Link>
          <Link 
            to="/register" 
            className="text-sm uppercase tracking-widest text-foreground/70 hover:text-foreground transition-colors hover:underline underline-offset-4"
          >
            Get Started
          </Link>
          <HamburgerMenu />
        </nav>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col px-6 md:px-12 pt-12 md:pt-20">
        {/* Hero Section */}
        <section className="flex-1 flex flex-col justify-center max-w-4xl">
          {/* Large headline */}
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

          {/* CTA Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-16 md:mt-20 flex flex-col items-start gap-6"
          >
            {/* Pill button with spinning border */}
            <Link to="/register" className="group relative">
              {/* Spinning decorative border */}
              <span className="absolute -inset-1 rounded-full border border-dashed border-foreground/20 animate-spin-slow" style={{ animationDuration: '12s' }} />
              <span className="relative inline-flex items-center gap-3 rounded-full border-2 border-foreground px-8 py-4 text-sm uppercase tracking-widest text-foreground transition-all hover:bg-foreground hover:text-background">
                Start Creating
              </span>
            </Link>

            {/* Supporting text */}
            <p className="max-w-sm text-sm leading-relaxed text-foreground/60">
              Start with one successful free process, then continue with Pro or credit purchases for clean SVG, DXF, and PNG exports.
            </p>
          </motion.div>

          {/* Who we are section */}
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
        </section>

        {/* Bottom section - formats */}
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
      </main>

      <Footer />
    </div>
  );
};

export default Landing;
