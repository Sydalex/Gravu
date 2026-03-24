import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { signOut } from '@/lib/auth-client';
import { toast } from '@/components/ui/sonner';

function getSignOutErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'Failed to sign out. Please try again.';
}

export function useAppSignOut() {
  const queryClient = useQueryClient();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const signOutUser = useCallback(async () => {
    if (isSigningOut) return;

    setIsSigningOut(true);

    try {
      const result = await signOut();

      if (result?.error) {
        throw new Error(result.error.message || 'Failed to sign out. Please try again.');
      }

      await queryClient.cancelQueries();
      queryClient.clear();
      window.location.replace('/login');
    } catch (error) {
      setIsSigningOut(false);
      toast.error(getSignOutErrorMessage(error));
    }
  }, [isSigningOut, queryClient]);

  return { signOutUser, isSigningOut };
}
