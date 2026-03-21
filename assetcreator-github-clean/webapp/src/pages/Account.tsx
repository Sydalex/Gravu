import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  LogOut,
  Check,
  Zap,
  Pencil,
  Crown,
  CreditCard,
  AlertCircle,
  Loader2,
  CalendarClock,
  RotateCcw,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageWrapper } from '@/components/PageWrapper';
import { useSession, signOut } from '@/lib/auth-client';
import { api } from '@/lib/api';
import type { SubscriptionStatus } from '../../../backend/src/types';

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return 'AC';
}

function formatMemberSince(dateStr?: string | null | Date): string {
  if (!dateStr) return 'Unknown';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const proFeatures = [
  'Unlimited AI linework conversions',
  'Priority processing queue',
  'Batch export (all subjects at once)',
  'DXF + SVG vector exports',
  'Full conversion history',
  'Email support',
];

const freeFeatures = [
  'Photo to Vector conversions',
  'Vectorize Linework',
  'PNG, SVG, DXF exports',
  'Conversion history',
];

// ─── Subscription Card ────────────────────────────────────────────────────────

interface SubscriptionCardProps {
  subscription: SubscriptionStatus | undefined;
  isLoading: boolean;
}

const SubscriptionCard = ({ subscription, isLoading }: SubscriptionCardProps) => {
  const isPro = subscription?.plan === 'pro';
  const isCanceling = isPro && subscription?.cancelAtPeriodEnd;

  const checkoutMutation = useMutation({
    mutationFn: () =>
      api.post<{ url: string }>('/api/payments/checkout', {
        priceId: 'price_1TBGSGQ7WzPqOKJm6SggAxyJ',
        successUrl: `${window.location.origin}/account?upgraded=1`,
        cancelUrl: `${window.location.origin}/account`,
      }),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });

  const portalMutation = useMutation({
    mutationFn: () =>
      api.post<{ url: string }>('/api/payments/portal', {
        returnUrl: `${window.location.origin}/account`,
      }),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });

  const buyMutation = useMutation({
    mutationFn: (pack: { credits: number; priceId: string }) =>
      api.post<{ url: string }>('/api/payments/buy-credits', {
        credits: pack.credits,
        priceId: pack.priceId,
        successUrl: `${window.location.origin}/account?credits=1`,
        cancelUrl: `${window.location.origin}/account`,
      }),
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 flex items-center justify-center min-h-[260px]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border bg-card p-6 space-y-5 ${
        isPro ? 'border-accent/40' : 'border-border'
      }`}
    >
      {/* Plan header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground" style={{ fontFamily: "'Syne', sans-serif" }}>
          Plan
        </h2>
        {isPro ? (
          <span className="flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
            <Crown className="h-2.5 w-2.5" />
            Pro
          </span>
        ) : (
          <span className="rounded-full border border-border bg-secondary px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Free
          </span>
        )}
      </div>

      {/* Status info for Pro */}
      {isPro && subscription?.currentPeriodEnd ? (
        <div className="rounded-xl border border-border bg-secondary/50 px-3 py-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CalendarClock className="h-3 w-3" />
              {isCanceling ? 'Access until' : 'Renews on'}
            </span>
            <span className="font-mono text-xs text-foreground">
              {formatDate(subscription.currentPeriodEnd)}
            </span>
          </div>
          {isCanceling && (
            <div className="flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3 text-amber-500/80 flex-shrink-0" />
              <span className="text-[10px] text-amber-500/80">Subscription canceled — active until period end</span>
            </div>
          )}
        </div>
      ) : null}

      {/* Credits balance */}
      <div className="rounded-xl border border-border bg-secondary/50 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Zap className="h-3 w-3" />
            Credits remaining
          </span>
          <span className="font-mono text-xs font-semibold text-foreground">
            {subscription?.isAdmin ? '∞' : (subscription?.credits ?? 0)}
          </span>
        </div>
        {!subscription?.isAdmin && (subscription?.credits ?? 0) === 0 && (
          <p className="mt-1 text-[10px] text-amber-500/80">No credits — purchase more to continue converting.</p>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-2.5">
        {(isPro ? proFeatures : freeFeatures).map((feature) => (
          <li key={feature} className="flex items-center gap-2.5">
            <span
              className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full ${
                isPro ? 'bg-accent/15' : 'bg-muted'
              }`}
            >
              <Check className={`h-2.5 w-2.5 ${isPro ? 'text-accent' : 'text-muted-foreground'}`} />
            </span>
            <span className="text-xs text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>

      <div className="h-px bg-border/60" />

      {/* Action */}
      {isPro ? (
        <div className="space-y-2">
          <Button
            variant="secondary"
            className="w-full rounded-xl gap-2 border border-border hover:border-accent/40"
            onClick={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
          >
            {portalMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CreditCard className="h-3.5 w-3.5" />
            )}
            Manage Billing
          </Button>
          <p className="text-center font-mono text-[10px] text-muted-foreground/60">
            Change plan, update payment method, or cancel.
          </p>
          {!subscription?.isAdmin && (
            <div className="pt-1 border-t border-border/60 space-y-2">
              <p className="text-[10px] text-muted-foreground/60 text-center">Need more credits?</p>
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-xl gap-2 text-xs"
                onClick={() => buyMutation.mutate({ credits: 10, priceId: 'price_credits_10' })}
                disabled={buyMutation.isPending}
              >
                {buyMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Buy 10 credits
              </Button>
              {buyMutation.isError && (
                <p className="text-[10px] text-destructive text-center">Failed to start checkout. Try again.</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <Button
            className="w-full rounded-xl gap-2 bg-accent text-accent-foreground hover:bg-accent/90 hover:shadow-[0_0_20px_hsl(160_84%_39%/_0.25)] transition-all"
            onClick={() => checkoutMutation.mutate()}
            disabled={checkoutMutation.isPending}
          >
            {checkoutMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="h-3.5 w-3.5" />
            )}
            Upgrade to Pro
          </Button>
          {checkoutMutation.isError ? (
            <p className="flex items-center justify-center gap-1.5 text-center font-mono text-[10px] text-destructive">
              <AlertCircle className="h-3 w-3" />
              Failed to start checkout. Please try again.
            </p>
          ) : (
            <p className="text-center font-mono text-[10px] text-muted-foreground/60">
              Secure checkout via Stripe.
            </p>
          )}
          {!subscription?.isAdmin && (
            <div className="pt-1 border-t border-border/60 space-y-2">
              <p className="text-[10px] text-muted-foreground/60 text-center">Need more credits?</p>
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-xl gap-2 text-xs"
                onClick={() => buyMutation.mutate({ credits: 10, priceId: 'price_credits_10' })}
                disabled={buyMutation.isPending}
              >
                {buyMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Buy 10 credits
              </Button>
              {buyMutation.isError && (
                <p className="text-[10px] text-destructive text-center">Failed to start checkout. Try again.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const Account = () => {
  const navigate = useNavigate();
  const { data: session } = useSession();
  const user = session?.user;

  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(user?.name ?? '');

  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.get<SubscriptionStatus>('/api/payments/subscription'),
    staleTime: 30_000,
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // Check for ?upgraded=1 param (returning from Stripe checkout)
  const upgraded = new URLSearchParams(window.location.search).get('upgraded') === '1';
  const creditsAdded = new URLSearchParams(window.location.search).get('credits') === '1';

  return (
    <PageWrapper className="pt-[52px]">
      <div className="mx-auto max-w-3xl px-4 py-10 md:py-14">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <h1 className="text-display text-3xl md:text-4xl text-foreground">Account</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your profile and subscription.</p>
        </motion.div>

        {/* Upgrade success banner */}
        {upgraded && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3"
          >
            <Crown className="h-4 w-4 text-accent flex-shrink-0" />
            <p className="text-sm text-accent">
              Welcome to Pro! Your subscription is now active.
            </p>
          </motion.div>
        )}

        {/* Credits added banner */}
        {creditsAdded && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3"
          >
            <Zap className="h-4 w-4 text-accent flex-shrink-0" />
            <p className="text-sm text-accent">Credits added to your account!</p>
          </motion.div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {/* User Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-2xl border border-border bg-card p-6 space-y-5"
          >
            {/* Avatar */}
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-accent/10 border border-accent/20">
                <span
                  className="text-lg font-bold text-accent"
                  style={{ fontFamily: "'Syne', sans-serif" }}
                >
                  {getInitials(displayName || user?.name, user?.email)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {editingName ? (
                    <input
                      autoFocus
                      className="w-full rounded-lg border border-accent/40 bg-secondary px-2 py-1 text-sm font-semibold text-foreground outline-none focus:border-accent"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      onBlur={() => setEditingName(false)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false);
                      }}
                    />
                  ) : (
                    <>
                      <p className="truncate text-sm font-semibold text-foreground">
                        {displayName || user?.name || 'No name set'}
                      </p>
                      <button
                        onClick={() => setEditingName(true)}
                        className="flex-shrink-0 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
                <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </div>

            <div className="h-px bg-border/60" />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Member since</span>
                <span className="font-mono text-xs text-foreground">
                  {formatMemberSince(user?.createdAt)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Email verified</span>
                <span className="font-mono text-xs text-foreground">
                  {user?.emailVerified ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Plan</span>
                <span className="font-mono text-xs text-foreground capitalize">
                  {subLoading ? '…' : (subscription?.plan ?? 'Free')}
                </span>
              </div>
            </div>

            {/* Refresh subscription */}
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              Refresh status
            </button>
          </motion.div>

          {/* Subscription Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.18 }}
          >
            <SubscriptionCard subscription={subscription} isLoading={subLoading} />
          </motion.div>
        </div>

        {/* Sign Out */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-6"
        >
          <div className="rounded-2xl border border-destructive/20 bg-card p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Sign out</p>
                <p className="text-xs text-muted-foreground">
                  You'll need to sign back in to access your account.
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={handleSignOut}
                className="gap-2 rounded-xl border border-destructive/20 text-destructive hover:bg-destructive/10 hover:border-destructive/40 sm:flex-shrink-0"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </PageWrapper>
  );
};

export default Account;
