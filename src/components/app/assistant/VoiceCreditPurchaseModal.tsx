/**
 * Voice Credit Purchase Modal
 * ===========================
 * Lets users buy prepaid voice exchange bundles (10, 100, 500).
 * Payment via native ETH transfer on Base.
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AudioLines, AlertCircle, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { parseUnits } from 'ethers';
import { sendTransaction, waitForTransactionReceipt } from '@wagmi/core';
import { wagmiConfig } from '@/lib/wagmi';
import { getWalletAddress, switchChain, parseTxError } from '@/lib/contracts/aa-utils';
import { getWeb3AuthProvider } from '@/lib/web3auth';
import { BASE_CHAIN_ID } from '@/lib/contracts/dhb-token';
import { VOICE_BUNDLES, type VoiceBundleSize, getBundleCostEth } from '@/hooks/use-voice-credits';

const AI_TREASURY = '0xbf3039b0bb672b268e8384e30d81b1e6a8a43b2c';

interface VoiceCreditPurchaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCredits: number;
  onPurchaseComplete: (bundleSize: VoiceBundleSize) => void;
}

export function VoiceCreditPurchaseModal({
  open,
  onOpenChange,
  currentCredits,
  onPurchaseComplete,
}: VoiceCreditPurchaseModalProps) {
  const [ethPrice, setEthPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBundle, setSelectedBundle] = useState<VoiceBundleSize>(100);
  const [isPaying, setIsPaying] = useState(false);
  const [ethBalance, setEthBalance] = useState<number>(0);
  const [balanceLoading, setBalanceLoading] = useState(true);

  const { walletAddress } = useAuth();

  useEffect(() => {
    if (open) {
      fetchEthPrice();
      if (walletAddress) fetchEthBalance();
    }
  }, [open, walletAddress]);

  const fetchEthPrice = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase.functions.invoke('get-dhb-price');
      if (fetchError) throw fetchError;
      const price = data?.prices?.ETH;
      if (price) setEthPrice(price);
      else throw new Error('Failed to get ETH price');
    } catch {
      setError('Failed to fetch ETH price. Using fallback.');
      setEthPrice(2000);
    } finally {
      setLoading(false);
    }
  };

  const fetchEthBalance = async () => {
    setBalanceLoading(true);
    try {
      const address = walletAddress || await getWalletAddress();
      const response = await fetch(`https://base-mainnet.g.alchemy.com/v2/demo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getBalance', params: [address, 'latest'], id: 1 }),
      });
      const result = await response.json();
      const balanceWei = BigInt(result.result || '0');
      setEthBalance(Number(balanceWei) / 1e18);
    } catch {
      setEthBalance(0);
    } finally {
      setBalanceLoading(false);
    }
  };

  const bundle = VOICE_BUNDLES.find(b => b.size === selectedBundle)!;
  const costEth = ethPrice ? getBundleCostEth(bundle, ethPrice) : 0;
  const hasEnoughBalance = ethBalance >= costEth;

  const formatEth = (amount: number) => {
    if (amount < 0.000001) return '<0.000001';
    if (amount < 0.001) return amount.toFixed(6);
    if (amount < 1) return amount.toFixed(4);
    return amount.toFixed(3);
  };

  const handlePurchase = async () => {
    if (costEth <= 0) return;
    setIsPaying(true);
    try {
      await switchChain(BASE_CHAIN_ID);

      const amountWei = parseUnits(costEth.toFixed(18), 18);

      toast.loading('Processing ETH payment...', { id: 'voice-credit-payment' });

      const web3authProvider = getWeb3AuthProvider();
      let txHash: string;

      if (web3authProvider) {
        const from = await getWalletAddress();
        txHash = await web3authProvider.request({
          method: 'eth_sendTransaction',
          params: [{
            from,
            to: AI_TREASURY,
            value: '0x' + amountWei.toString(16),
          }],
        }) as string;
      } else {
        txHash = await sendTransaction(wagmiConfig, {
          to: AI_TREASURY as `0x${string}`,
          value: amountWei,
          chainId: BASE_CHAIN_ID as any,
        });
      }

      await waitForTransactionReceipt(wagmiConfig, {
        hash: txHash as `0x${string}`,
        confirmations: 1,
        chainId: BASE_CHAIN_ID as any,
      });

      toast.success(`${bundle.size} voice credits purchased!`, { id: 'voice-credit-payment' });
      onPurchaseComplete(bundle.size);
      onOpenChange(false);
    } catch (err: unknown) {
      console.error('[VoiceCredits] Payment failed:', err);
      const msg = parseTxError(err);
      toast.dismiss('voice-credit-payment');
      toast.error(msg || 'Payment failed.');
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-black/60 backdrop-blur-[24px] border border-white/10 shadow-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <AudioLines className="w-5 h-5 text-cyan-400" />
            Voice Chat Credits
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Buy voice exchange bundles — each exchange uses credits
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Credits */}
          {currentCredits > 0 && (
            <div className="bg-cyan-900/20 border border-cyan-500/20 rounded-xl p-3 flex items-center justify-between">
              <span className="text-cyan-400 text-sm">Current Credits</span>
              <span className="text-white font-semibold">{currentCredits}</span>
            </div>
          )}

          {/* Bundle Selection */}
          <div className="space-y-2">
            {VOICE_BUNDLES.map((b) => {
              const bCostEth = ethPrice ? getBundleCostEth(b, ethPrice) : 0;
              const isSelected = selectedBundle === b.size;
              return (
                <button
                  key={b.size}
                  type="button"
                  onClick={() => setSelectedBundle(b.size)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl transition-all ${
                    isSelected
                      ? 'bg-cyan-500/10 border border-cyan-500/30'
                      : 'bg-zinc-800/50 border border-transparent hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isSelected && <Check className="w-4 h-4 text-white shrink-0" />}
                    <div className="text-left">
                      <p className="font-medium text-white">{b.label}</p>
                      <p className="text-xs text-zinc-500">
                        ${b.perExchangeUsd.toFixed(3)}/exchange
                        {b.discount > 0 && (
                          <span className="ml-1.5 text-white font-bold">({b.discount}% off)</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-white">${b.totalUsd.toFixed(2)}</p>
                    {!loading && <p className="text-xs text-zinc-500">{formatEth(bCostEth)} ETH</p>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* ETH Payment Section */}
          <div className="bg-gradient-to-r from-cyan-900/30 to-purple-900/30 rounded-xl p-4 border border-cyan-500/20">
            {loading ? (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                <span className="ml-2 text-zinc-400">Fetching ETH price...</span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⟠</span>
                    <span className="text-white font-medium">Pay with ETH</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-white">{formatEth(costEth)} ETH</p>
                    <p className="text-xs text-zinc-500">@ ${ethPrice?.toFixed(2)}/ETH</p>
                  </div>
                </div>
                {error && (
                  <div className="flex items-center gap-2 mt-2 text-yellow-500 text-xs">
                    <AlertCircle className="w-3 h-3" />
                    <span>{error}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* User Balance */}
          <div className="flex items-center justify-between text-sm bg-zinc-800/30 rounded-lg p-3">
            <span className="text-zinc-400">Your ETH Balance</span>
            <div className="flex items-center gap-2">
              <span className="text-lg">⟠</span>
              {balanceLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
              ) : (
                <span className={hasEnoughBalance ? 'text-white font-bold' : 'text-red-400'}>
                  {formatEth(ethBalance)} ETH
                </span>
              )}
            </div>
          </div>

          {!hasEnoughBalance && !loading && !balanceLoading && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
              <p className="text-red-400 text-sm text-center">
                Insufficient ETH balance. You need {formatEth(costEth - ethBalance)} more ETH.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
            onClick={() => onOpenChange(false)}
            disabled={isPaying}
          >
            Cancel
          </Button>
          <Button
            variant="glass"
            className="flex-1 font-medium"
            onClick={handlePurchase}
            disabled={loading || balanceLoading || !hasEnoughBalance || isPaying}
          >
            {isPaying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Paying...
              </>
            ) : (
              `Buy ${selectedBundle} Credits`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
