import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { authClient, signOut } from '@/lib/auth-client';
import { HamburgerMenu } from '@/components/HamburgerMenu';

const Register = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => { if (error) setError(null); };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password || !confirmPassword) return;
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    setError(null);
    const result = await authClient.signUp.email({ email: email.trim(), password, name: name.trim() });
    setLoading(false);
    if (result.error) {
      setError(result.error.message || 'Failed to create account');
    } else {
      await signOut().catch(() => undefined);
      navigate(`/verify-otp?email=${encodeURIComponent(email.trim())}&mode=email-verification`);
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
          <Link to="/login" className="text-sm uppercase tracking-widest text-foreground/70 hover:text-foreground transition-colors hover:underline underline-offset-4">
            Sign In
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
              <span>Start</span>
              <br />
              creating.
            </h1>
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
              Start creating.
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
              <span className="text-xs uppercase tracking-widest text-foreground/40">Create account</span>
            </div>

            <form onSubmit={handleSignUp} className="space-y-5">
              {/* Name */}
              <div className="relative">
                <Input
                  id="name"
                  type="text"
                  placeholder=" "
                  value={name}
                  onChange={(e) => { setName(e.target.value); clearError(); }}
                  className="peer h-14 w-full rounded-none border-0 border-b border-foreground/20 bg-transparent px-0 pt-5 pb-2 text-sm text-foreground placeholder-transparent transition-all focus:border-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                  autoComplete="name"
                  autoFocus
                  required
                />
                <label htmlFor="name" className="pointer-events-none absolute left-0 top-1.5 text-[10px] uppercase tracking-widest text-foreground/40 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:tracking-normal peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:uppercase peer-focus:tracking-widest">
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
                  className="peer h-14 w-full rounded-none border-0 border-b border-foreground/20 bg-transparent px-0 pt-5 pb-2 text-sm text-foreground placeholder-transparent transition-all focus:border-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                  autoComplete="email"
                  required
                />
                <label htmlFor="email" className="pointer-events-none absolute left-0 top-1.5 text-[10px] uppercase tracking-widest text-foreground/40 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:tracking-normal peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:uppercase peer-focus:tracking-widest">
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
                  className="peer h-14 w-full rounded-none border-0 border-b border-foreground/20 bg-transparent px-0 pt-5 pb-2 text-sm text-foreground placeholder-transparent transition-all focus:border-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                  autoComplete="new-password"
                  required
                />
                <label htmlFor="password" className="pointer-events-none absolute left-0 top-1.5 text-[10px] uppercase tracking-widest text-foreground/40 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:tracking-normal peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:uppercase peer-focus:tracking-widest">
                  Password (min. 8 chars)
                </label>
              </div>

              {/* Confirm Password */}
              <div className="relative">
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder=" "
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); clearError(); }}
                  className="peer h-14 w-full rounded-none border-0 border-b border-foreground/20 bg-transparent px-0 pt-5 pb-2 text-sm text-foreground placeholder-transparent transition-all focus:border-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                  autoComplete="new-password"
                  required
                />
                <label htmlFor="confirm-password" className="pointer-events-none absolute left-0 top-1.5 text-[10px] uppercase tracking-widest text-foreground/40 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:tracking-normal peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-[10px] peer-focus:uppercase peer-focus:tracking-widest">
                  Confirm password
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
                  disabled={loading || !name.trim() || !email.trim() || !password || !confirmPassword}
                  className="group relative disabled:opacity-40"
                >
                  <span className="absolute -inset-1 rounded-full border border-dashed border-foreground/20 animate-spin-slow" style={{ animationDuration: '12s' }} />
                  <span className="relative inline-flex items-center gap-3 rounded-full border-2 border-foreground px-8 py-4 text-sm uppercase tracking-widest text-foreground transition-all group-hover:bg-foreground group-hover:text-background group-disabled:pointer-events-none">
                    {loading ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating account...</>
                    ) : (
                      'Create Account'
                    )}
                  </span>
                </button>
              </div>
            </form>

            {/* Sign in link */}
            <div className="mt-12 flex items-center gap-4">
              <span className="h-px flex-1 bg-foreground/10" />
              <Link to="/login" className="text-xs uppercase tracking-widest text-foreground/40 hover:text-foreground transition-colors">
                Already registered? Sign in
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

export default Register;
