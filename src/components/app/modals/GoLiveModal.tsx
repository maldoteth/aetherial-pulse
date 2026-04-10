import { useState, useEffect, useMemo } from 'react';
import { Radio, Loader2, Copy, Check, ExternalLink, Hash, Search, X, Plus } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { LiquidGlassBubble2 } from '@/components/ui/liquid-glass-bubble-2';
import { mintPost } from '@/lib/api/dehub/content';
import { getWeb3AuthSigner, BASE_CHAIN_ID } from '@/lib/contracts';
import { getCategories } from '@/lib/api/dehub/feed';
import type { DeHubCategory } from '@/lib/api/dehub/types';
import { createLogger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const logger = createLogger('GoLiveModal');


interface GoLiveModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'setup' | 'ready' | 'streaming';

const MAX_CATEGORIES = 5;

export function GoLiveModal({ isOpen, onClose }: GoLiveModalProps) {
  const { walletAddress } = useAuth();
  const [step, setStep] = useState<Step>('setup');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamData, setStreamData] = useState<{ tokenId: string; streamKey: string; ingestUrl: string; playbackUrl: string; streamId: string; hlsUrl?: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Category drawer state
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [categories, setCategories] = useState<DeHubCategory[]>([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Load saved default categories
  useEffect(() => {
    if (isOpen && !selectedCategory) {
      const saved = localStorage.getItem('post_default_categories');
      if (saved) setSelectedCategory(saved);
    }
  }, [isOpen]);

  // Fetch categories when drawer opens
  useEffect(() => {
    if (categoryDrawerOpen && categories.length === 0) {
      setLoadingCategories(true);
      getCategories()
        .then(setCategories)
        .catch(console.error)
        .finally(() => setLoadingCategories(false));
    }
  }, [categoryDrawerOpen, categories.length]);

  const selectedCategoriesArray = useMemo(() =>
    selectedCategory ? selectedCategory.split('|||').filter(Boolean) : [],
    [selectedCategory]
  );

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    const q = categorySearch.toLowerCase();
    return categories.filter(c => c.name.toLowerCase().includes(q));
  }, [categories, categorySearch]);

  const toggleCategory = (name: string) => {
    const current = selectedCategoriesArray;
    if (current.includes(name)) {
      const next = current.filter(c => c !== name);
      setSelectedCategory(next.join('|||'));
    } else if (current.length < MAX_CATEGORIES) {
      setSelectedCategory([...current, name].join('|||'));
    }
  };

  const removeCategory = (name: string) => {
    const next = selectedCategoriesArray.filter(c => c !== name);
    setSelectedCategory(next.join('|||'));
  };

  const handleClose = () => {
    setStep('setup');
    setTitle('');
    setDescription('');
    setSelectedCategory('');
    setStreamData(null);
    onClose();
  };

  const handleEndStream = async () => {
    if (!streamData?.tokenId) return;
    const addr = walletAddress?.toLowerCase();

    if (addr) {
      try {
        await supabase.functions.invoke('end-stream-session', {
          body: { tokenId: streamData.tokenId },
          headers: { 'x-wallet-address': addr },
        });
      } catch (e) {
        logger.warn('end-stream-session failed', e);
      }
    }
    handleClose();
  };

  const handleStartStream = async () => {
    if (!title.trim()) {
      toast.error('Please enter a stream title');
      return;
    }

    setIsLoading(true);
    logger.info('User initiated "Go Live"', { title, selectedCategoriesArray });
    try {
      // Step 1: Get user's wallet address for minting
      const minterAddress = await getWeb3AuthSigner();
      logger.info('Minter address obtained', { minterAddress });

      // Step 2: Mint the live post via /api/user_mint
      logger.info('Minting live post...', { title });

      toast.loading('Creating live post & Cloudflare stream…', { id: 'golive-progress', duration: Infinity });

      const mintResponse = await mintPost({
        name: title.trim(),
        description: description.trim(),
        postType: 'live',
        chainId: BASE_CHAIN_ID,
        category: selectedCategoriesArray.length > 0 ? selectedCategoriesArray : ['General'],
        minterAddress,
        streamInfo: {
          isLockContent: false,
          isPayPerView: false,
          isAddBounty: false,
        },
      });

      const tokenId = mintResponse.createdTokenId;
      logger.info('Live post created in Supabase', { tokenId });

      const addr = (walletAddress || minterAddress).toLowerCase();

      const { data: ingestData, error: ingestErr } = await supabase.functions.invoke('get-stream-ingest', {
        body: { tokenId },
        headers: { 'x-wallet-address': addr },
      });

      toast.dismiss('golive-progress');

      if (ingestErr || !ingestData?.ingestUrl || !ingestData?.streamKey) {
        const msg =
          (ingestData as { message?: string })?.message ||
          ingestErr?.message ||
          'Cloudflare Stream is not configured or ingest failed. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_STREAM_API_TOKEN on the get-stream-ingest Edge Function.';
        throw new Error(msg);
      }

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const playbackPath =
        typeof ingestData.playbackUrl === 'string' && ingestData.playbackUrl.startsWith('http')
          ? ingestData.playbackUrl
          : `${origin}/post/${tokenId}`;

      const resultData = {
        tokenId,
        streamId: String(ingestData.streamId || ingestData.uid || tokenId),
        streamKey: ingestData.streamKey as string,
        ingestUrl: ingestData.ingestUrl as string,
        playbackUrl: playbackPath,
        hlsUrl: ingestData.hlsUrl as string | undefined,
      };

      setStreamData(resultData);
      setStep('ready');
      logger.info('Cloudflare stream ready', { tokenId, streamId: resultData.streamId });
      toast.success('Live stream is ready!');

      supabase.functions
        .invoke('mark-stream-live', {
          body: { tokenId, streamId: resultData.streamId },
          headers: { 'x-wallet-address': addr },
        })
        .then(({ error }) => {
          if (error) logger.warn('mark-stream-live failed (non-blocking)', error);
        });
    } catch (error) {
      toast.dismiss('golive-progress');
      logger.error('Failed to start stream', { title, selectedCategory }, error);
      
      const errorMsg = error instanceof Error ? error.message : '';
      const isWeb3AuthError = errorMsg.includes('Web3Auth');
      // "overflow" or "INVALID_ARGUMENT" often happen during gas calculation or signing
      const isSigningError = errorMsg.includes('overflow') || errorMsg.includes('INVALID_ARGUMENT') || errorMsg.includes('user rejected');

      if (isWeb3AuthError) {
        toast.error('Web3Auth service is currently slow or timing out. Please check your internet or try refreshing.');
      } else if (isSigningError) {
        toast.error('Blockchain signing failed. Please check your wallet or refresh the page.');
      } else {
        toast.error(errorMsg || 'Failed to create stream');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const inputClass = "w-full h-12 px-4 text-base bg-zinc-800/50 border border-white/20 rounded-xl text-white placeholder:text-zinc-500 outline-none focus:border-white/50";

  return (
    <Drawer open={isOpen} onOpenChange={handleClose}>
      <DrawerContent glass className="max-h-[90vh] px-4 pb-8">
        <DrawerHeader className="border-b border-white/10 mb-4 relative">
          <DrawerTitle className="text-white flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            {step === 'setup' ? 'Go Live' : 'Stream Ready'}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            Configure your livestream settings or get your RTMP credentials.
          </DrawerDescription>
          <button
            onClick={handleClose}
            className="absolute top-1/2 -translate-y-1/2 right-0 w-8 h-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-1 custom-scrollbar">
          {step === 'setup' ? (
            <div className="space-y-4 pb-4">
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Stream Title *</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What's your stream about?"
                  className="bg-zinc-800 border-zinc-700 text-white"
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Description</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell viewers what to expect..."
                  className="bg-zinc-800 border-zinc-700 text-white resize-none"
                  rows={3}
                  maxLength={500}
                />
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setCategoryDrawerOpen(true)}
                  className="flex items-center justify-between w-full"
                >
                  <label className="text-sm text-zinc-400 flex items-center gap-2 cursor-pointer">
                    <Hash className="w-4 h-4" />
                    Category
                  </label>
                  <span className="text-xs text-white/50 hover:text-white">
                    {selectedCategoriesArray.length > 0 ? 'Edit' : 'Add'}
                  </span>
                </button>
                {selectedCategoriesArray.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCategoriesArray.map((cat) => (
                      <span key={cat} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-white/10 text-white border border-white/10">
                        {cat}
                        <button type="button" onClick={() => removeCategory(cat)}>
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {streamData && (
                <>

                  <div className="space-y-2">
                    <label className="text-sm text-white font-medium">Stream Key</label>
                    <div className="flex gap-2">
                      <Input value={streamData.streamKey} readOnly type="password" className="bg-zinc-800 border-zinc-700 font-mono" />
                      <Button variant="outline" size="icon" onClick={() => copyToClipboard(streamData.streamKey, 'key')}>
                        {copiedField === 'key' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-white font-medium">Ingest URL</label>
                    <div className="flex gap-2">
                      <Input value={streamData.ingestUrl} readOnly className="bg-zinc-800 border-zinc-700 font-mono text-xs" />
                      <Button variant="outline" size="icon" onClick={() => copyToClipboard(streamData.ingestUrl, 'url')}>
                        {copiedField === 'url' ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="bg-zinc-800/50 rounded-xl p-4 space-y-2">
                    <p className="text-white font-medium text-xs uppercase tracking-wider">Quick Setup Guide:</p>
                    <ol className="text-xs text-zinc-400 space-y-1 list-decimal list-inside">
                      <li>Open OBS → Settings → Stream</li>
                      <li>Select "Custom" Service</li>
                      <li>Paste Ingest URL & Stream Key</li>
                      <li>Click "Start Streaming"</li>
                    </ol>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="pt-4 mt-2">
          {step === 'setup' ? (
            <LiquidGlassBubble2
              label={isLoading ? '' : 'Go Live'}
              icon={isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Radio className="w-5 h-5" />}
              onClick={handleStartStream}
              disabled={!title.trim() || isLoading}
              width="100%"
              height="56px"
            />
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleEndStream}
                className="flex-1 h-14 flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-white/10 transition-colors"
              >
                <Radio className="w-4 h-4" /> End Stream
              </button>
              <button
                onClick={() => window.open(streamData?.playbackUrl, '_blank')}
                className="flex-1 h-14 flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-white/10 transition-colors"
              >
                <ExternalLink className="w-4 h-4" /> View Stream
              </button>
            </div>
          )}
        </div>
      </DrawerContent>

      <Drawer open={categoryDrawerOpen} onOpenChange={setCategoryDrawerOpen}>
        <DrawerContent glass hideHandle className="max-h-[60vh]">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-medium">Categories</h3>
              <button onClick={() => setCategoryDrawerOpen(false)} className="text-sm text-zinc-400 hover:text-white">Done</button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder="Search..."
                className="w-full h-11 bg-zinc-800 border border-white/10 rounded-xl pl-10 pr-4 text-white text-sm outline-none focus:border-white/20"
              />
            </div>
            <div className="overflow-y-auto max-h-[30vh] space-y-1">
              {categorySearch.trim() && !filteredCategories.some(c => c.name.toLowerCase() === categorySearch.trim().toLowerCase()) && (
                <button
                  onClick={() => {
                    const name = categorySearch.trim();
                    if (name && selectedCategoriesArray.length < MAX_CATEGORIES && !selectedCategoriesArray.includes(name)) {
                      setSelectedCategory([...selectedCategoriesArray, name].join('|||'));
                      setCategorySearch('');
                    }
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 rounded-xl text-sm text-white hover:bg-white/5 transition-colors"
                >
                  <Plus className="w-4 h-4 text-zinc-400" />
                  Create "{categorySearch.trim()}"
                </button>
              )}
              {filteredCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => toggleCategory(cat.name)}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-colors",
                    selectedCategoriesArray.includes(cat.name) ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5"
                  )}
                >
                  {cat.name}
                  {selectedCategoriesArray.includes(cat.name) && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </Drawer>
  );
}
