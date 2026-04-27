-- Invite code system
CREATE TABLE public.invite_codes (
  code text PRIMARY KEY,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  max_uses integer NOT NULL DEFAULT 1,
  use_count integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

CREATE INDEX idx_invite_codes_created_by ON public.invite_codes (lower(created_by));

CREATE TABLE public.invite_code_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL REFERENCES public.invite_codes(code) ON DELETE CASCADE,
  used_by_wallet text,
  used_by_session text NOT NULL,
  used_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_invite_code_uses_code ON public.invite_code_uses (code);
CREATE INDEX idx_invite_code_uses_wallet ON public.invite_code_uses (lower(used_by_wallet));

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_code_uses ENABLE ROW LEVEL SECURITY;

-- RLS: anyone can SELECT codes they created (by wallet header)
CREATE POLICY "Users can view their own invite codes"
  ON public.invite_codes
  FOR SELECT
  USING (lower(created_by) = public.get_request_wallet_address());

-- Owners of a code can see who used it
CREATE POLICY "Code owners can view their code uses"
  ON public.invite_code_uses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invite_codes c
      WHERE c.code = invite_code_uses.code
        AND lower(c.created_by) = public.get_request_wallet_address()
    )
  );

-- No public INSERT/UPDATE/DELETE — all writes go through edge functions (service role)

-- Seed 100 system invite codes (owned by NULL = system, max_uses = 1)
INSERT INTO public.invite_codes (code, created_by, max_uses) VALUES
('CM4C-ASX5', NULL, 1),
('SP48-665C', NULL, 1),
('Y83A-VPW7', NULL, 1),
('5VDT-M6RZ', NULL, 1),
('H48V-4PCB', NULL, 1),
('USYR-CUU6', NULL, 1),
('TRAZ-UEGH', NULL, 1),
('YNX6-EB8P', NULL, 1),
('W5MU-LYWV', NULL, 1),
('E8YA-RKQK', NULL, 1),
('NGPX-TPGL', NULL, 1),
('EASU-MD8G', NULL, 1),
('K4LF-AVZT', NULL, 1),
('CLVZ-BYW7', NULL, 1),
('U8UY-9XKP', NULL, 1),
('E4YE-E36D', NULL, 1),
('ZX9L-7AE8', NULL, 1),
('B7Y7-F55U', NULL, 1),
('J5VW-XB4P', NULL, 1),
('7VBC-BRWT', NULL, 1),
('EBR9-4845', NULL, 1),
('4FEU-HYSD', NULL, 1),
('ALBH-T3CT', NULL, 1),
('7ML5-ZPPA', NULL, 1),
('BHF6-6FLD', NULL, 1),
('UU5Y-R7QB', NULL, 1),
('ZANE-2YJL', NULL, 1),
('7AQA-BFW6', NULL, 1),
('SK8F-G6KL', NULL, 1),
('YTF6-4BHV', NULL, 1),
('8S7S-X38R', NULL, 1),
('DRB4-9VEH', NULL, 1),
('ZJPU-CEN8', NULL, 1),
('XSU5-P2J6', NULL, 1),
('L7VL-4CB6', NULL, 1),
('TLTW-PKRA', NULL, 1),
('PRYQ-4HE6', NULL, 1),
('HK49-7BZ8', NULL, 1),
('3VGS-FAHE', NULL, 1),
('636S-UKUU', NULL, 1),
('EHJ6-AFBD', NULL, 1),
('6FHS-MY7D', NULL, 1),
('NKG2-5WP4', NULL, 1),
('2CVB-MY6M', NULL, 1),
('E7UR-Y8VZ', NULL, 1),
('VWZ9-5A73', NULL, 1),
('LGVT-MFC5', NULL, 1),
('J6W3-LHPS', NULL, 1),
('324J-U4XQ', NULL, 1),
('FC6N-DHGG', NULL, 1),
('LPXX-ASPJ', NULL, 1),
('WT46-EE4Z', NULL, 1),
('BZGX-FUNR', NULL, 1),
('UW5Z-G9WS', NULL, 1),
('A8HE-JCJ4', NULL, 1),
('2T66-LR5A', NULL, 1),
('K2JE-TCYS', NULL, 1),
('4VY6-UFES', NULL, 1),
('KV5D-XLYT', NULL, 1),
('J9GQ-RTF9', NULL, 1),
('6PTL-ZR65', NULL, 1),
('WYP3-MCY9', NULL, 1),
('CW95-WAQE', NULL, 1),
('HUQ2-XLES', NULL, 1),
('B7JT-FT5A', NULL, 1),
('UCLB-U47G', NULL, 1),
('F4RG-LVQW', NULL, 1),
('4Y2R-2HG3', NULL, 1),
('7P9P-57AV', NULL, 1),
('HMBH-3T2M', NULL, 1),
('JUHF-Q6PZ', NULL, 1),
('4NTP-SK3Y', NULL, 1),
('KM5Z-R85X', NULL, 1),
('5Z96-ZDUR', NULL, 1),
('6AGM-JXA2', NULL, 1),
('DTWK-73Y7', NULL, 1),
('LP4L-ZML8', NULL, 1),
('93U3-G4PL', NULL, 1),
('9HYS-6RXZ', NULL, 1),
('4ZJN-BFXA', NULL, 1),
('DB3J-K3EQ', NULL, 1),
('6LGK-MAUX', NULL, 1),
('BKR3-6Z6B', NULL, 1),
('CA7K-T2E3', NULL, 1),
('6LWB-BUQ9', NULL, 1),
('UFTZ-WFS6', NULL, 1),
('9NFS-HGY5', NULL, 1),
('XDSK-QNMY', NULL, 1),
('D9BB-DJGB', NULL, 1),
('T4E6-AJPD', NULL, 1),
('PFDH-TVX6', NULL, 1),
('H4Y2-N8G2', NULL, 1),
('HKQY-D7H9', NULL, 1),
('955C-5CV3', NULL, 1),
('72DL-9UGA', NULL, 1),
('P44B-CBM3', NULL, 1),
('FCVH-PFCE', NULL, 1),
('6PCZ-FWTV', NULL, 1),
('R8QZ-CAL4', NULL, 1),
('CVFX-Z2WM', NULL, 1);