import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, ChevronDown } from 'lucide-react';
import { AiToolModel, AiToolCategory, getToolCostUsd, getToolCostEth, getToolsByCategory, CATEGORY_LABELS } from '@/constants/ai-tools.constants';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { parseUnits } from 'ethers';
import { sendTransaction, waitForTransactionReceipt } from '@wagmi/core';
import { wagmiConfig } from '@/lib/wagmi';
import { getWalletAddress, switchChain, parseTxError } from '@/lib/contracts/aa-utils';
import { getWeb3AuthProvider } from '@/lib/web3auth';
import { BASE_CHAIN_ID } from '@/lib/contracts/dhb-token';

const AI_TREASURY = '0xbf3039b0bb672b268e8384e30d81b1e6a8a43b2c';

interface AiToolPaywallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: AiToolModel;
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
  onConfirm: () => void;
  isProcessing?: boolean;
  category: AiToolCategory;
}

export function AiToolPaywallModal({
  open,
  onOpenChange,
  model,
  selectedModelId,
  onModelChange,
  onConfirm,
  isProcessing = false,
  category,
}: AiToolPaywallModalProps) {
  const [ethPrice, setEthPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [ethBalance, setEthBalance] = useState<number>(0);
  const [balanceLoading, setBalanceLoading] = useState(true);

  const { walletAddress } = useAuth();

  const categoryInfo = CATEGORY_LABELS[category];
  const categoryModels = getToolsByCategory(category);

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
    } catch (err) {
      console.error('Error fetching ETH price:', err);
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

  const costUsd = getToolCostUsd(model);
  const costEth = ethPrice ? getToolCostEth(model, ethPrice) : 0;
  const hasEnoughBalance = ethBalance >= costEth;

  const formatEth = (amount: number) => {
    if (amount < 0.000001) return '<0.000001';
    if (amount < 0.001) return amount.toFixed(6);
    if (amount < 1) return amount.toFixed(4);
    return amount.toFixed(3);
  };

  const handlePayAndExecute = async () => {
    if (costEth <= 0) return;
    setIsPaying(true);
    try {
      await switchChain(BASE_CHAIN_ID);

      const amountWei = parseUnits(costEth.toFixed(18), 18);
      
      toast.loading('Processing ETH payment...', { id: 'ai-tool-payment' });

      // Check if Web3Auth (social login) or external wallet
      const web3authProvider = getWeb3AuthProvider();
      let txHash: string;

      if (web3authProvider) {
        // Web3Auth — send via provider
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
        // External wallet via wagmi
        txHash = await sendTransaction(wagmiConfig, {
          to: AI_TREASURY as `0x${string}`,
          value: amountWei,
          chainId: BASE_CHAIN_ID as any,
        });
      }

      // Wait for confirmation
      await waitForTransactionReceipt(wagmiConfig, {
        hash: txHash as `0x${string}`,
        confirmations: 1,
        chainId: BASE_CHAIN_ID as any,
      });

      toast.success(`Payment confirmed! Processing ${categoryInfo.label.toLowerCase()}...`, { id: 'ai-tool-payment' });
      onConfirm();
    } catch (err: unknown) {
      console.error('[AiToolPaywall] Payment failed:', err);
      const msg = parseTxError(err);
      toast.dismiss('ai-tool-payment');
      toast.error(msg || 'Payment failed.');
    } finally {
      setIsPaying(false);
    }
  };

  const gradientColors: Record<string, string> = {
    purple: 'from-purple-900/30 to-pink-900/30 border-purple-500/20',
    cyan: 'from-cyan-900/30 to-blue-900/30 border-cyan-500/20',
    green: 'from-green-900/30 to-emerald-900/30 border-green-500/20',
    amber: 'from-amber-900/30 to-orange-900/30 border-amber-500/20',
    blue: 'from-blue-900/30 to-indigo-900/30 border-blue-500/20',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-black/60 backdrop-blur-[24px] border border-white/10 shadow-2xl max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <span className="text-xl">{categoryInfo.emoji}</span>
            {categoryInfo.label}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Select a model and confirm payment
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Model Selector */}
          {categoryModels.length > 1 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setModelSelectorOpen(!modelSelectorOpen)}
                className="w-full bg-zinc-800/50 hover:bg-zinc-800 transition-colors rounded-xl p-4 text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{model.emoji}</span>
                    <div>
                      <p className="font-medium text-white">{model.name}</p>
                      <p className="text-sm text-zinc-500">{model.description}</p>
                    </div>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-zinc-400 transition-transform ${modelSelectorOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {modelSelectorOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden z-10 max-h-64 overflow-y-auto">
                  {categoryModels.map((option) => {
                    const optionCostUsd = getToolCostUsd(option);
                    const optionCostEth = ethPrice ? getToolCostEth(option, ethPrice) : 0;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          onModelChange(option.id);
                          setModelSelectorOpen(false);
                        }}
                        className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-700 transition-colors ${
                          selectedModelId === option.id ? 'bg-zinc-700/50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{option.emoji}</span>
                          <div>
                            <p className="font-medium text-white text-sm">{option.name}</p>
                            <p className="text-xs text-zinc-500">{option.description}</p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-medium text-white">${optionCostUsd.toFixed(2)}</p>
                          <p className="text-xs text-zinc-500">{formatEth(optionCostEth)} ETH</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Single model display */}
          {categoryModels.length === 1 && (
            <div className="bg-zinc-800/50 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{model.emoji}</span>
                <div>
                  <p className="font-medium text-white">{model.name}</p>
                  <p className="text-sm text-zinc-500">{model.description}</p>
                </div>
              </div>
            </div>
          )}

          {/* Cost Breakdown */}
          <div className="bg-zinc-800/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">{categoryInfo.label} Cost</span>
              <span className="text-zinc-300">${costUsd.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Staker Discount</span>
              <span className="text-white font-bold">0%</span>
            </div>
            <div className="border-t border-zinc-700 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-zinc-300 font-medium">Total</span>
                <span className="text-white font-semibold">${costUsd.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* ETH Cost */}
          <div className={`bg-gradient-to-r ${gradientColors[categoryInfo.color] || gradientColors.purple} rounded-xl p-4 border`}>
            {loading ? (
              <div className="flex items-center justify-center py-2">
                <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
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
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            variant="glass"
            className="flex-1 font-medium"
            onClick={handlePayAndExecute}
            disabled={loading || balanceLoading || !hasEnoughBalance || isProcessing || isPaying}
          >
            {isPaying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Paying...
              </>
            ) : isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Confirm & Pay'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
