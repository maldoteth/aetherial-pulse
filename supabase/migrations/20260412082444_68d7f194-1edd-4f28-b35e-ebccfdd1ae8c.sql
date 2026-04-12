-- ══════════════════════════════════════════════════
-- Stores
-- ══════════════════════════════════════════════════
CREATE TABLE public.stores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  avatar_url TEXT,
  banner_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view stores" ON public.stores FOR SELECT USING (true);
CREATE POLICY "Owners can create stores" ON public.stores FOR INSERT WITH CHECK (lower(wallet_address) = get_request_wallet_address());
CREATE POLICY "Owners can update stores" ON public.stores FOR UPDATE USING (lower(wallet_address) = get_request_wallet_address());
CREATE POLICY "Owners can delete stores" ON public.stores FOR DELETE USING (lower(wallet_address) = get_request_wallet_address());

-- ══════════════════════════════════════════════════
-- Store Listings
-- ══════════════════════════════════════════════════
CREATE TABLE public.store_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  price NUMERIC NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'other',
  condition TEXT NOT NULL DEFAULT 'new',
  images TEXT[] DEFAULT '{}',
  stock_quantity INTEGER,
  is_digital BOOLEAN NOT NULL DEFAULT false,
  digital_file_url TEXT,
  shipping_info TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.store_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view listings" ON public.store_listings FOR SELECT USING (true);
CREATE POLICY "Owners can create listings" ON public.store_listings FOR INSERT WITH CHECK (lower(wallet_address) = get_request_wallet_address());
CREATE POLICY "Owners can update listings" ON public.store_listings FOR UPDATE USING (lower(wallet_address) = get_request_wallet_address());
CREATE POLICY "Owners can delete listings" ON public.store_listings FOR DELETE USING (lower(wallet_address) = get_request_wallet_address());

-- ══════════════════════════════════════════════════
-- Store Orders
-- ══════════════════════════════════════════════════
CREATE TABLE public.store_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.store_listings(id) ON DELETE CASCADE,
  buyer_address TEXT NOT NULL,
  seller_address TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  tx_hash TEXT NOT NULL,
  shipping_address TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'paid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.store_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers can view own orders" ON public.store_orders FOR SELECT USING (lower(buyer_address) = get_request_wallet_address());
CREATE POLICY "Sellers can view orders" ON public.store_orders FOR SELECT USING (lower(seller_address) = get_request_wallet_address());
CREATE POLICY "Buyers can create orders" ON public.store_orders FOR INSERT WITH CHECK (lower(buyer_address) = get_request_wallet_address());
CREATE POLICY "Sellers can update order status" ON public.store_orders FOR UPDATE USING (lower(seller_address) = get_request_wallet_address());

-- ══════════════════════════════════════════════════
-- Store Reviews
-- ══════════════════════════════════════════════════
CREATE TABLE public.store_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.store_listings(id) ON DELETE CASCADE,
  reviewer_address TEXT NOT NULL,
  rating INTEGER NOT NULL DEFAULT 5,
  comment TEXT DEFAULT '',
  seller_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(listing_id, reviewer_address)
);

ALTER TABLE public.store_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view reviews" ON public.store_reviews FOR SELECT USING (true);
CREATE POLICY "Reviewers can create reviews" ON public.store_reviews FOR INSERT WITH CHECK (lower(reviewer_address) = get_request_wallet_address());
CREATE POLICY "Reviewers can update reviews" ON public.store_reviews FOR UPDATE USING (lower(reviewer_address) = get_request_wallet_address());

-- ══════════════════════════════════════════════════
-- Saved Addresses
-- ══════════════════════════════════════════════════
CREATE TABLE public.saved_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'Home',
  full_name TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT '',
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own addresses" ON public.saved_addresses FOR SELECT USING (lower(wallet_address) = get_request_wallet_address());
CREATE POLICY "Users can create addresses" ON public.saved_addresses FOR INSERT WITH CHECK (lower(wallet_address) = get_request_wallet_address());
CREATE POLICY "Users can update addresses" ON public.saved_addresses FOR UPDATE USING (lower(wallet_address) = get_request_wallet_address());
CREATE POLICY "Users can delete addresses" ON public.saved_addresses FOR DELETE USING (lower(wallet_address) = get_request_wallet_address());

-- ══════════════════════════════════════════════════
-- Storage bucket for store media
-- ══════════════════════════════════════════════════
INSERT INTO storage.buckets (id, name, public) VALUES ('store-media', 'store-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view store media" ON storage.objects FOR SELECT USING (bucket_id = 'store-media');
CREATE POLICY "Authenticated can upload store media" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'store-media');
CREATE POLICY "Authenticated can update store media" ON storage.objects FOR UPDATE USING (bucket_id = 'store-media');
CREATE POLICY "Authenticated can delete store media" ON storage.objects FOR DELETE USING (bucket_id = 'store-media');