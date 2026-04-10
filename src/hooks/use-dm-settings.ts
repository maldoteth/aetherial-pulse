import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { withWalletHeader } from '@/lib/supabase-wallet-client';
import { toast } from 'sonner';

export type WhoCanMessage = 'everyone' | 'none';

interface DmStatusResponse {
  disables?: string[];
  perMessageFee?: number;
  freeAccessUsers?: string[];
}

function deriveWhoCanMessage(disables?: string[]): WhoCanMessage {
  if (!disables || disables.length === 0) return 'everyone';
  const hasDisable = disables.some((d) => !d.startsWith('ACTIVE'));
  return hasDisable ? 'none' : 'everyone';
}

function toStatusPayload(value: WhoCanMessage): { status: string; action: string } {
  switch (value) {
    case 'none':
      return { status: 'NEW_DM', action: 'disable' };
    case 'everyone':
    default:
      return { status: 'NEW_DM', action: 'enable' };
  }
}

function parseDmSettings(raw: unknown): DmStatusResponse {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  return {
    disables: Array.isArray(o.disables) ? (o.disables as string[]) : undefined,
    perMessageFee: typeof o.perMessageFee === 'number' ? o.perMessageFee : undefined,
    freeAccessUsers: Array.isArray(o.freeAccessUsers) ? (o.freeAccessUsers as string[]) : undefined,
  };
}

export function useDmSettings() {
  const { walletAddress, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: dmStatus, isLoading } = useQuery({
    queryKey: ['dm-user-status', walletAddress],
    queryFn: async (): Promise<DmStatusResponse> => {
      if (!walletAddress) return {};
      const { data, error } = await supabase
        .from('profiles')
        .select('dm_settings')
        .eq('wallet_address', walletAddress.toLowerCase())
        .maybeSingle();
      if (error) {
        console.error('[useDmSettings] Failed to fetch profile:', error);
        return {};
      }
      return parseDmSettings(data?.dm_settings);
    },
    enabled: !!walletAddress && isAuthenticated,
    staleTime: 30_000,
  });

  const whoCanMessage = deriveWhoCanMessage(dmStatus?.disables);
  const messageFee = dmStatus?.perMessageFee ?? 0;
  const [doNotDisturb, setDoNotDisturbLocal] = useState(() => {
    try {
      return localStorage.getItem('dehub_dnd') === 'true';
    } catch {
      return false;
    }
  });

  const loadDmSettings = async (): Promise<DmStatusResponse> => {
    if (!walletAddress) return {};
    const { data } = await supabase
      .from('profiles')
      .select('dm_settings')
      .eq('wallet_address', walletAddress.toLowerCase())
      .maybeSingle();
    return parseDmSettings(data?.dm_settings);
  };

  const persistDmSettings = async (patch: Partial<DmStatusResponse>) => {
    if (!walletAddress) throw new Error('Not authenticated');
    const base = await loadDmSettings();
    const merged = { ...base, ...patch };
    const { error } = await withWalletHeader(
      supabase
        .from('profiles')
        .upsert(
          {
            wallet_address: walletAddress.toLowerCase(),
            dm_settings: merged,
          },
          { onConflict: 'wallet_address' },
        ),
      walletAddress,
    );
    if (error) throw error;
  };

  const updateMutation = useMutation({
    mutationFn: async (payload: { status: string; action: string }) => {
      const disables =
        payload.action === 'disable' ? ['NEW_DM'] : [];
      await persistDmSettings({ disables });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dm-user-status', walletAddress] });
      toast.success('DM settings updated');
    },
    onError: (error) => {
      console.error('[useDmSettings] Failed to update DM settings:', error);
      toast.error('Failed to update DM settings');
    },
  });

  const updateFeeMutation = useMutation({
    mutationFn: async (fee: number) => {
      await persistDmSettings({ perMessageFee: fee });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dm-user-status', walletAddress] });
      toast.success('DM settings updated');
    },
    onError: (error) => {
      console.error('[useDmSettings] Failed to update fee:', error);
      toast.error('Failed to update message fee');
    },
  });

  return {
    whoCanMessage,
    messageFee,
    doNotDisturb,
    isLoading,
    isUpdating: updateMutation.isPending || updateFeeMutation.isPending,
    updateWhoCanMessage: (value: WhoCanMessage) => {
      const payload = toStatusPayload(value);
      updateMutation.mutate(payload);
    },
    updateMessageFee: (fee: number) => {
      updateFeeMutation.mutate(fee);
    },
    updateDoNotDisturb: (enabled: boolean) => {
      setDoNotDisturbLocal(enabled);
      try {
        localStorage.setItem('dehub_dnd', String(enabled));
      } catch {
        /* ignore */
      }
      toast.success('DM settings updated');
    },
  };
}
