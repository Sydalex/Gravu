import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";
import { isPreviewAuthBypassEnabled, previewSession } from "@/lib/preview-mode";

const rawAuthClient = createAuthClient({
  baseURL: import.meta.env.VITE_BACKEND_URL || undefined,
  plugins: [emailOTPClient()],
  fetchOptions: {
    credentials: "include",
  },
});

export const authClient = {
  ...rawAuthClient,
  signUp: {
    ...rawAuthClient.signUp,
    email: ((...args: unknown[]) => {
      if (isPreviewAuthBypassEnabled()) {
        return Promise.resolve({ data: { user: previewSession.user }, error: null });
      }
      return (rawAuthClient.signUp.email as (...innerArgs: unknown[]) => unknown)(...args);
    }) as typeof rawAuthClient.signUp.email,
  },
  signIn: {
    ...rawAuthClient.signIn,
    email: ((...args: unknown[]) => {
      if (isPreviewAuthBypassEnabled()) {
        return Promise.resolve({ data: { user: previewSession.user }, error: null });
      }
      return (rawAuthClient.signIn.email as (...innerArgs: unknown[]) => unknown)(...args);
    }) as typeof rawAuthClient.signIn.email,
    emailOtp: ((...args: unknown[]) => {
      if (isPreviewAuthBypassEnabled()) {
        return Promise.resolve({ data: { user: previewSession.user }, error: null });
      }
      return (rawAuthClient.signIn.emailOtp as (...innerArgs: unknown[]) => unknown)(...args);
    }) as typeof rawAuthClient.signIn.emailOtp,
  },
  emailOtp: {
    ...rawAuthClient.emailOtp,
    sendVerificationOtp: ((...args: unknown[]) => {
      if (isPreviewAuthBypassEnabled()) {
        return Promise.resolve({ data: { success: true }, error: null });
      }
      return (rawAuthClient.emailOtp.sendVerificationOtp as (...innerArgs: unknown[]) => unknown)(...args);
    }) as typeof rawAuthClient.emailOtp.sendVerificationOtp,
  },
} as typeof rawAuthClient;

type UseSessionReturn = ReturnType<typeof rawAuthClient.useSession>;

export function useSession(): UseSessionReturn {
  if (isPreviewAuthBypassEnabled()) {
    return {
      data: previewSession,
      isPending: false,
      error: null,
      refetch: async () => ({ data: previewSession }),
    } as UseSessionReturn;
  }
  return rawAuthClient.useSession();
}

export const signOut = ((...args: unknown[]) => {
  if (isPreviewAuthBypassEnabled()) {
    return Promise.resolve({ data: null, error: null });
  }
  return (rawAuthClient.signOut as (...innerArgs: unknown[]) => unknown)(...args);
}) as typeof rawAuthClient.signOut;
