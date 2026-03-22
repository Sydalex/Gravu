import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles, PenTool, FileCode, FileType, FileImage, Check, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Footer } from '@/components/Footer';

const Landing = () => {
  return (
    <div className="relative min-h-screen bg-background overflow-hidden flex flex-col">
      {/* Subtle background elements */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.015]" style={{
        backgroundImage: 'radial-gradient(circle at 20% 50%, hsl(var(--primary)) 0%, transparent 50%), radial-gradient(circle at 80% 80%, hsl(var(--primary)) 0%, transparent 50%)',
      }} />

      {/* Navigation */}
      <header className="relative z-20 flex items-center justify-between px-6 py-5 md:px-12 md:py-6 border-b border-border/40">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2">
          <span className="text-display text-lg font-extrabold tracking-tight text-foreground" style={{ fontFamily: '"Work Sans", sans-serif' }}>
            AssetCreator
          </span>
        </motion.div>
        <nav className="flex items-center gap-3">
          <Link to="/login" className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Sign In
          </Link>
          <Link to="/register">
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <Button className="rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </motion.div>
          </Link>
        </nav>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col">
        {/* Hero Section */}
        <section className="flex flex-col items-center justify-center px-6 py-16 md:py-24">
          <div className="w-full max-w-4xl space-y-8">
            {/* Animated badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex justify-center"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  AI-Powered Vectorization
                </span>
              </div>
            </motion.div>

            {/* Hero headline - BOLD and prominent */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-center space-y-4"
            >
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tighter text-foreground leading-[1.1]">
                Photos into
                <br />
                <span className="text-primary bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">
                  CAD Assets.
                </span>
              </h1>
              <p className="mx-auto max-w-2xl text-lg md:text-xl leading-relaxed text-muted-foreground font-light">
                Upload any photograph, extract subjects with AI precision, and export production-ready vectors for Vectorworks, AutoCAD, and beyond.
              </p>
            </motion.div>

            {/* Primary CTA - Prominent */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="flex flex-col items-center justify-center gap-4"
            >
              <Link to="/register">
                <Button className="group relative min-h-[56px] px-8 overflow-hidden rounded-xl bg-primary text-primary-foreground font-semibold text-base transition-all hover:bg-primary/90 hover:shadow-[0_0_32px_hsl(var(--primary)_/_0.3)]">
                  <span className="pointer-events-none absolute inset-0 translate-x-[-200%] skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-[200%]" />
                  Start Creating Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <p className="text-sm text-muted-foreground">No credit card required</p>
            </motion.div>

            {/* Divider */}
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mx-auto h-px w-40 bg-gradient-to-r from-transparent via-border to-transparent"
            />
          </div>
        </section>

        {/* Two Workflows Section - More Prominent */}
        <section className="px-6 md:px-12 py-16 md:py-20">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">Two Powerful Flows</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">Choose the workflow that fits your needs</p>
            </motion.div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Flow 1 */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                viewport={{ once: true }}
                className="group relative flex flex-col gap-6 overflow-hidden rounded-2xl border border-white/8 bg-card p-8 transition-all hover:border-primary/30 hover:shadow-[0_0_40px_hsl(var(--primary)_/_0.1)]"
              >
                <span className="pointer-events-none absolute -right-4 -bottom-6 text-[120px] font-extrabold leading-none text-foreground/[0.03] tracking-tighter">
                  01
                </span>

                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  <Sparkles className="h-6 w-6" />
                </div>

                <div className="space-y-3">
                  <h3 className="text-2xl font-semibold text-foreground">Photo to Vector</h3>
                  <p className="text-base leading-relaxed text-muted-foreground">
                    Upload a photograph. Our AI automatically detects subjects, extracts linework, and converts everything into precision CAD vectors ready for professional use.
                  </p>
                </div>

                <div className="flex items-center gap-1 pt-2">
                  {[{ label: 'Upload', icon: '📸' }, { label: 'Detect', icon: '🤖' }, { label: 'Export', icon: '✨' }].map((step, i) => (
                    <div key={step.label} className="flex items-center flex-1">
                      <div className="flex flex-col items-center gap-2 flex-1">
                        <span className="text-2xl">{step.icon}</span>
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                          {step.label}
                        </span>
                      </div>
                      {i < 2 && <div className="h-px w-6 bg-border mb-6" />}
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Flow 2 */}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                viewport={{ once: true }}
                className="group relative flex flex-col gap-6 overflow-hidden rounded-2xl border border-white/8 bg-card p-8 transition-all hover:border-primary/30 hover:shadow-[0_0_40px_hsl(var(--primary)_/_0.1)]"
              >
                <span className="pointer-events-none absolute -right-4 -bottom-6 text-[120px] font-extrabold leading-none text-foreground/[0.03] tracking-tighter">
                  02
                </span>

                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  <PenTool className="h-6 w-6" />
                </div>

                <div className="space-y-3">
                  <h3 className="text-2xl font-semibold text-foreground">Vectorize Linework</h3>
                  <p className="text-base leading-relaxed text-muted-foreground">
                    Already have a clean line drawing, sketch, or technical drawing? Convert it directly to SVG or DXF format with adjustable detail levels and precision control.
                  </p>
                </div>

                <div className="flex items-center gap-1 pt-2">
                  {[{ label: 'Upload', icon: '🎨' }, { label: 'Adjust', icon: '⚙️' }, { label: 'Export', icon: '✨' }].map((step, i) => (
                    <div key={step.label} className="flex items-center flex-1">
                      <div className="flex flex-col items-center gap-2 flex-1">
                        <span className="text-2xl">{step.icon}</span>
                        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
                          {step.label}
                        </span>
                      </div>
                      {i < 2 && <div className="h-px w-6 bg-border mb-6" />}
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Output Formats Showcase */}
        <section className="px-6 md:px-12 py-16 md:py-20 bg-gradient-to-b from-background via-card/50 to-background">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">Export in Multiple Formats</h2>
              <p className="text-muted-foreground">Get your vectors ready for any CAD software or design platform</p>
            </motion.div>

            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  format: 'SVG',
                  icon: FileCode,
                  description: 'Vector format for web and digital design',
                  use: 'Perfect for web, Adobe Suite, Figma',
                },
                {
                  format: 'DXF',
                  icon: FileType,
                  description: 'CAD format for professional workflows',
                  use: 'Vectorworks, AutoCAD, SketchUp',
                },
                {
                  format: 'PNG',
                  icon: FileImage,
                  description: 'Raster format for immediate use',
                  use: 'Presentations, documentation',
                },
              ].map((item, i) => (
                <motion.div
                  key={item.format}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  viewport={{ once: true }}
                  className="relative rounded-xl border border-white/5 bg-card/80 p-6 hover:border-primary/20 transition-all hover:shadow-[0_0_20px_hsl(var(--primary)_/_0.06)]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary mb-4">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-lg text-foreground mb-2">{item.format}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{item.description}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
                    <Check className="h-3 w-3 text-primary" />
                    <span>{item.use}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Value Section */}
        <section className="px-6 md:px-12 py-16 md:py-20">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-3">Why AssetCreator?</h2>
              <p className="text-muted-foreground">Engineered for creative professionals who demand precision</p>
            </motion.div>

            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  icon: '⚡',
                  title: 'Instant Vectorization',
                  description: 'From photo to production-ready vectors in seconds, not hours of manual tracing.',
                },
                {
                  icon: '🎯',
                  title: 'AI-Powered Precision',
                  description: 'Smart subject detection and extraction ensures clean, professional linework every time.',
                },
                {
                  icon: '🔧',
                  title: 'Creative Control',
                  description: 'Fine-tune detail levels, merge subjects, and adjust precision to your exact needs.',
                },
              ].map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  viewport={{ once: true }}
                  className="flex flex-col gap-4 p-6 rounded-xl border border-white/5 bg-card/50"
                >
                  <span className="text-4xl">{feature.icon}</span>
                  <h3 className="font-semibold text-lg text-foreground">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-6 md:px-12 py-16 md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto text-center space-y-6"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">Ready to Transform Your Workflow?</h2>
            <p className="text-lg text-muted-foreground">Join creative professionals converting photos to CAD assets in seconds.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Link to="/register">
                <Button className="group relative min-h-[52px] px-8 overflow-hidden rounded-xl bg-primary text-primary-foreground font-semibold transition-all hover:bg-primary/90 hover:shadow-[0_0_24px_hsl(var(--primary)_/_0.25)]">
                  <span className="pointer-events-none absolute inset-0 translate-x-[-200%] skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-[200%]" />
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="secondary" className="min-h-[52px] px-8 rounded-xl border border-white/8 bg-card hover:border-white/16 hover:bg-card/80 transition-all font-medium">
                  Sign In
                </Button>
              </Link>
            </div>
          </motion.div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Landing;
