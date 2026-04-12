import { useState, useEffect } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Camera, Loader2, Store } from 'lucide-react';
import { LiquidGlassBubble2 } from '@/components/ui/liquid-glass-bubble-2';
import { useUpdateStore, uploadStoreMedia } from '@/hooks/use-stores';
import { useAuth } from '@/contexts/AuthContext';
import { GLASS_STYLES } from '@/constants/app.constants';
import { toast } from 'sonner';

interface Props {
  store: any;
  open: boolean;
  onClose: () => void;
}

export function EditStoreDrawer({ store, open, onClose }: Props) {
  const { walletAddress } = useAuth();
  const updateStore = useUpdateStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  useEffect(() => {
    if (store) {
      setName(store.name || '');
      setDescription(store.description || '');
      setAvatarUrl(store.avatar_url || '');
      setBannerUrl(store.banner_url || '');
    }
  }, [store]);

  if (!store) return null;

  const handleUpload = async (file: File, type: 'avatar' | 'banner') => {
    if (!walletAddress) return;
    const setter = type === 'avatar' ? setUploadingAvatar : setUploadingBanner;
    setter(true);
    try {
      const url = await uploadStoreMedia(file, walletAddress);
      if (type === 'avatar') setAvatarUrl(url);
      else setBannerUrl(url);
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setter(false);
    }
  };

  const handleSave = () => {
    if (!name.trim()) { toast.error('Store name is required'); return; }
    updateStore.mutate({
      id: store.id,
      name: name.trim(),
      description: description.trim(),
      avatar_url: avatarUrl || null,
      banner_url: bannerUrl || null,
    }, { onSuccess: onClose });
  };

  return (
    <Drawer open={open} onOpenChange={v => !v && onClose()}>
      <DrawerContent className={GLASS_STYLES.drawer}>
        <DrawerHeader><DrawerTitle>Edit Store</DrawerTitle></DrawerHeader>
        <div className="px-4 pb-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Banner */}
          <div>
            <Label className="text-zinc-300 text-xs">Banner</Label>
            <label className="block mt-1 relative w-full aspect-[3/1] rounded-xl overflow-hidden bg-white/5 border border-white/10 cursor-pointer group">
              {bannerUrl ? <img src={bannerUrl} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full bg-gradient-to-br from-white/5 to-white/[0.02] flex items-center justify-center"><Camera className="w-6 h-6 text-zinc-500" /></div>}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                {uploadingBanner ? <Loader2 className="w-5 h-5 animate-spin text-white" /> : <Camera className="w-5 h-5 text-white" />}
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'banner')} />
            </label>
          </div>

          {/* Avatar + Name row */}
          <div className="flex items-start gap-4">
            <label className="relative w-16 h-16 rounded-full overflow-hidden bg-white/10 border border-white/10 cursor-pointer group shrink-0">
              {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center"><Store className="w-6 h-6 text-zinc-500" /></div>}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                {uploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Camera className="w-4 h-4 text-white" />}
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'avatar')} />
            </label>
            <div className="flex-1">
              <Label className="text-zinc-300 text-xs">Store Name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} className="bg-white/5 border-white/10 text-primary-foreground" />
            </div>
          </div>

          <div>
            <Label className="text-zinc-300 text-xs">Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} className="bg-white/5 border-white/10 text-primary-foreground min-h-[80px]" />
          </div>

          <LiquidGlassBubble2
            label="Save Changes"
            loading={updateStore.isPending}
            loadingLabel="Saving..."
            disabled={!name.trim() || uploadingAvatar || uploadingBanner}
            onClick={handleSave}
            width="100%"
            height="42px"
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
