import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, PenTool, FileCode, FileType, FileImage, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/Footer';

const Landing = () => {
  return (
    <div className="relative min-h-screen bg-background overflow-hidden flex flex-col">
      {/* Background grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            'linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Navigation */}
      <header className="relative z-20 flex items-center justify-between px-6 py-5 md:px-12 md:py-6">
        <div className="flex items-center gap-2">
          <span className="text-display text-xl font-extrabold tracking-tight text-foreground">
            Asset<span className="text-primary">Creator</span>
          </span>
        </div>
        <nav className="flex items-center gap-3">
          <Link
            to="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign In
          </Link>
          <Link to="/register">
            <Button className="rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all">
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-12 md:py-16">
        <div className="w-full max-w-4xl">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 flex justify-center"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 shadow">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-glow-pulse" />
              <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Precision Vectorization
              </span>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-center"
          >
            <h1 className="text-display text-4xl font-extrabold tracking-tight text-foreground md:text-5xl lg:text-6xl">
              Transform photos into
              <br />
              <span className="text-primary">CAD-ready vectors.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
              Upload any photograph. Extract subjects with AI. Export precision vector files for Vectorworks, AutoCAD, and more.
            </p>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link to="/register">
              <Button className="group relative min-h-[52px] min-w-[200px] overflow-hidden rounded-xl bg-primary text-primary-foreground font-semibold transition-all hover:bg-primary/90 hover:shadow-[0_0_24px_hsl(var(--primary)_/_0.25)]">
                <span className="pointer-events-none absolute inset-0 translate-x-[-200%] skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-[200%]" />
                Start Free
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button
                variant="secondary"
                className="min-h-[52px] min-w-[200px] rounded-xl border border-white/8 bg-card hover:border-white/16 hover:bg-card/80 transition-all font-medium"
              >
                Sign In
              </Button>
            </Link>
          </motion.div>

          {/* Divider */}
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mx-auto mt-14 h-px w-32 bg-gradient-to-r from-transparent via-border to-transparent"
          />

          {/* Two Flows Section */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-14"
          >
            <p className="mb-6 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Two Powerful Workflows
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Flow 1: Photo to Vector */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.55 }}
                className="group relative flex flex-col gap-5 overflow-hidden rounded-2xl border border-white/8 bg-card p-6 md:p-7 transition-all hover:border-primary/30 hover:shadow-[0_0_40px_hsl(var(--primary)_/_0.08)]"
              >
                {/* Background number */}
                <span className="pointer-events-none absolute -right-3 -bottom-4 select-none text-[100px] font-extrabold leading-none text-foreground/[0.02] tracking-tighter">
                  01
                </span>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary transition-all group-hover:border-primary/40 group-hover:bg-primary/15">
                  <Sparkles className="h-5 w-5" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">
                    Photo to Vector
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Upload any photograph. AI detects subjects, extracts linework, and converts to precision CAD vectors.
                  </p>
                </div>

                {/* Steps */}
                <div className="flex items-center gap-0 pt-1">
                  {['Photo', 'AI', 'Vector'].map((step, i, arr) => (
                    <div key={step} className="flex items-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary/50 transition-colors group-hover:bg-primary" />
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                          {step}
                        </span>
                      </div>
                      {i < arr.length - 1 && (
                        <div className="mb-4 mx-2 h-px w-8 bg-border" />
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Flow 2: Vectorize Linework */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.65 }}
                className="group relative flex flex-col gap-5 overflow-hidden rounded-2xl border border-white/8 bg-card p-6 md:p-7 transition-all hover:border-primary/30 hover:shadow-[0_0_40px_hsl(var(--primary)_/_0.08)]"
              >
                {/* Background number */}
                <span className="pointer-events-none absolute -right-3 -bottom-4 select-none text-[100px] font-extrabold leading-none text-foreground/[0.02] tracking-tighter">
                  02
                </span>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary transition-all group-hover:border-primary/40 group-hover:bg-primary/15">
                  <PenTool className="h-5 w-5" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-semibold tracking-tight text-foreground">
                    Vectorize Linework
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Already have a line drawing? Convert it directly to clean SVG or DXF format with adjustable detail levels.
                  </p>
                </div>

                {/* Steps */}
                <div className="flex items-center gap-0 pt-1">
                  {['Drawing', 'Vector'].map((step, i, arr) => (
                    <div key={step} className="flex items-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary/50 transition-colors group-hover:bg-primary" />
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                          {step}
                        </span>
                      </div>
                      {i < arr.length - 1 && (
                        <div className="mb-4 mx-2 h-px w-8 bg-border" />
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Features / Benefits */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.75 }}
            className="mt-14 grid gap-4 sm:grid-cols-3"
          >
            {[
              { label: 'AI-Powered Extraction', description: 'Automatically detect and isolate subjects from any photo' },
              { label: 'CAD-Ready Output', description: 'Export to DXF for Vectorworks, AutoCAD, and SketchUp' },
              { label: 'Precision Control', description: 'Adjust detail levels and merge subjects as needed' },
            ].map((feature, i) => (
              <div key={feature.label} className="flex items-start gap-3 rounded-xl border border-white/5 bg-card/50 p-4">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
                  <Check className="h-3 w-3 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground">{feature.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{feature.description}</p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Export formats strip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.85, duration: 0.5 }}
            className="mt-14 flex items-center justify-center gap-5"
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
      </main>

      <Footer />
    </div>
  );
};

export default Landing;
