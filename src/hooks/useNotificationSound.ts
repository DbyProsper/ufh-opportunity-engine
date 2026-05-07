import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const KEY = "notif-sound-enabled"; // local cache for instant UI

/**
 * Per-user notification sound preference, persisted server-side in
 * `user_settings` so it follows the user across devices.
 */
export const useNotificationSound = () => {
  const { user } = useAuth();
  const [enabled, setEnabledState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(KEY) === "1";
  });

  // Hydrate from server when we have a user
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_settings" as any)
        .select("notif_sound_enabled")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data && typeof (data as any).notif_sound_enabled === "boolean") {
        const v = (data as any).notif_sound_enabled as boolean;
        setEnabledState(v);
        window.localStorage.setItem(KEY, v ? "1" : "0");
      }
    })();
  }, [user]);

  const setEnabled = useCallback(async (next: boolean) => {
    setEnabledState(next);
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, next ? "1" : "0");
    if (user) {
      await supabase
        .from("user_settings" as any)
        .upsert({ user_id: user.id, notif_sound_enabled: next } as any, { onConflict: "user_id" });
    }
  }, [user]);

  const play = useCallback(() => {
    if (!enabled || typeof window === "undefined") return;
    try {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const now = ctx.currentTime;
      const tone = (freq: number, start: number, dur: number, gainPeak = 0.18) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + start);
        gain.gain.setValueAtTime(0, now + start);
        gain.gain.linearRampToValueAtTime(gainPeak, now + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + dur + 0.05);
      };
      // pleasant 2-note chime
      tone(880, 0, 0.18);
      tone(1320, 0.12, 0.22);
      setTimeout(() => ctx.close().catch(() => {}), 700);
    } catch {
      /* ignore */
    }
  }, [enabled]);

  return { enabled, setEnabled, play };
};

export default useNotificationSound;