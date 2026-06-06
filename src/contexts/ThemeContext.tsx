import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const THEMES = ["light", "dark", "image", "ufh", "minimal"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_META: Record<Theme, { label: string; description: string }> = {
  light:   { label: "Light",   description: "Default academic theme — bright and clean." },
  dark:    { label: "Dark",    description: "Low-light mode with a refined dark palette." },
  image:   { label: "Image",   description: "Academic background image with readable overlay." },
  ufh:     { label: "UFH",     description: "Signature UFH navy and gold." },
  minimal: { label: "Minimal", description: "Distraction-free, neutral, content-first." },
};

const STORAGE_KEY = "ufh-theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  isLoaded: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const isTheme = (v: any): v is Theme => (THEMES as readonly string[]).includes(v);

const applyToDom = (theme: Theme) => {
  const root = document.documentElement;
  THEMES.forEach((t) => root.classList.remove(`theme-${t}`));
  root.classList.toggle("dark", theme === "dark");
  root.classList.add(`theme-${theme}`);
  root.dataset.theme = theme;
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";
    const stored = localStorage.getItem(STORAGE_KEY);
    return isTheme(stored) ? stored : "light";
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // Apply to <html> on every change
  useEffect(() => { applyToDom(theme); }, [theme]);

  // When user logs in, pull their saved theme
  useEffect(() => {
    if (!user) { setIsLoaded(true); return; }
    (async () => {
      const { data } = await supabase
        .from("user_settings")
        .select("theme")
        .eq("user_id", user.id)
        .maybeSingle();
      const remote = (data as any)?.theme;
      if (isTheme(remote)) {
        setThemeState(remote);
        localStorage.setItem(STORAGE_KEY, remote);
      }
      setIsLoaded(true);
    })();
  }, [user]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try { localStorage.setItem(STORAGE_KEY, t); } catch { /* noop */ }
    if (user) {
      // Upsert preference (fire and forget)
      supabase
        .from("user_settings")
        .upsert({ user_id: user.id, theme: t } as any, { onConflict: "user_id" })
        .then(() => { /* noop */ });
    }
  }, [user]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isLoaded }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};