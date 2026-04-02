import { useState } from 'react';
import { useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { authClient, signOut } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { isPreviewAuthBypassEnabled } from '@/lib/preview-mode';
import { HamburgerMenu } from '@/components/HamburgerMenu';

const VerifyOtp = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const state = location.state as { email?: string; mode?: 'sign-in' | 'email-verification'; initialError?: string } | null;
  const email = state?.email ?? searchParams.get('email') ?? undefined;
  const mode = state?.mode ?? ((searchParams.get('mode') as 'sign-in' | 'email-verification' | null) ?? 'sign-in');

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(state?.initialError ?? null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  if (!email) {
    return <Navigate to="/login" replace />;
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp.trim() || otp.length < 6) return;

    if (isPreviewAuthBypassEnabled()) {
      navigate('/app');
      return;
    }

    setLoading(true);
    setError(null);

    let errorMessage: string | null = null;

    if (mode === 'email-verification') {
      const response = await api.raw('/api/auth/email-otp/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          otp: otp.trim(),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        errorMessage = payload?.message || payload?.error?.message || 'Invalid verification code';
      } else {
        await signOut().catch(() => undefined);
        navigate(`/login?verified=1&email=${encodeURIComponent(email.trim())}`, { replace: true });
      }
    } else {
      const result = await authClient.signIn.emailOtp({
        email: email.trim(),
        otp: otp.trim(),
      });

      if (result.error) {
        errorMessage = result.error.message || 'Invalid verification code';
      } else {
        navigate('/app');
      }
    }

    setLoading(false);

    if (errorMessage) {
      setError(errorMessage);
    }
  };

  const handleResend = async () => {
    if (isPreviewAuthBypassEnabled()) {
      setResent(true);
      setTimeout(() => setResent(false), 3000);
      return;
    }

    setResending(true);
    setError(null);
    setResent(false);

    const result = await authClient.emailOtp.sendVerificationOtp({
      email: email.trim(),
      type: mode === 'email-verification' ? 'email-verification' : 'sign-in',
    });

    setResending(false);

    if (result.error) {
      setError(result.error.message || "Failed to resend code");
    } else {
      setResent(true);
      setTimeout(() => setResent(false), 3000);
    }
  };

  const handleOtpChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 6);
    setOtp(cleaned);
    if (error) setError(null);
  };

  return (
    <div className="relative min-h-screen bg-[#f8f8f6] overflow-hidden flex flex-col">
      {/* Header */}
      <header className="relative z-20 flex items-center justify-between px-6 py-6 md:px-12 md:py-8">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
          <Link to="/welcome" className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-neutral-900" />
            <span className="h-2 w-2 rounded-full bg-neutral-900" />
          </Link>
          <span className="font-mono text-sm uppercase tracking-[0.2em] text-neutral-500">Gravu</span>
        </motion.div>
        <nav className="flex items-center gap-6">
          <Link to="/login" className="text-sm uppercase tracking-widest text-foreground/50 hover:text-foreground transition-colors">
            Back
          </Link>
          <HamburgerMenu />
        </nav>
      </header>

      {/* Main */}
      <main className="relative z-10 flex flex-1 flex-col lg:flex-row">
        {/* Left — editorial headline */}
        <div className="hidden lg:flex lg:flex-1 flex-col justify-end px-12 pb-20 pt-12">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <h1 className="text-[clamp(3rem,8vw,5.5rem)] font-light leading-[0.95] tracking-tight text-foreground uppercase">
              <span>Verify</span>
              <br />
              your email.
            </h1>
            <div className="mt-10 flex items-center gap-4">
              <span className="h-px w-12 bg-foreground/30" />
              <span className="text-sm uppercase tracking-widest text-foreground/40">Gravu</span>
            </div>
          </motion.div>
        </div>

        {/* Right — form */}
        <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-16 lg:max-w-lg">
          {/* Mobile wordmark */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12 lg:hidden"
          >
            <h1 className="text-4xl font-light uppercase tracking-tight text-foreground">
              Verify your email.
            </h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="w-full max-w-sm"
          >
            {/* Section label */}
            <div className="mb-8 flex items-center gap-4">
              <span className="h-px w-8 bg-foreground/20" />
              <span className="text-xs uppercase tracking-widest text-foreground/40">
                {mode === 'email-verification' ? 'Email verification' : 'Sign in'}
              </span>
            </div>

            {/* Email display */}
            <div className="mb-6 border border-foreground/10 bg-foreground/5 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-foreground/40 mb-1">
                Code sent to
              </p>
              <p className="font-mono text-sm text-foreground break-all">{email}</p>
            </div>

            <form onSubmit={handleVerify} className="space-y-5">
              {/* OTP Input */}
              <div className="group relative">
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder=" "
                  value={otp}
                  onChange={(e) => handleOtpChange(e.target.value)}
                  className="peer h-14 w-full rounded-none border-0 border-b border-foreground/20 bg-transparent px-0 pt-5 pb-2 text-center font-mono text-2xl tracking-[0.4em] text-foreground placeholder-transparent transition-all focus:border-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                  autoComplete="one-time-code"
                  autoFocus
                />
                <label
                  htmlFor="otp"
                  className="pointer-events-none absolute left-0 top-1.5 text-[10px] uppercase tracking-widest text-foreground/40 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:tracking-normal peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:uppercase peer-focus:tracking-widest"
                >
                  6-digit code
                </label>
              </div>

              <AnimatePresence>
                {error ? (
                  <motion.p
                    key="error"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="text-xs text-destructive uppercase tracking-widest"
                  >
                    {error}
                  </motion.p>
                ) : null}
              </AnimatePresence>

              {/* Submit — pill style matching Landing */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading || otp.length < 6}
                  className="group relative disabled:opacity-40"
                >
                  <span className="absolute -inset-1 rounded-full border border-dashed border-foreground/20 animate-spin-slow" style={{ animationDuration: '12s' }} />
                  <span className="relative inline-flex items-center gap-3 rounded-full border-2 border-foreground px-8 py-4 text-sm uppercase tracking-widest text-foreground transition-all group-hover:bg-foreground group-hover:text-background group-disabled:pointer-events-none">
                    {loading ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying...</>
                    ) : (
                      mode === 'email-verification' ? 'Verify Email' : 'Verify & Sign In'
                    )}
                  </span>
                </button>
              </div>
            </form>

            {/* Resend option */}
            <div className="mt-6">
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="text-xs uppercase tracking-widest text-foreground/40 hover:text-foreground transition-colors disabled:opacity-40"
              >
                {resending ? (
                  <><Loader2 className="inline h-3 w-3 animate-spin mr-1" />Sending...</>
                ) : resent ? (
                  'Code sent!'
                ) : (
                  'Resend code'
                )}
              </button>
            </div>

            {/* Tip */}
            <div className="mt-12 flex items-center gap-4">
              <span className="h-px flex-1 bg-foreground/10" />
              <span className="text-xs uppercase tracking-widest text-foreground/30 text-center">
                Check spam folder
              </span>
              <span className="h-px flex-1 bg-foreground/10" />
            </div>
          </motion.div>
        </div>
      </main>

      {/* Bottom strip */}
      <footer className="relative z-10 border-t border-foreground/10 px-6 py-5 md:px-12">
        <div className="flex flex-wrap items-center gap-6 text-xs uppercase tracking-widest text-foreground/30">
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
      </footer>
    </div>
  );
};

export default VerifyOtp;
