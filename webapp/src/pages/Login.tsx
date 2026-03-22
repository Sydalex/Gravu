import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';
import { Footer } from '@/components/Footer';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setError(null);

    const result = await authClient.signIn.email({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (result.error) {
      setError(result.error.message || 'Invalid email or password');
    } else {
      navigate('/');
    }
  };

  const handleSendOTP = async () => {
    if (!email.trim()) {
      setError('Enter your email address first');
      return;
    }

    setOtpLoading(true);
    setError(null);

    const result = await authClient.emailOtp.sendVerificationOtp({
      email: email.trim(),
      type: 'sign-in',
    });

    setOtpLoading(false);

    if (result.error) {
      setError(result.error.message || 'Failed to send verification code');
    } else {
      navigate('/verify-otp', { state: { email: email.trim() } });
    }
  };

  return (
    <div className="relative min-h-screen bg-background overflow-hidden flex flex-col">
      <div className="flex flex-1 min-h-0">
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

        {/* Wordmark as background texture — widened */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <span
            className="select-none font-sans font-extrabold text-foreground/[0.03] leading-none whitespace-nowrap"
            style={{ fontSize: '14vw', letterSpacing: '-0.02em' }}
          >
            AssetCreator
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
              Precision Vectorization
            </span>
          </div>
          <h2 className="text-display text-3xl font-extrabold tracking-tight text-foreground">
            Photos become
            <br />
            <span className="text-primary">CAD assets.</span>
          </h2>
        </motion.div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 lg:px-16 lg:py-12 overflow-y-auto">
        {/* Mobile logo */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-10 text-center lg:hidden"
        >
          <h1 className="text-display text-3xl font-extrabold tracking-tight text-foreground">
            Asset<span className="text-primary">Creator</span>
          </h1>
          <p className="mt-2 font-mono text-xs text-muted-foreground uppercase tracking-widest">
            Photo to CAD-ready vector assets
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
              Welcome back
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Enter your credentials to continue
            </p>
          </div>

          {/* Glassy card form */}
          <div className="rounded-2xl border border-white/8 bg-card/60 p-7 backdrop-blur-xl">
            <form onSubmit={handleSignIn} className="space-y-5">
              {/* Floating label email */}
              <div className="group relative">
                <Input
                  id="email"
                  type="email"
                  placeholder=" "
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  className="peer h-14 w-full rounded-xl border border-border bg-muted/60 px-4 pt-5 pb-2 text-sm text-foreground placeholder-transparent transition-all focus:border-accent/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                  autoComplete="email"
                  autoFocus
                  required
                />
                <label
                  htmlFor="email"
                  className="pointer-events-none absolute left-4 top-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:tracking-normal peer-placeholder-shown:not-uppercase peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:uppercase peer-focus:tracking-widest peer-focus:text-accent"
                >
                  Email address
                </label>
              </div>

              {/* Floating label password */}
              <div className="group relative">
                <Input
                  id="password"
                  type="password"
                  placeholder=" "
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  className="peer h-14 w-full rounded-xl border border-border bg-muted/60 px-4 pt-5 pb-2 text-sm text-foreground placeholder-transparent transition-all focus:border-accent/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                  autoComplete="current-password"
                  required
                />
                <label
                  htmlFor="password"
                  className="pointer-events-none absolute left-4 top-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:tracking-normal peer-placeholder-shown:not-uppercase peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:uppercase peer-focus:tracking-widest peer-focus:text-accent"
                >
                  Password
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
                disabled={loading || !email.trim() || !password}
                className="group relative h-12 w-full overflow-hidden rounded-xl bg-primary text-primary-foreground font-semibold transition-all hover:bg-primary/90 hover:shadow-[0_0_24px_hsl(var(--primary)_/_0.25)] disabled:opacity-50"
              >
                {/* Shimmer sweep on hover */}
                <span className="pointer-events-none absolute inset-0 translate-x-[-200%] skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 group-hover:translate-x-[200%]" />
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-4 text-center border-ring">
              <button
                type="button"
                onClick={handleSendOTP}
                disabled={otpLoading}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                {otpLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : null}
                {otpLoading ? 'Sending code...' : 'Forgot password? Use email code instead'}
              </button>
            </div>
          </div>

          {/* Sign up link */}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link
              to="/register"
              className="font-medium text-primary transition-colors hover:text-primary/80"
            >
              Sign up
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
      </div>
      <Footer />
    </div>
  );
};

export default Login;
