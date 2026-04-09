/**
 * Re-Authentication Handler Hook
 * ==============================
 * Detects auth failures and prompts the user to sign in again.
 */

import { useAuth } from '@/contexts/AuthContext';
import { AuthenticationError } from '@/lib/api/dehub';
import { toast } from 'sonner';

export function useReauthHandler() {
  const { openLoginModal } = useAuth();

  const handleApiError = async (error: unknown, fallbackMessage: string): Promise<boolean> => {
    if (error instanceof AuthenticationError) {
      toast.error('Session expired', {
        description: 'Please sign in again to continue',
        action: {
          label: 'Sign in',
          onClick: openLoginModal,
        },
        duration: 8000,
      });
      return true;
    }
    
    toast.error(fallbackMessage);
    return false;
  };

  return { handleApiError };
}
