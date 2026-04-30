import { useCallback, useEffect, useState } from "react";

const KEY = "notif-sound-enabled";

export const useNotificationSound = () => {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(KEY) === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(KEY, enabled ? "1" : "0");
  }, [enabled]);

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