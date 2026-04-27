/**
 * Password / Invite-Code Gate
 * ===========================
 * Blocks the entire app until a valid invite code is redeemed.
 * Codes are validated server-side via the `invite-redeem` edge function.
 *
 * On first successful redemption: confetti + welcome toast + login/signup CTA.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PastelBlobsBackground from "./PastelBlobsBackground";

const STORAGE_KEY = "dehub_access_granted";
const SESSION_KEY = "dehub_access_session";
const CODE_KEY = "dehub_access_code";
const WELCOMED_KEY = "dehub_access_welcomed";

interface PasswordGateProps {
  children: ReactNode;
}

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

const REASONS: Record<string, string> = {
  invalid_format: "That doesn't look like a valid code.",
  not_found: "Invalid code. Try again.",
  inactive: "This code has been disabled.",
  exhausted: "This code has already been used.",
  rate_limited: "Too many attempts — try again later.",
  server_error: "Something went wrong. Try again.",
};

function fireFireworks() {
  const duration = 2500;
  const end = Date.now() + duration;
  const colors = ["#ffffff", "#ffd700", "#ff6b9d", "#a855f7", "#22d3ee"];

  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 70,
      origin: { x: 0, y: 0.7 },
      colors,
      startVelocity: 55,
      scalar: 0.9,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 70,
      origin: { x: 1, y: 0.7 },
      colors,
      startVelocity: 55,
      scalar: 0.9,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();

  // Center burst
  setTimeout(() => {
    confetti({
      particleCount: 120,
      spread: 100,
      origin: { y: 0.5 },
      colors,
      scalar: 1.1,
    });
  }, 200);
}

export function PasswordGate({ children }: PasswordGateProps) {
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "true";
  });
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const welcomedRef = useRef(false);

  const { isAuthenticated, openLoginModal } = useAuth();

  useEffect(() => {
    if (unlocked) return;
    document.title = "Enter invite code";
  }, [unlocked]);

  // If already welcomed and unlocked from a previous session, never show overlay again.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(WELCOMED_KEY) === "true") {
      welcomedRef.current = true;
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const code = value.trim().toUpperCase();
    if (!code) return;

    setLoading(true);
    setError(null);

    try {
      const sessionId = getOrCreateSessionId();
      const { data, error: invokeErr } = await supabase.functions.invoke("invite-redeem", {
        body: { code, sessionId },
      });

      if (invokeErr) {
        setError(REASONS.server_error);
        return;
      }

      if (data?.ok) {
        const isFirstTime = localStorage.getItem(WELCOMED_KEY) !== "true";
        localStorage.setItem(STORAGE_KEY, "true");
        localStorage.setItem(CODE_KEY, code);

        if (isFirstTime) {
          localStorage.setItem(WELCOMED_KEY, "true");
          // Fire confetti before unmounting the gate so it appears over the form
          fireFireworks();
          toast.success("Welcome to Fansite!", {
            description: "You're in. Let's get you set up.",
            duration: 4500,
          });
          // Show the welcome overlay with login CTA, then unlock when dismissed
          setShowWelcome(true);
          // Keep gate visible briefly so the overlay can render on top
          setTimeout(() => setUnlocked(true), 50);
        } else {
          setUnlocked(true);
        }
        return;
      }

      const reason = (data?.reason as string) || "not_found";
      setError(REASONS[reason] || REASONS.not_found);
      setValue("");
    } catch (err) {
      console.error("[PasswordGate] redeem failed", err);
      setError(REASONS.server_error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = () => {
    setShowWelcome(false);
    openLoginModal();
  };

  const handleSkip = () => {
    setShowWelcome(false);
  };

  // Welcome overlay — shown after first successful unlock, on top of the app
  const welcomeOverlay = showWelcome && !isAuthenticated ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-6 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-sm rounded-2xl bg-black/60 backdrop-blur-[24px] border border-white/10 p-8 flex flex-col items-center gap-6 shadow-2xl animate-scale-in welcome-glow">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-semibold text-white">Welcome to Fansite</h2>
          <p className="text-sm text-white/60">
            Sign in or create an account to start posting, following creators, and unlocking everything.
          </p>
        </div>
        <div className="w-full flex flex-col gap-3">
          <Button
            type="button"
            onClick={handleSignIn}
            className="w-full rounded-xl font-semibold h-11 bg-white text-black hover:bg-white/90 welcome-glow-btn"
          >
            Log in / Sign up
          </Button>
          <button
            type="button"
            onClick={handleSkip}
            className="w-full text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
      <style>{`
        .welcome-glow {
          box-shadow:
            0 0 60px -10px rgba(255, 255, 255, 0.25),
            0 0 120px -20px rgba(168, 85, 247, 0.2);
        }
        .welcome-glow-btn {
          position: relative;
          box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.6);
          animation: welcome-glow-pulse 2.4s ease-in-out infinite;
        }
        @keyframes welcome-glow-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.45), 0 0 24px -4px rgba(255, 255, 255, 0.4); }
          50%      { box-shadow: 0 0 0 6px rgba(255, 255, 255, 0), 0 0 36px -2px rgba(255, 255, 255, 0.7); }
        }
      `}</style>
    </div>
  ) : null;

  if (unlocked) {
    return (
      <>
        {children}
        {welcomeOverlay}
      </>
    );
  }

  return (
    <div className="relative min-h-screen w-full bg-black flex items-center justify-center px-6">
      <PastelBlobsBackground />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-sm rounded-2xl bg-black/60 backdrop-blur-[24px] border border-white/10 p-8 flex flex-col items-center gap-6 shadow-2xl"
      >
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-white">Private Access</h1>
          <p className="text-sm text-white/60">
            Enter your invite code to continue.
          </p>
        </div>

        <div className="w-full space-y-2">
          <Input
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value.toUpperCase());
              if (error) setError(null);
            }}
            placeholder="code"
            autoFocus
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            className="bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-xl h-11 text-center tracking-widest font-mono"
          />
          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}
        </div>

        <Button
          type="submit"
          variant="glass"
          disabled={loading || !value.trim()}
          className="w-full rounded-xl font-semibold h-11"
        >
          {loading ? "Checking…" : "Unlock"}
        </Button>
      </form>
      {welcomeOverlay}
    </div>
  );
}

export default PasswordGate;
