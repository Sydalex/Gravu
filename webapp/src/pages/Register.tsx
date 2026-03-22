import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';
import { Footer } from '@/components/Footer';

const Register = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !email.trim() || !password || !confirmPassword) return;

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await authClient.signUp.email({
      email: email.trim(),
      password,
      name: name.trim(),
    });

    setLoading(false);

    if (result.error) {
      setError(result.error.message || 'Failed to create account');
    } else {
      navigate('/');
    }
  };

  const clearError = () => {
    if (error) setError(null);
  };

  return (
    <div className="relative min-h-screen bg-background overflow-hidden flex">
      {/* Left visual panel — desktop only */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center p-16 overflow-hidden">
        {/* Large emerald orb */}
        <div
          className="absolute top-1/2 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full animate-glow-pulse"
          style={{
            background:
              'radial-gradient(circle, hsl(160 84% 39% / 0.12) 0%, hsl(160 84% 39% / 0.04) 40%, transparent 70%)',
          }}
        />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />

        {/* Floating secondary orb */}
        <div
          className="absolute top-24 left-24 h-[200px] w-[200px] rounded-full animate-float"
          style={{
            background:
              'radial-gradient(circle, hsl(160 84% 39% / 0.06) 0%, transparent 70%)',
            animationDelay: '1.5s',
          }}
        />

        {/* Wordmark as background texture */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <span
            className="select-none font-sans font-extrabold text-foreground/[0.03] leading-none"
            style={{ fontSize: '10vw', letterSpacing: '-0.04em' }}
          >
            Gravu
          </span>
        </div>

        {/* Foreground content */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative z-10 text-center"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-glow-pulse" />
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              SVG &middot; DXF &middot; PNG
            </span>
          </div>
          <h2 className="text-display text-3xl font-extrabold tracking-tight text-foreground">
            Start creating
            <br />
            <span className="text-primary">precision assets.</span>
          </h2>
        </motion.div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:px-16">
        {/* Mobile logo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10 text-center lg:hidden"
        >
          <h1 className="text-display text-3xl font-extrabold tracking-tight text-foreground" style={{ fontFamily: '"Work Sans", sans-serif' }}>
            Gravu
          </h1>
          <p className="mt-2 font-mono text-xs text-muted-foreground uppercase tracking-widest">
            Photo to vector, instantly
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="w-full max-w-sm"
        >
          {/* Form header */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Create account
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Start converting photos to vector assets today
            </p>
          </div>

          {/* Glassy card form */}
          <div className="rounded-2xl border border-white/8 bg-card/60 p-7 backdrop-blur-xl">
            <form onSubmit={handleSignUp} className="space-y-4">
              {/* Full name */}
              <div className="relative">
                <Input
                  id="name"
                  type="text"
                  placeholder=" "
                  value={name}
                  onChange={(e) => { setName(e.target.value); clearError(); }}
                  className="peer h-14 w-full rounded-xl border border-border bg-muted/60 px-4 pt-5 pb-2 text-sm text-foreground placeholder-transparent transition-all focus:border-accent/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                  autoComplete="name"
                  autoFocus
                  required
                />
                <label
                  htmlFor="name"
                  className="pointer-events-none absolute left-4 top-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:tracking-normal peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:uppercase peer-focus:tracking-widest peer-focus:text-accent"
                >
                  Full name
                </label>
              </div>

              {/* Email */}
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  placeholder=" "
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearError(); }}
                  className="peer h-14 w-full rounded-xl border border-border bg-muted/60 px-4 pt-5 pb-2 text-sm text-foreground placeholder-transparent transition-all focus:border-accent/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                  autoComplete="email"
                  required
                />
                <label
                  htmlFor="email"
                  className="pointer-events-none absolute left-4 top-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:tracking-normal peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:uppercase peer-focus:tracking-widest peer-focus:text-accent"
                >
                  Email address
                </label>
              </div>

              {/* Password */}
              <div className="relative">
                <Input
                  id="password"
                  type="password"
                  placeholder=" "
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError(); }}
                  className="peer h-14 w-full rounded-xl border border-border bg-muted/60 px-4 pt-5 pb-2 text-sm text-foreground placeholder-transparent transition-all focus:border-accent/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                  autoComplete="new-password"
                  required
                />
                <label
                  htmlFor="password"
                  className="pointer-events-none absolute left-4 top-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:tracking-normal peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:uppercase peer-focus:tracking-widest peer-focus:text-accent"
                >
                  Password (min. 8 chars)
                </label>
              </div>

              {/* Confirm password */}
              <div className="relative">
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder=" "
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); clearError(); }}
                  className="peer h-14 w-full rounded-xl border border-border bg-muted/60 px-4 pt-5 pb-2 text-sm text-foreground placeholder-transparent transition-all focus:border-accent/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                  autoComplete="new-password"
                  required
                />
                <label
                  htmlFor="confirm-password"
                  className="pointer-events-none absolute left-4 top-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:tracking-normal peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:uppercase peer-focus:tracking-widest peer-focus:text-accent"
                >
                  Confirm password
                </label>
              </div>

              <AnimatePresence>
                {error ? (
                  <motion.p
                    key="error"
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="text-sm text-destructive"
                  >
                    {error}
                  </motion.p>
                ) : null}
              </AnimatePresence>

              {/* CTA Button with shimmer */}
              <Button
                type="submit"
                disabled={
                  loading ||
                  !name.trim() ||
                  !email.trim() ||
                  !password ||
                  !confirmPassword
                }
                className="group relative h-12 w-full overflow-hidden rounded-xl bg-primary text-primary-foreground font-semibold transition-all hover:bg-primary/90 hover:shadow-[0_0_24px_hsl(var(--primary)_/_0.25)] disabled:opacity-50"
              >
                {/* Shimmer sweep on hover */}
                <span className="pointer-events-none absolute inset-0 translate-x-[-200%] skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-[200%]" />
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                {loading ? 'Creating account...' : 'Create Account'}
              </Button>
            </form>
          </div>

          {/* Sign in link */}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-medium text-primary transition-colors hover:text-primary/80"
            >
              Sign in
            </Link>
          </p>

          {/* Footer tag */}
          <div className="mt-8 flex items-center justify-center gap-2">
            <div className="h-px w-8 bg-border" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
              SVG &middot; DXF &middot; PNG
            </span>
            <div className="h-px w-8 bg-border" />
          </div>
        </motion.div>
      </div>
      <Footer />
    </div>
  );
};

export default Register;
