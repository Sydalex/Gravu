import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';
import { HamburgerMenu } from '@/components/HamburgerMenu';

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchParams = new URLSearchParams(window.location.search);
  const verified = searchParams.get('verified') === '1';
  const verifiedEmail = searchParams.get('email') ?? '';

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError(null);
    const result = await authClient.signIn.email({ email: email.trim(), password });
    setLoading(false);
    if (result.error) {
      setError(result.error.message || 'Invalid email or password');
    } else {
      navigate('/app');
    }
  };

  const handleSendOTP = async () => {
    if (!email.trim()) { setError('Enter your email address first'); return; }
    setOtpLoading(true);
    setError(null);
    const result = await authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type: 'sign-in' });
    setOtpLoading(false);
    if (result.error) {
      setError(result.error.message || 'Failed to send verification code');
    } else {
      navigate(`/verify-otp?email=${encodeURIComponent(email.trim())}&mode=sign-in`);
    }
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
          <Link to="/welcome" className="text-sm uppercase tracking-widest text-foreground/50 hover:text-foreground transition-colors">
            Back
          </Link>
          <Link to="/register" className="text-sm uppercase tracking-widest text-foreground/70 hover:text-foreground transition-colors hover:underline underline-offset-4">
            Register
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
              <span>Welcome</span>
              <br />
              back.
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
              Welcome back.
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
              <span className="text-xs uppercase tracking-widest text-foreground/40">Sign in</span>
            </div>

            {verified ? (
              <div className="mb-6 flex items-start gap-3 border border-emerald-600/20 bg-emerald-600/5 px-4 py-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                <p className="text-xs uppercase tracking-widest text-emerald-800">
                  Email verified{verifiedEmail ? ` for ${verifiedEmail}` : ''}. You can sign in now.
                </p>
              </div>
            ) : null}

            <form onSubmit={handleSignIn} className="space-y-5">
              {/* Email */}
              <div className="group relative">
                <Input
                  id="email"
                  type="email"
                  placeholder=" "
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (error) setError(null); }}
                  className="peer h-14 w-full rounded-none border-0 border-b border-foreground/20 bg-transparent px-0 pt-5 pb-2 text-sm text-foreground placeholder-transparent transition-all focus:border-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                  autoComplete="email"
                  autoFocus
                  required
                />
                <label
                  htmlFor="email"
                  className="pointer-events-none absolute left-0 top-1.5 text-[10px] uppercase tracking-widest text-foreground/40 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:tracking-normal peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:uppercase peer-focus:tracking-widest"
                >
                  Email address
                </label>
              </div>

              {/* Password */}
              <div className="group relative">
                <Input
                  id="password"
                  type="password"
                  placeholder=" "
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (error) setError(null); }}
                  className="peer h-14 w-full rounded-none border-0 border-b border-foreground/20 bg-transparent px-0 pt-5 pb-2 text-sm text-foreground placeholder-transparent transition-all focus:border-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                  autoComplete="current-password"
                  required
                />
                <label
                  htmlFor="password"
                  className="pointer-events-none absolute left-0 top-1.5 text-[10px] uppercase tracking-widest text-foreground/40 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:tracking-normal peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:uppercase peer-focus:tracking-widest"
                >
                  Password
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
                  disabled={loading || !email.trim() || !password}
                  className="group relative disabled:opacity-40"
                >
                  <span className="absolute -inset-1 rounded-full border border-dashed border-foreground/20 animate-spin-slow" style={{ animationDuration: '12s' }} />
                  <span className="relative inline-flex items-center gap-3 rounded-full border-2 border-foreground px-8 py-4 text-sm uppercase tracking-widest text-foreground transition-all group-hover:bg-foreground group-hover:text-background group-disabled:pointer-events-none">
                    {loading ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Signing in...</>
                    ) : (
                      'Sign In'
                    )}
                  </span>
                </button>
              </div>
            </form>

            {/* OTP option */}
            <div className="mt-6">
              <button
                type="button"
                onClick={handleSendOTP}
                disabled={otpLoading}
                className="text-xs uppercase tracking-widest text-foreground/40 hover:text-foreground transition-colors disabled:opacity-40"
              >
                {otpLoading ? <><Loader2 className="inline h-3 w-3 animate-spin mr-1" />Sending...</> : 'Use email code instead'}
              </button>
            </div>

            {/* Register link */}
            <div className="mt-12 flex items-center gap-4">
              <span className="h-px flex-1 bg-foreground/10" />
              <Link to="/register" className="text-xs uppercase tracking-widest text-foreground/40 hover:text-foreground transition-colors">
                No account? Register
              </Link>
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

export default Login;
