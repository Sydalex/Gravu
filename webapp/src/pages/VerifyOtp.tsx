import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { ShieldCheck, ArrowLeft, Loader2, RotateCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient, signOut } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { isPreviewAuthBypassEnabled } from '@/lib/preview-mode';
import { getUserFacingErrorMessage } from '@/lib/user-facing-errors';
import { PageWrapper } from '@/components/PageWrapper';

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
        errorMessage = getUserFacingErrorMessage(
          payload?.error ?? payload,
          { fallback: 'Invalid verification code.' },
        );
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
        errorMessage = getUserFacingErrorMessage(result.error, { fallback: 'Invalid verification code.' });
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
      setError(getUserFacingErrorMessage(result.error, { fallback: 'We could not resend the code. Please try again.' }));
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
    <PageWrapper className="flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Back link */}
        <motion.button
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          onClick={() => navigate('/login')}
          className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </motion.button>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-card border border-border rounded-2xl p-8"
        >
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
              <ShieldCheck className="h-6 w-6 text-accent" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              {mode === 'email-verification' ? 'Verify your email' : 'Check your email'}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {mode === 'email-verification' ? 'We sent a 6-digit verification code to' : 'We sent a 6-digit code to'}
            </p>
            <p className="mt-0.5 font-mono text-sm text-foreground">
              {email}
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="otp"
                className="text-sm font-medium text-foreground"
              >
                Verification code
              </label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => handleOtpChange(e.target.value)}
                className="h-14 bg-secondary border-border rounded-xl text-center font-mono text-2xl tracking-[0.4em] text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-accent"
                autoComplete="one-time-code"
                autoFocus
              />
            </div>

            {error ? (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-destructive text-center"
              >
                {error}
              </motion.p>
            ) : null}

            <Button
              type="submit"
              disabled={loading || otp.length < 6}
              className="h-12 w-full bg-accent text-accent-foreground rounded-xl font-medium hover:bg-accent/90 transition-colors"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              {loading ? "Verifying..." : mode === 'email-verification' ? 'Verify Email' : 'Verify & Sign In'}
            </Button>
          </form>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {resending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCw className="h-3.5 w-3.5" />
              )}
              {resending ? "Sending..." : resent ? "Code sent!" : "Resend code"}
            </button>
          </div>
        </motion.div>

        {/* Tip */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mt-5 text-center text-xs text-muted-foreground"
        >
          Didn't receive it? Check your spam folder or try again.
        </motion.p>
      </div>
    </PageWrapper>
  );
};

export default VerifyOtp;
