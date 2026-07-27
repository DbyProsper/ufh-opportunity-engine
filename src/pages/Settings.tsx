import { useState, type FormEvent } from "react";
import { AppHeader } from "@/components/AppHeader";
import { BackButton } from "@/components/BackButton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { THEMES, THEME_META, useTheme, type Theme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, Palette, Sun, Moon, Image as ImageIcon, GraduationCap, Minimize2, Loader2 } from "lucide-react";

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
  const { user } = useAuth();
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handlePasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setPasswordChangeLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordChangeLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Password updated successfully.");
    setNewPassword("");
    setConfirmPassword("");
  };

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

        <div className="space-y-6">
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

          <Card>
            <CardHeader>
              <CardTitle>Account Security</CardTitle>
              <CardDescription>
                Change your sign-in password here. This works only while you are logged in.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="settings-new-password">New password</Label>
                  <PasswordInput id="settings-new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings-confirm-password">Confirm password</Label>
                  <PasswordInput id="settings-confirm-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                </div>
                <Button type="submit" disabled={passwordChangeLoading}>
                  {passwordChangeLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Change password
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Settings;