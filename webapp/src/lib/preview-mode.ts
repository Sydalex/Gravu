import type { SubscriptionStatus } from '../../../backend/src/types';

const rawFlag = (import.meta.env.VITE_PREVIEW_AUTH_BYPASS ?? '').toLowerCase();

export function isPreviewAuthBypassEnabled() {
  return rawFlag === 'true' || rawFlag === '1' || rawFlag === 'yes' || rawFlag === 'on';
}

export const previewSession = {
  user: {
    id: 'preview-user',
    email: 'preview@gravu.local',
    name: 'Preview User',
    emailVerified: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    isAnonymous: false,
  },
  session: {
    id: 'preview-session',
    expiresAt: '2099-01-01T00:00:00.000Z',
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    token: 'preview-auth-bypass',
    userId: 'preview-user',
  },
} as const;

export const previewSubscription: SubscriptionStatus = {
  plan: 'pro',
  status: 'preview',
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  stripeCustomerId: null,
  credits: 99,
  aiCredits: 99,
  vectorizeCredits: 99,
  marketplaceDownloadsUsed: 0,
  marketplaceDownloadsRemaining: 30,
  marketplaceDownloadsLimit: 30,
  freeTrialUsed: true,
  deviceTrialUsed: true,
  isAdmin: false,
  billingEnabled: false,
  activeProPriceId: null,
  activeExpertPriceId: null,
  activeCreditsPackPriceId: null,
  activeCreditsPackAmount: null,
};
