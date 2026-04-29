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
import { Loader2, Save, Upload, FileText, Sparkles, Trash2, Eye, RefreshCcw } from "lucide-react";
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
  const [cvPath, setCvPath] = useState<string | null>(null);
  const [cvUploadedAt, setCvUploadedAt] = useState<string | null>(null);
  const [cvUploading, setCvUploading] = useState(false);
  const [cvParsing, setCvParsing] = useState(false);
  const [profileDocs, setProfileDocs] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);

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
        setCvPath((p as any).cv_path ?? null);
        setCvUploadedAt((p as any).cv_uploaded_at ?? null);
      }
      const { data: pd } = await supabase.from("profile_documents").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setProfileDocs(pd ?? []);
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

  const reloadProfile = async () => {
    if (!user) return;
    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (!p) return;
    const initial: Record<string, string> = {};
    FIELDS.forEach((f) => { initial[f.key] = (p as any)[f.key] ?? ""; });
    setData(initial);
    setCvPath((p as any).cv_path ?? null);
    setCvUploadedAt((p as any).cv_uploaded_at ?? null);
  };

  const handleCvUpload = async (file: File) => {
    if (!user) return;
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Upload a PDF or image of your CV.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("CV must be under 10 MB.");
      return;
    }
    setCvUploading(true);
    const ext = (file.name.split(".").pop() || "pdf").toLowerCase();
    const path = `${user.id}/cv-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("user-cvs").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { setCvUploading(false); toast.error(upErr.message); return; }
    setCvUploading(false);
    setCvParsing(true);
    toast.info("CV uploaded — parsing with AI…");
    try {
      const { data: res, error } = await supabase.functions.invoke("parse-cv", { body: { cvPath: path } });
      if (error) throw error;
      const applied = (res as any)?.applied ?? {};
      const filled = Object.keys(applied).filter((k) => !["cv_path", "cv_uploaded_at", "cv_text"].includes(k));
      toast.success(filled.length ? `Auto-filled ${filled.length} field(s) from your CV.` : "CV saved. No new fields needed filling.");
      await reloadProfile();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not parse CV");
    } finally {
      setCvParsing(false);
    }
  };

  const viewCv = async () => {
    if (!cvPath) return;
    const { data, error } = await supabase.storage.from("user-cvs").createSignedUrl(cvPath, 60 * 5);
    if (error || !data) return toast.error("Could not open CV");
    window.open(data.signedUrl, "_blank");
  };

  const removeCv = async () => {
    if (!user || !cvPath) return;
    await supabase.storage.from("user-cvs").remove([cvPath]);
    await supabase.from("profiles").update({ cv_path: null, cv_uploaded_at: null, cv_text: null } as never).eq("id", user.id);
    setCvPath(null); setCvUploadedAt(null);
    toast.success("CV removed.");
  };

  const viewProfileDoc = async (path: string) => {
    const { data, error } = await supabase.storage.from("application-documents").createSignedUrl(path, 60 * 5);
    if (error || !data) return toast.error("Could not open document");
    window.open(data.signedUrl, "_blank");
  };

  const removeProfileDoc = async (id: string) => {
    const { error } = await supabase.from("profile_documents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setProfileDocs((p) => p.filter((d) => d.id !== id));
    toast.success("Removed from profile library.");
  };

  const syncFromApplications = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      // Pull every doc the user has uploaded across applications, with the workflow doc label
      const { data: appRows } = await supabase
        .from("applications").select("id").eq("user_id", user.id);
      const appIds = (appRows ?? []).map((a) => a.id);
      if (appIds.length === 0) { toast.info("No applications yet to sync from."); setSyncing(false); return; }
      const { data: appDocs } = await supabase
        .from("application_documents").select("*").in("application_id", appIds);
      const docIds = Array.from(new Set((appDocs ?? []).map((d: any) => d.document_id).filter(Boolean)));
      let labels: Record<string, string> = {};
      if (docIds.length > 0) {
        const { data: meta } = await supabase
          .from("workflow_documents").select("id,name").in("id", docIds as string[]);
        labels = Object.fromEntries((meta ?? []).map((m: any) => [m.id, m.name]));
      }
      // Build dedupe map: latest per label
      const byLabel = new Map<string, any>();
      (appDocs ?? []).forEach((d: any) => {
        const label = (d.document_id && labels[d.document_id]) || d.file_name || "Document";
        const existing = byLabel.get(label);
        if (!existing || new Date(d.uploaded_at) > new Date(existing.uploaded_at)) {
          byLabel.set(label, d);
        }
      });
      const rows = Array.from(byLabel.entries()).map(([label, d]) => ({
        user_id: user.id,
        label,
        file_name: d.file_name,
        file_path: d.file_path,
        source_application_id: d.application_id,
      }));
      if (rows.length === 0) { toast.info("No documents found to sync."); setSyncing(false); return; }
      const { error } = await supabase
        .from("profile_documents")
        .upsert(rows as never, { onConflict: "user_id,label" });
      if (error) throw error;
      const { data: pd } = await supabase.from("profile_documents").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setProfileDocs(pd ?? []);
      toast.success(`Synced ${rows.length} document(s) to your library.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Sync failed");
    } finally {
      setSyncing(false);
    }
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

        {/* CV upload + AI auto-fill */}
        <Card className="mb-6 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="w-4 h-4 text-accent" /> Auto-fill from your CV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Upload your CV (PDF or image). AI will read it and fill in any blank fields below — your existing answers are kept.
            </p>
            {cvPath ? (
              <div className="flex items-center justify-between gap-3 p-3 border rounded-lg bg-muted/30 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">CV on file</p>
                    <p className="text-xs text-muted-foreground">
                      Uploaded {cvUploadedAt ? new Date(cvUploadedAt).toLocaleString() : ""}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={viewCv}><Eye className="w-3.5 h-3.5 mr-1" /> View</Button>
                  <label className={`cursor-pointer ${cvUploading || cvParsing ? "opacity-50 pointer-events-none" : ""}`}>
                    <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleCvUpload(e.target.files[0])} />
                    <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border bg-background hover:bg-muted">
                      <Upload className="w-3 h-3" /> Replace
                    </span>
                  </label>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={removeCv}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>
            ) : (
              <label className={`flex items-center justify-center gap-2 w-full py-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/40 ${cvUploading || cvParsing ? "opacity-60 pointer-events-none" : ""}`}>
                <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleCvUpload(e.target.files[0])} />
                {cvUploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                  : cvParsing ? <><Sparkles className="w-4 h-4 animate-pulse text-accent" /> Reading CV with AI…</>
                  : <><Upload className="w-4 h-4" /> <span className="text-sm">Click to upload your CV (PDF or image)</span></>}
              </label>
            )}
            {cvParsing && (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> AI is filling blank fields — this can take 10–20 seconds.
              </p>
            )}
          </CardContent>
        </Card>

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

        {/* Profile document library — auto-built from past applications */}
        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Saved documents</CardTitle>
            <Button size="sm" variant="outline" onClick={syncFromApplications} disabled={syncing}>
              {syncing ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5 mr-1" />}
              Sync from applications
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Documents you've uploaded to past applications are saved here so future applications can re-use them.
            </p>
            {profileDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No saved documents yet — they'll appear after your first application.</p>
            ) : (
              <ul className="space-y-2">
                {profileDocs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between p-2.5 border rounded-lg gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{d.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{d.file_name}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => viewProfileDoc(d.file_path)}><Eye className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => removeProfileDoc(d.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Profile;