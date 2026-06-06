import { AppHeader } from "@/components/AppHeader";
import { BackButton } from "@/components/BackButton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { THEMES, THEME_META, useTheme, type Theme } from "@/contexts/ThemeContext";
import { Check, Palette, Sun, Moon, Image as ImageIcon, GraduationCap, Minimize2 } from "lucide-react";

const ICONS: Record<Theme, any> = {
  light: Sun, dark: Moon, image: ImageIcon, ufh: GraduationCap, minimal: Minimize2,
};

// Tiny preview swatches for each theme — pure CSS, no images loaded.
const PREVIEWS: Record<Theme, string> = {
  light:   "bg-[hsl(210,25%,98%)] border-[hsl(210,20%,88%)]",
  dark:    "bg-[hsl(220,30%,8%)] border-[hsl(220,20%,22%)]",
  image:   "bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900",
  ufh:     "bg-gradient-to-br from-[hsl(215,100%,21%)] to-[hsl(44,67%,47%)]",
  minimal: "bg-white border-zinc-200",
};

const Settings = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 md:py-8 max-w-4xl">
        <BackButton />
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Palette className="w-6 h-6 text-accent" /> Settings
          </h1>
          <p className="text-muted-foreground mt-1">Customize how the Hub looks and feels.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Theme</CardTitle>
            <CardDescription>
              Choose how the interface looks. Your preference is saved to your account
              and applied on every device you sign in to.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {THEMES.map((t) => {
                const Icon = ICONS[t];
                const active = t === theme;
                return (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`text-left rounded-xl border-2 p-4 transition-all hover:shadow-md ${
                      active ? "border-accent shadow-glow" : "border-border"
                    }`}
                  >
                    <div className={`h-20 rounded-lg border mb-3 ${PREVIEWS[t]}`} />
                    <div className="flex items-center justify-between mb-1">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <Icon className="w-4 h-4" /> {THEME_META[t].label}
                      </span>
                      {active && <Check className="w-4 h-4 text-success" />}
                    </div>
                    <p className="text-xs text-muted-foreground">{THEME_META[t].description}</p>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings;