import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { LogOut, Check, Zap, Pencil, Crown, CreditCard, Loader2, Plus } from 'lucide-react';
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
  return 'GR';
}

function formatMemberSince(dateStr?: string | null | Date): string {
  if (!dateStr) return 'Unknown';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const proFeatures = [
  'Unlimited AI linework conversions',
  'Priority processing queue',
  'Batch export (all subjects at once)',
  'DXF + SVG vector exports',
  'Full conversion history',
  'Email support',
];

const freeFeatures = ['Photo to Vector conversions', 'Vectorize Linework', 'PNG, SVG, DXF exports', 'Conversion history'];

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
      <div className="border border-neutral-200 bg-white p-6 flex items-center justify-center min-h-[260px]">
        <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className={`border bg-white p-6 space-y-5 ${isPro ? 'border-orange-500' : 'border-neutral-200'}`}>
      {/* Plan header */}
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-neutral-400">Plan</p>
        {isPro ? (
          <span className="flex items-center gap-1.5 border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.15em] text-orange-600">
            <Crown className="h-2.5 w-2.5" />
            Pro
          </span>
        ) : (
          <span className="border border-neutral-200 bg-neutral-50 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.15em] text-neutral-500">
            Free
          </span>
        )}
      </div>

      {/* Status info for Pro */}
      {isPro && subscription?.currentPeriodEnd && (
        <div className="border border-neutral-200 bg-neutral-50 px-3 py-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-neutral-400">
              {isCanceling ? 'Access until' : 'Renews on'}
            </span>
            <span className="font-mono text-[10px] text-neutral-700">{formatDate(subscription.currentPeriodEnd)}</span>
          </div>
          {isCanceling && (
            <p className="font-mono text-[9px] text-amber-600">Subscription canceled — active until period end</p>
          )}
        </div>
      )}

      {/* Credits balance */}
      <div className="border border-neutral-200 bg-neutral-50 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-neutral-400">
            <Zap className="h-3 w-3" />
            Credits remaining
          </span>
          <span className="font-mono text-[10px] font-semibold text-neutral-700">
            {subscription?.isAdmin ? '∞' : subscription?.credits ?? 0}
          </span>
        </div>
        {!subscription?.isAdmin && (subscription?.credits ?? 0) === 0 && (
          <p className="mt-1 font-mono text-[9px] text-amber-600">No credits — purchase more to continue converting.</p>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-2">
        {(isPro ? proFeatures : freeFeatures).map((feature) => (
          <li key={feature} className="flex items-center gap-2.5">
            <span
              className={`flex h-4 w-4 flex-shrink-0 items-center justify-center ${isPro ? 'bg-orange-500/10' : 'bg-neutral-100'}`}
            >
              <Check className={`h-2.5 w-2.5 ${isPro ? 'text-orange-500' : 'text-neutral-400'}`} />
            </span>
            <span className="font-mono text-[10px] text-neutral-500">{feature}</span>
          </li>
        ))}
      </ul>

      <div className="h-px bg-neutral-200" />

      {/* Action */}
      {isPro ? (
        <div className="space-y-3">
          <button
            onClick={() => portalMutation.mutate()}
            disabled={portalMutation.isPending}
            className="flex w-full items-center justify-center gap-2 border border-neutral-300 bg-transparent px-4 py-3 text-neutral-700 transition-all hover:border-neutral-400 disabled:opacity-50"
          >
            {portalMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CreditCard className="h-3.5 w-3.5" />
            )}
            <span className="font-mono text-[10px] uppercase tracking-[0.1em]">Manage Billing</span>
          </button>
          {!subscription?.isAdmin && (
            <button
              onClick={() => buyMutation.mutate({ credits: 10, priceId: 'price_credits_10' })}
              disabled={buyMutation.isPending}
              className="flex w-full items-center justify-center gap-2 border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-neutral-600 transition-all hover:border-neutral-300 disabled:opacity-50"
            >
              {buyMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              <span className="font-mono text-[9px] uppercase tracking-[0.1em]">Buy 10 credits</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <button
            onClick={() => checkoutMutation.mutate()}
            disabled={checkoutMutation.isPending}
            className="flex w-full items-center justify-center gap-2 border border-orange-500 bg-orange-500 px-4 py-3 text-white transition-all hover:bg-orange-600 disabled:opacity-50"
          >
            {checkoutMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            <span className="font-mono text-[10px] uppercase tracking-[0.1em]">Upgrade to Pro</span>
          </button>
          <p className="text-center font-mono text-[9px] text-neutral-400">Secure checkout via Stripe.</p>
          {!subscription?.isAdmin && (
            <button
              onClick={() => buyMutation.mutate({ credits: 10, priceId: 'price_credits_10' })}
              disabled={buyMutation.isPending}
              className="flex w-full items-center justify-center gap-2 border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-neutral-600 transition-all hover:border-neutral-300 disabled:opacity-50"
            >
              {buyMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              <span className="font-mono text-[9px] uppercase tracking-[0.1em]">Buy 10 credits</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

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

  const upgraded = new URLSearchParams(window.location.search).get('upgraded') === '1';
  const creditsAdded = new URLSearchParams(window.location.search).get('credits') === '1';

  return (
    <PageWrapper className="pt-20">
      <div className="mx-auto max-w-3xl px-6 py-10 md:py-14">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-10"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400 mb-3">Settings</p>
          <h1
            className="text-4xl md:text-5xl font-light uppercase tracking-[-0.02em] leading-[1.1] text-neutral-900"
            style={{ fontFamily: 'system-ui, sans-serif' }}
          >
            Account.
          </h1>
        </motion.div>

        {/* Upgrade success banner */}
        {upgraded && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-center gap-3 border border-orange-500/30 bg-orange-500/10 px-4 py-3"
          >
            <Crown className="h-4 w-4 text-orange-500 flex-shrink-0" />
            <p className="font-mono text-xs text-orange-600">Welcome to Pro! Your subscription is now active.</p>
          </motion.div>
        )}

        {creditsAdded && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-center gap-3 border border-orange-500/30 bg-orange-500/10 px-4 py-3"
          >
            <Zap className="h-4 w-4 text-orange-500 flex-shrink-0" />
            <p className="font-mono text-xs text-orange-600">Credits added to your account!</p>
          </motion.div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* User Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="border border-neutral-200 bg-white p-6 space-y-5"
          >
            {/* Avatar */}
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center border border-orange-500/20 bg-orange-500/10">
                <span className="font-mono text-lg font-bold text-orange-500">
                  {getInitials(displayName || user?.name, user?.email)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {editingName ? (
                    <input
                      autoFocus
                      className="w-full border-b border-orange-500 bg-transparent py-1 font-mono text-sm text-neutral-900 outline-none"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      onBlur={() => setEditingName(false)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false);
                      }}
                    />
                  ) : (
                    <>
                      <p className="truncate font-mono text-sm text-neutral-900">
                        {displayName || user?.name || 'No name set'}
                      </p>
                      <button
                        onClick={() => setEditingName(true)}
                        className="flex-shrink-0 text-neutral-300 hover:text-neutral-500 transition-colors"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </>
                  )}
                </div>
                <p className="mt-0.5 truncate font-mono text-[10px] text-neutral-400">{user?.email}</p>
              </div>
            </div>

            <div className="h-px bg-neutral-200" />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-neutral-400">Member since</span>
                <span className="font-mono text-[10px] text-neutral-700">{formatMemberSince(user?.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-neutral-400">Email verified</span>
                <span className="font-mono text-[10px] text-neutral-700">{user?.emailVerified ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-neutral-400">Plan</span>
                <span className="font-mono text-[10px] text-neutral-700 capitalize">
                  {subLoading ? '...' : subscription?.plan ?? 'Free'}
                </span>
              </div>
            </div>
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
          className="mt-8"
        >
          <div className="border border-red-200 bg-white p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono text-xs text-neutral-900">Sign out</p>
                <p className="font-mono text-[10px] text-neutral-400">
                  You'll need to sign back in to access your account.
                </p>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center justify-center gap-2 border border-red-200 bg-transparent px-4 py-2.5 text-red-500 transition-all hover:bg-red-50 hover:border-red-300 sm:flex-shrink-0"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="font-mono text-[10px] uppercase tracking-[0.1em]">Sign Out</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </PageWrapper>
  );
};

export default Account;
