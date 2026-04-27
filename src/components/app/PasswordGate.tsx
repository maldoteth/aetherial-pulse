/**
 * Password Gate
 * =============
 * Simple client-side password gate that blocks the entire app until the
 * correct password is entered. Once unlocked, the choice is persisted in
 * localStorage so the user isn't re-prompted on subsequent visits.
 *
 * NOTE: This is presentation-level gating only — the password lives in the
 * client bundle. It's enough to keep casual visitors out, not a security
 * boundary.
 */

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PastelBlobsBackground from "./PastelBlobsBackground";

const ACCESS_PASSWORD = "aetherial2026";
const STORAGE_KEY = "dehub_access_granted";

interface PasswordGateProps {
  children: ReactNode;
}

export function PasswordGate({ children }: PasswordGateProps) {
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "true";
  });
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (unlocked) return;
    document.title = "Enter password";
  }, [unlocked]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() === ACCESS_PASSWORD) {
      localStorage.setItem(STORAGE_KEY, "true");
      setUnlocked(true);
      setError(false);
    } else {
      setError(true);
      setValue("");
    }
  };

  if (unlocked) return <>{children}</>;

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
            Enter the password to continue.
          </p>
        </div>

        <div className="w-full space-y-2">
          <Input
            type="password"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(false);
            }}
            placeholder="code"
            autoFocus
            className="bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-xl h-11"
          />
          {error && (
            <p className="text-xs text-red-400 text-center">
              Incorrect password. Try again.
            </p>
          )}
        </div>

        <Button
          type="submit"
          variant="glass"
          className="w-full rounded-xl font-semibold h-11"
        >
          Unlock
        </Button>
      </form>
    </div>
  );
}

export default PasswordGate;
