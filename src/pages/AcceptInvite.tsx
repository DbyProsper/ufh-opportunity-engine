import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { UFHLogo } from "@/components/UFHLogo";

const AcceptInvite = () => {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const { user, loading: authLoading, refreshRoles } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<"idle" | "working" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!token) { setState("error"); setMessage("Missing invite token."); return; }
    if (!user) {
      navigate(`/auth?next=${encodeURIComponent(`/accept-invite?token=${token}`)}`);
      return;
    }
    (async () => {
      setState("working");
      const { data, error } = await supabase.rpc("accept_admin_invite", { _token: token });
      if (error) {
        setState("error");
        setMessage(error.message);
        toast.error(error.message);
      } else {
        setState("ok");
        setMessage(`Role granted: ${(data as any)?.role ?? "admin"}`);
        await refreshRoles();
        toast.success("Admin access granted");
      }
    })();
  }, [authLoading, user, token, navigate, refreshRoles]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-hero-gradient p-4">
      <Link to="/" className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
          <UFHLogo className="w-9 h-9" />
        </div>
        <div className="text-white">
          <h1 className="font-bold text-xl">UFH Opportunity Hub</h1>
          <p className="text-xs opacity-80">Admin invitation</p>
        </div>
      </Link>
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader><CardTitle>Activating your invite</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-center py-6">
          {state === "working" && (<><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /><p className="text-sm text-muted-foreground">Verifying token…</p></>)}
          {state === "ok" && (<><ShieldCheck className="w-10 h-10 mx-auto text-success" /><p className="text-sm">{message}</p>
            <Button onClick={() => navigate("/admin")} className="w-full">Go to Admin</Button></>)}
          {state === "error" && (<><ShieldAlert className="w-10 h-10 mx-auto text-destructive" /><p className="text-sm text-destructive">{message}</p>
            <Button variant="outline" onClick={() => navigate("/dashboard")} className="w-full">Back to dashboard</Button></>)}
        </CardContent>
      </Card>
    </div>
  );
};
export default AcceptInvite;