/**
 * Password / Invite-Code Gate
 * ===========================
 * Blocks the entire app until a valid invite code is redeemed.
 * Codes are validated server-side via the `invite-redeem` edge function.
 *
 * On first successful redemption: confetti + welcome toast + login/signup CTA.
 */

import { useEffect, useState, type ReactNode } from "react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import PastelBlobsBackground from "./PastelBlobsBackground";

const STORAGE_KEY = "dehub_access_granted";
const SESSION_KEY = "dehub_access_session";
const CODE_KEY = "dehub_access_code";
const WELCOMED_KEY = "dehub_access_welcomed";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 * 10; // 10 years — effectively one-time per device/browser

interface PasswordGateProps {
  children: ReactNode;
}

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked in some browser modes; cookie fallback still applies.
  }
}

function readCookie(key: string): string | null {
  if (typeof document === "undefined") return null;
  const encodedKey = encodeURIComponent(key);
  const parts = document.cookie ? document.cookie.split("; ") : [];
  for (const part of parts) {
    const separator = part.indexOf("=");
    const name = separator >= 0 ? part.slice(0, separator) : part;
    if (name === encodedKey) {
      return decodeURIComponent(separator >= 0 ? part.slice(separator + 1) : "");
    }
  }
  return null;
}

function writeCookie(key: string, value: string) {
  if (typeof document === "undefined") return;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
}

function hasRememberedAccess(): boolean {
  if (readStorage(STORAGE_KEY) === "true" || readCookie(STORAGE_KEY) === "true") {
    writeStorage(STORAGE_KEY, "true");
    writeCookie(STORAGE_KEY, "true");
    return true;
  }
  return false;
}

function rememberAccess(code: string) {
  writeStorage(STORAGE_KEY, "true");
  writeStorage(CODE_KEY, code);
  writeCookie(STORAGE_KEY, "true");
  writeCookie(CODE_KEY, code);
}

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = readStorage(SESSION_KEY) || readCookie(SESSION_KEY);
  if (!id) {
    id = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
  writeStorage(SESSION_KEY, id);
  writeCookie(SESSION_KEY, id);
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
    return hasRememberedAccess();
  });
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (unlocked) return;
    document.title = "Enter invite code";
  }, [unlocked]);

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
        const isFirstTime = readStorage(WELCOMED_KEY) !== "true" && readCookie(WELCOMED_KEY) !== "true";
        rememberAccess(code);

        // Preload the heavy app chunks BEFORE unmounting the gate so the
        // first frame the user sees after unlock is the fully-rendered app
        // (background, layout, etc.) — not a black screen behind confetti.
        try {
          await Promise.race([
            Promise.all([
              import("./WalletProviders"),
              import("./AppLayout"),
              import("../../pages/app/HomePage").catch(() => null),
            ]),
            new Promise((resolve) => setTimeout(resolve, 2500)),
          ]);
        } catch {
          // Non-fatal — proceed even if preload fails.
        }

        // Give the browser one paint tick so the newly-mounted app can render
        // its background before confetti fires.
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        if (isFirstTime) {
          writeStorage(WELCOMED_KEY, "true");
          writeCookie(WELCOMED_KEY, "true");
        }
        setUnlocked(true);

        if (isFirstTime) {
          // Fire confetti AFTER unlock, on the next frame, so the app is on screen.
          requestAnimationFrame(() => {
            fireFireworks();
            toast.success("Welcome to Fansite!");
            try {
              window.dispatchEvent(new CustomEvent("fansite:highlight-login"));
            } catch {}
          });
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

  if (unlocked) {
    return <>{children}</>;
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
    </div>
  );
}

export default PasswordGate;
