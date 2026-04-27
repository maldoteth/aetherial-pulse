/**
 * Invite Page
 * ===========
 * Logged-in users can generate invite codes and see how many people they've
 * invited. Each generated code is single-use and counts toward the user's
 * "invited" stat once redeemed.
 */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Copy, Plus, Users, Ticket, Check } from "lucide-react";

interface InviteCode {
  code: string;
  created_at: string;
  max_uses: number;
  use_count: number;
  is_active: boolean;
}

interface StatsResponse {
  ok: boolean;
  codes: InviteCode[];
  totalInvites: number;
  activeCodes: number;
  reason?: string;
}

export default function InvitePage() {
  const { walletAddress, isAuthenticated, openLoginModal } = useAuth();
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [totalInvites, setTotalInvites] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const loadStats = async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<StatsResponse>("invite-stats", {
        headers: { "x-wallet-address": walletAddress.toLowerCase() },
      });
      if (error || !data?.ok) {
        toast.error("Couldn't load your invites");
        return;
      }
      setCodes(data.codes ?? []);
      setTotalInvites(data.totalInvites ?? 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && walletAddress) {
      loadStats();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, isAuthenticated]);

  const handleGenerate = async () => {
    if (!walletAddress) {
      openLoginModal();
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ ok: boolean; code?: string; reason?: string; limit?: number }>(
        "invite-generate",
        { headers: { "x-wallet-address": walletAddress.toLowerCase() } },
      );

      if (error || !data?.ok || !data.code) {
        if (data?.reason === "rate_limited") {
          toast.error(`Daily limit reached (${data.limit} per day)`);
        } else {
          toast.error("Couldn't generate code");
        }
        return;
      }

      toast.success("New invite code created");
      // Optimistic prepend
      setCodes((prev) => [
        {
          code: data.code!,
          created_at: new Date().toISOString(),
          max_uses: 1,
          use_count: 0,
          is_active: true,
        },
        ...prev,
      ]);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 1500);
    } catch {
      toast.error("Couldn't copy");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 p-8 text-center">
        <Ticket className="w-12 h-12 text-white/40" />
        <h1 className="text-2xl font-semibold text-white">Invite friends</h1>
        <p className="text-sm text-white/60 max-w-sm">
          Sign in to create invite codes and track who you've brought in.
        </p>
        <Button onClick={openLoginModal} variant="glass" className="rounded-xl mt-2">
          Sign in
        </Button>
      </div>
    );
  }

  const usedCodes = codes.filter((c) => c.use_count >= c.max_uses).length;

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-white">Invite friends</h1>
        <p className="text-sm text-white/60">
          Generate single-use codes and share them. Track who you've invited.
        </p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile
          icon={<Users className="w-4 h-4" />}
          label="Invited"
          value={totalInvites}
        />
        <StatTile
          icon={<Ticket className="w-4 h-4" />}
          label="Active"
          value={codes.filter((c) => c.is_active && c.use_count < c.max_uses).length}
        />
        <StatTile
          icon={<Check className="w-4 h-4" />}
          label="Redeemed"
          value={usedCodes}
        />
      </div>

      {/* Generate */}
      <Button
        onClick={handleGenerate}
        disabled={generating}
        variant="glass"
        className="w-full rounded-xl h-12 font-semibold"
      >
        <Plus className="w-4 h-4 mr-2" />
        {generating ? "Generating…" : "Generate new code"}
      </Button>

      {/* Codes list */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-white/70 px-1">Your codes</h2>
        {loading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : codes.length === 0 ? (
          <div className="rounded-xl bg-black/60 backdrop-blur-[24px] border border-white/10 p-6 text-center text-sm text-white/50">
            You haven't generated any codes yet.
          </div>
        ) : (
          <div className="space-y-2">
            {codes.map((c) => {
              const used = c.use_count >= c.max_uses;
              return (
                <div
                  key={c.code}
                  className="flex items-center justify-between gap-3 rounded-xl bg-black/60 backdrop-blur-[24px] border border-white/10 px-4 py-3"
                >
                  <div className="flex flex-col min-w-0">
                    <span className={`font-mono font-semibold tracking-widest text-base ${used ? "text-white/40 line-through" : "text-white"}`}>
                      {c.code}
                    </span>
                    <span className="text-[11px] text-white/40 mt-0.5">
                      {used ? "Used" : "Unused"} · {new Date(c.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCopy(c.code)}
                    disabled={used}
                    className="rounded-lg text-white/70 hover:text-white shrink-0"
                  >
                    {copiedCode === c.code ? (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl bg-black/60 backdrop-blur-[24px] border border-white/10 p-4 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-white/50 text-xs">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}
