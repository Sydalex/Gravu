import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { LogOut, Check, Zap, Pencil, Crown, CreditCard, Loader2, Plus, Shield, ArrowRight, Trash2 } from 'lucide-react';
import { PageWrapper } from '@/components/PageWrapper';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { useAppSignOut } from '@/hooks/use-app-sign-out';
import { toast } from '@/components/ui/sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  'Continue converting after your free process',
  'Monthly plan access plus extra credit purchases',
  'Photo to Vector and Vectorize Linework',
  'DXF + SVG + PNG exports',
  'Full conversion history',
  'Billing management via Stripe',
];

const freeFeatures = [
  'One free successful process',
  'Buy credits anytime after the free process',
  'Photo to Vector and Vectorize Linework',
  'PNG, SVG, DXF exports',
  'Conversion history',
];

function formatPlanLabel(plan?: SubscriptionStatus['plan'] | null): string {
  switch (plan) {
    case 'lite':
      return 'Gravu Lite';
    case 'pro':
      return 'Gravu Pro';
    case 'expert':
      return 'Gravu Expert';
    case 'free':
    default:
      return 'Free Trial';
  }
}

interface SubscriptionCardProps {
  subscription: SubscriptionStatus | undefined;
  isLoading: boolean;
}

const SubscriptionCard = ({ subscription, isLoading }: SubscriptionCardProps) => {
  const isPro = subscription?.plan === 'pro';
  const isCanceling = isPro && subscription?.cancelAtPeriodEnd;
  const activeProPriceId = subscription?.activeProPriceId ?? null;
  const activeCreditsPackPriceId = subscription?.activeCreditsPackPriceId ?? null;
  const activeCreditsPackAmount = subscription?.activeCreditsPackAmount ?? null;

  const checkoutMutation = useMutation({
    mutationFn: () =>
      api.post<{ url: string }>('/api/payments/checkout', {
        priceId: activeProPriceId,
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
            Free Trial
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
            Credits available
          </span>
          <span className="font-mono text-[10px] font-semibold text-neutral-700">
            {subscription?.isAdmin ? '∞' : subscription?.credits ?? 0}
          </span>
        </div>
        {!subscription?.isAdmin && (subscription?.credits ?? 0) === 0 && (
          <p className="mt-1 font-mono text-[9px] text-amber-600">
            Free process used. Upgrade or buy credits to continue converting.
          </p>
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
              onClick={() =>
                activeCreditsPackPriceId && activeCreditsPackAmount
                  ? buyMutation.mutate({
                      credits: activeCreditsPackAmount,
                      priceId: activeCreditsPackPriceId,
                    })
                  : null
              }
              disabled={buyMutation.isPending || !activeCreditsPackPriceId || !activeCreditsPackAmount}
              className="flex w-full items-center justify-center gap-2 border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-neutral-600 transition-all hover:border-neutral-300 disabled:opacity-50"
            >
              {buyMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              <span className="font-mono text-[9px] uppercase tracking-[0.1em]">
                {activeCreditsPackAmount ? `Buy ${activeCreditsPackAmount} credits` : 'Credit pack unavailable'}
              </span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <button
            onClick={() => checkoutMutation.mutate()}
            disabled={checkoutMutation.isPending || !activeProPriceId}
            className="flex w-full items-center justify-center gap-2 border border-orange-500 bg-orange-500 px-4 py-3 text-white transition-all hover:bg-orange-600 disabled:opacity-50"
          >
            {checkoutMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            <span className="font-mono text-[10px] uppercase tracking-[0.1em]">Upgrade to Pro</span>
          </button>
          <p className="text-center font-mono text-[9px] text-neutral-400">
            {activeProPriceId
              ? 'Includes one free successful process before upgrade or credits are required.'
              : 'No active Pro price configured yet.'}
          </p>
          {!subscription?.isAdmin && (
            <button
              onClick={() =>
                activeCreditsPackPriceId && activeCreditsPackAmount
                  ? buyMutation.mutate({
                      credits: activeCreditsPackAmount,
                      priceId: activeCreditsPackPriceId,
                    })
                  : null
              }
              disabled={buyMutation.isPending || !activeCreditsPackPriceId || !activeCreditsPackAmount}
              className="flex w-full items-center justify-center gap-2 border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-neutral-600 transition-all hover:border-neutral-300 disabled:opacity-50"
            >
              {buyMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              <span className="font-mono text-[9px] uppercase tracking-[0.1em]">
                {activeCreditsPackAmount ? `Buy ${activeCreditsPackAmount} credits` : 'Credit pack unavailable'}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const Account = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const user = session?.user;
  const { signOutUser, isSigningOut } = useAppSignOut();

  const [editingName, setEditingName] = useState(false);
  const [displayName, setDisplayName] = useState(user?.name ?? '');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => api.get<SubscriptionStatus>('/api/payments/subscription'),
    staleTime: 30_000,
  });

  const upgraded = new URLSearchParams(window.location.search).get('upgraded') === '1';
  const creditsAdded = new URLSearchParams(window.location.search).get('credits') === '1';

  const deleteAccountMutation = useMutation({
    mutationFn: () => api.delete('/api/account/me'),
    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      window.location.replace('/welcome');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Failed to delete account.';
      toast.error(message);
    },
  });

  return (
    <PageWrapper className="pt-20">
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="border-red-200 bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[22px] font-black tracking-[-0.7px] text-[#332e24]">
              Delete account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="font-mono text-[11px] leading-5 text-[#6c6354]">
              This permanently removes your Gravu account, conversion archive, marketplace submissions, and stored credits.
            </p>
            <p className="font-mono text-[11px] leading-5 text-[#b42318]">
              Active Stripe subscriptions are canceled before deletion. This cannot be undone.
            </p>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => deleteAccountMutation.mutate()}
              disabled={deleteAccountMutation.isPending}
              className="flex flex-1 items-center justify-center gap-2 border border-red-500 bg-red-500 px-4 py-3 text-white transition-all hover:bg-red-600 disabled:opacity-50"
            >
              {deleteAccountMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              <span className="font-mono text-[10px] uppercase tracking-[0.1em]">
                {deleteAccountMutation.isPending ? 'Deleting' : 'Delete Account'}
              </span>
            </button>
            <button
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleteAccountMutation.isPending}
              className="flex flex-1 items-center justify-center border border-neutral-300 px-4 py-3 text-neutral-700 transition-all hover:border-neutral-400 disabled:opacity-50"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.1em]">Cancel</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

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
            <span data-bird-perch="account">Account.</span>
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
                  {subLoading ? '...' : formatPlanLabel(subscription?.plan)}
                </span>
              </div>
            </div>

            {subscription?.isAdmin && (
              <>
                <div className="h-px bg-neutral-200" />
                <button
                  onClick={() => navigate('/admin')}
                  className="flex w-full items-center justify-between border border-orange-500/20 bg-orange-500/5 px-4 py-3 text-left transition-all hover:border-orange-500/35 hover:bg-orange-500/10"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center border border-orange-500/20 bg-white">
                      <Shield className="h-3.5 w-3.5 text-orange-500" />
                    </span>
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-orange-600">
                        Admin access
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-neutral-500">
                        Open the operator workspace
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-orange-500" />
                </button>
              </>
            )}
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

        {/* Session actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-8 grid gap-4"
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
                onClick={signOutUser}
                disabled={isSigningOut}
                className="flex items-center justify-center gap-2 border border-red-200 bg-transparent px-4 py-2.5 text-red-500 transition-all hover:bg-red-50 hover:border-red-300 disabled:opacity-50 sm:flex-shrink-0"
              >
                {isSigningOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                <span className="font-mono text-[10px] uppercase tracking-[0.1em]">
                  {isSigningOut ? 'Signing Out' : 'Sign Out'}
                </span>
              </button>
            </div>
          </div>

          <div className="border border-red-200 bg-white p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono text-xs text-neutral-900">Delete account</p>
                <p className="font-mono text-[10px] text-neutral-400">
                  Permanently remove this account and all Gravu data linked to it.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteDialog(true)}
                disabled={deleteAccountMutation.isPending}
                className="flex items-center justify-center gap-2 border border-red-200 bg-transparent px-4 py-2.5 text-red-500 transition-all hover:bg-red-50 hover:border-red-300 disabled:opacity-50 sm:flex-shrink-0"
              >
                {deleteAccountMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                <span className="font-mono text-[10px] uppercase tracking-[0.1em]">
                  {deleteAccountMutation.isPending ? 'Deleting' : 'Delete Account'}
                </span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </PageWrapper>
  );
};

export default Account;
