import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { UFHLogo } from "@/components/UFHLogo";
import { Loader2, Mail } from "lucide-react";
import { z } from "zod";
import { isUFHEmail } from "@/data/ufh";

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Name is required").max(100),
  email: z
    .string()
    .trim()
    .email("Invalid email")
    .max(255)
    .refine(isUFHEmail, "Use your UFH email (@ufh.ac.za, @mail.ufh.ac.za or @live.ufh.ac.za)"),
  password: z.string().min(8, "Min 8 characters").max(72),
  role: z.enum(["student", "staff"]),
});
const signinSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(255)
    .refine(isUFHEmail, "Use your UFH email"),
  password: z.string().min(1).max(72),
});

const Auth = () => {
  const [params] = useSearchParams();
  const initialTab = params.get("mode") === "signup" ? "signup" : "signin";
  const [tab, setTab] = useState(initialTab);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"student" | "staff">("student");
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate("/dashboard", { replace: true });
  }, [user, navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signupSchema.safeParse({ fullName, email, password, role });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: parsed.data.fullName, role: parsed.data.role },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Account created. Welcome!");
      navigate("/dashboard");
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = signinSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else navigate("/dashboard");
  };

  const handleMicrosoft = () => {
    toast.info("Microsoft sign-in is coming soon. Please use your UFH email and password for now.");
  };

  const handleForgotPassword = () => {
    toast.info("Password reset via email is coming soon. Please contact an administrator to change your password, or use a magic link to access your account.");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-hero-gradient p-4">
      <Link to="/" className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
          <UFHLogo className="w-9 h-9" />
        </div>
        <div className="text-white">
          <h1 className="font-bold text-xl">UFH Opportunity Hub</h1>
          <p className="text-xs opacity-80">University of Fort Hare</p>
        </div>
      </Link>

      <Card className="w-full max-w-md shadow-2xl border-0 animate-scale-in">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl">Welcome</CardTitle>
          <p className="text-sm text-muted-foreground">Sign in or create an account to apply</p>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Create Account</TabsTrigger>
            </TabsList>

            <Button
              type="button"
              variant="outline"
              className="w-full mb-4"
              onClick={handleMicrosoft}
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 23 23" aria-hidden="true">
                <path fill="#F25022" d="M1 1h10v10H1z" />
                <path fill="#7FBA00" d="M12 1h10v10H12z" />
                <path fill="#00A4EF" d="M1 12h10v10H1z" />
                <path fill="#FFB900" d="M12 12h10v10H12z" />
              </svg>
              Continue with Microsoft
              <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                Coming soon
              </span>
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t"></span></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input id="signin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-pwd">Password</Label>
                  <PasswordInput id="signin-pwd" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <div className="flex items-center justify-end">
                  <button type="button" onClick={handleForgotPassword} className="text-sm text-primary hover:underline">
                    Forgot password?
                  </button>
                </div>
                <Button type="submit" className="w-full btn-gradient-primary text-primary-foreground" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                  Sign In
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input id="signup-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>I am a…</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { v: "student", label: "Student", hint: "Enrolled at UFH" },
                      { v: "staff", label: "Staff", hint: "Employed by UFH" },
                    ].map((opt) => (
                      <button
                        type="button"
                        key={opt.v}
                        onClick={() => setRole(opt.v as any)}
                        className={`text-left px-3 py-2.5 rounded-md border text-sm transition ${
                          role === opt.v
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:bg-muted/40"
                        }`}
                      >
                        <p className="font-medium">{opt.label}</p>
                        <p className="text-[11px] text-muted-foreground">{opt.hint}</p>
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Admin access is granted by an existing administrator.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">UFH Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@ufh.ac.za"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">Only @ufh.ac.za, @mail.ufh.ac.za and @live.ufh.ac.za are accepted.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-pwd">Password</Label>
                  <PasswordInput id="signup-pwd" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                  <p className="text-xs text-muted-foreground">At least 8 characters</p>
                </div>
                <Button type="submit" className="w-full btn-gradient-primary text-primary-foreground" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Create Account
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Link to="/" className="mt-6 text-sm text-white/80 hover:text-white">
        ← Back to home
      </Link>
    </div>
  );
};

export default Auth;