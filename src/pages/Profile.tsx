import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { UFH_FACULTIES, UFH_FACULTY_NAMES } from "@/data/ufh";

type FieldDef = { key: string; label: string; type?: string; textarea?: boolean; kind?: "faculty" | "department" };
const FIELDS: FieldDef[] = [
  { key: "full_name", label: "Full Name" },
  { key: "email", label: "Email", type: "email" },
  { key: "student_number", label: "Student Number" },
  { key: "staff_number", label: "Staff Number (if applicable)" },
  { key: "phone", label: "Phone", type: "tel" },
  { key: "faculty", label: "Faculty", kind: "faculty" },
  { key: "department", label: "Department", kind: "department" },
  { key: "qualification", label: "Qualification / Programme" },
  { key: "year_of_study", label: "Year of Study" },
  { key: "address", label: "Address", textarea: true },
  { key: "bio", label: "Short Bio", textarea: true },
];

const Profile = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (p) {
        const initial: Record<string, string> = {};
        FIELDS.forEach(f => { initial[f.key] = (p as any)[f.key] ?? ""; });
        setData(initial);
      }
      setLoading(false);
    })();
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const payload: Record<string, any> = {};
    FIELDS.forEach(f => { payload[f.key] = data[f.key]?.trim() || null; });
    const { error } = await supabase.from("profiles").update(payload as never).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile saved — applications will auto-fill.");
    navigate("/dashboard");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container mx-auto px-4 py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 md:py-8 flex-1 max-w-3xl w-full">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">My Profile</h1>
        <p className="text-muted-foreground mb-6">
          Update once — every application form will auto-fill from these details.
        </p>
        <Card>
          <CardHeader><CardTitle>Personal & Academic Details</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={save} className="grid sm:grid-cols-2 gap-4">
              {FIELDS.map((f) => (
                <div key={f.key} className={`space-y-2 ${f.textarea ? "sm:col-span-2" : ""}`}>
                  <Label htmlFor={f.key}>{f.label}</Label>
                  {f.kind === "faculty" ? (
                    <Select
                      value={data[f.key] || ""}
                      onValueChange={(v) => setData((p) => ({ ...p, [f.key]: v, department: "" }))}
                    >
                      <SelectTrigger id={f.key}><SelectValue placeholder="Select your faculty" /></SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        {UFH_FACULTY_NAMES.map((name) => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : f.kind === "department" ? (
                    <Select
                      value={data[f.key] || ""}
                      onValueChange={(v) => setData((p) => ({ ...p, [f.key]: v }))}
                      disabled={!data.faculty}
                    >
                      <SelectTrigger id={f.key}>
                        <SelectValue placeholder={data.faculty ? "Select your department" : "Choose faculty first"} />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        {(UFH_FACULTIES[data.faculty] ?? []).map((d) => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : f.textarea ? (
                    <Textarea
                      id={f.key}
                      value={data[f.key] || ""}
                      onChange={(e) => setData((p) => ({ ...p, [f.key]: e.target.value }))}
                      rows={3}
                    />
                  ) : (
                    <Input
                      id={f.key}
                      type={f.type || "text"}
                      value={data[f.key] || ""}
                      onChange={(e) => setData((p) => ({ ...p, [f.key]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
              <div className="sm:col-span-2 flex justify-end pt-2">
                <Button type="submit" disabled={saving} className="btn-gradient-primary text-primary-foreground">
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Profile
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Profile;