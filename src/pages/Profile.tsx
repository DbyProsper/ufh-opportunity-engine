import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { BackButton } from "@/components/BackButton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Upload, FileText, Sparkles, Trash2, Eye, RefreshCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { UFH_FACULTIES, UFH_FACULTY_NAMES } from "@/data/ufh";
import { useSectionAutoSave, type SaveStatus } from "@/hooks/useSectionAutoSave";
import { SectionCard, type SectionStatus } from "@/components/profile/SectionCard";
import { Field } from "@/components/profile/Field";

// ---------- Types ----------
type Personal = {
  title: string; full_name: string; email: string; phone: string;
  date_of_birth: string; gender: string; id_number: string; nationality: string;
  race: string; disability: string; home_language: string;
  student_number: string; staff_number: string;
  faculty: string; department: string; qualification: string; year_of_study: string;
  bio: string;
};
type Address = {
  id?: string; kind: string; is_primary: boolean;
  line1: string; line2: string; city: string; province: string; postal_code: string; country: string;
};
type NextOfKin = { id?: string; full_name: string; relationship: string; phone: string; email: string; address: string };
type Financial = { sars_tax_number: string; income_tax_ref: string; vat_number: string; dependants: string; marital_status: string };
type Banking = { id?: string; bank_name: string; branch_code: string; account_number: string; account_type: string; account_holder: string };
type Employment = { id?: string; employer: string; position: string; start_date: string; end_date: string; is_current: boolean; supervisor_name: string; supervisor_contact: string };

const blankAddress = (kind: string): Address => ({
  kind, is_primary: false, line1: "", line2: "", city: "", province: "", postal_code: "", country: "South Africa",
});
const blankNok = (): NextOfKin => ({ full_name: "", relationship: "", phone: "", email: "", address: "" });
const blankBanking = (): Banking => ({ bank_name: "", branch_code: "", account_number: "", account_type: "", account_holder: "" });
const blankEmployment = (): Employment => ({ employer: "", position: "", start_date: "", end_date: "", is_current: false, supervisor_name: "", supervisor_contact: "" });

const isFilled = (v: any) => v !== undefined && v !== null && String(v).trim() !== "";
const sectionStatus = (required: any[]): SectionStatus =>
  required.every(isFilled) ? "complete" : required.some(isFilled) ? "editing" : "incomplete";

// ---------- Page ----------
const ProfilePage = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // Section state
  const [personal, setPersonal] = useState<Personal>({
    title: "", full_name: "", email: "", phone: "",
    date_of_birth: "", gender: "", id_number: "", nationality: "",
    race: "", disability: "", home_language: "",
    student_number: "", staff_number: "",
    faculty: "", department: "", qualification: "", year_of_study: "",
    bio: "",
  });
  const [address1, setAddress1] = useState<Address>(blankAddress("home"));
  const [address2, setAddress2] = useState<Address>(blankAddress("postal"));
  const [nok, setNok] = useState<NextOfKin>(blankNok());
  const [financial, setFinancial] = useState<Financial>({ sars_tax_number: "", income_tax_ref: "", vat_number: "", dependants: "", marital_status: "" });
  const [banking, setBanking] = useState<Banking>(blankBanking());
  const [employment, setEmployment] = useState<Employment>(blankEmployment());

  // CV / docs (kept from previous version)
  const [cvPath, setCvPath] = useState<string | null>(null);
  const [cvUploadedAt, setCvUploadedAt] = useState<string | null>(null);
  const [cvUploading, setCvUploading] = useState(false);
  const [cvParsing, setCvParsing] = useState(false);
  const [profileDocs, setProfileDocs] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [profileExtra, setProfileExtra] = useState<Record<string, { label: string; value: string; updated_at?: string }>>({});

  useEffect(() => { if (!authLoading && !user) navigate("/auth"); }, [authLoading, user, navigate]);

  // ---------- Initial load ----------
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: p }, { data: addrs }, { data: noks }, { data: fin }, { data: banks }, { data: emps }, { data: pd }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        (supabase.from as any)("addresses").select("*").eq("user_id", user.id).order("created_at"),
        (supabase.from as any)("next_of_kin").select("*").eq("user_id", user.id).order("created_at"),
        (supabase.from as any)("financial_profile").select("*").eq("user_id", user.id).maybeSingle(),
        (supabase.from as any)("banking_details").select("*").eq("user_id", user.id).order("created_at"),
        (supabase.from as any)("employment_details").select("*").eq("user_id", user.id).order("is_current", { ascending: false }),
        supabase.from("profile_documents").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);
      if (p) {
        setPersonal({
          title: (p as any).title ?? "", full_name: p.full_name ?? "", email: p.email ?? "", phone: p.phone ?? "",
          date_of_birth: (p as any).date_of_birth ?? "", gender: (p as any).gender ?? "",
          id_number: (p as any).id_number ?? "", nationality: (p as any).nationality ?? "",
          race: (p as any).race ?? "", disability: (p as any).disability ?? "", home_language: (p as any).home_language ?? "",
          student_number: p.student_number ?? "", staff_number: p.staff_number ?? "",
          faculty: p.faculty ?? "", department: p.department ?? "",
          qualification: p.qualification ?? "", year_of_study: p.year_of_study ?? "",
          bio: p.bio ?? "",
        });
        setCvPath((p as any).cv_path ?? null);
        setCvUploadedAt((p as any).cv_uploaded_at ?? null);
        setProfileExtra(((p as any).profile_extra ?? {}) as Record<string, any>);
      }
      const aArr = (addrs as any[]) ?? [];
      const home = aArr.find((a) => a.kind === "home") ?? aArr[0];
      const postal = aArr.find((a) => a.kind === "postal") ?? aArr[1];
      if (home) setAddress1({ ...blankAddress("home"), ...home });
      if (postal) setAddress2({ ...blankAddress("postal"), ...postal });

      const nArr = (noks as any[]) ?? [];
      if (nArr[0]) setNok({ ...blankNok(), ...nArr[0] });

      if (fin) setFinancial({
        sars_tax_number: (fin as any).sars_tax_number ?? "",
        income_tax_ref: (fin as any).income_tax_ref ?? "",
        vat_number: (fin as any).vat_number ?? "",
        dependants: (fin as any).dependants?.toString() ?? "",
        marital_status: (fin as any).marital_status ?? "",
      });

      const bArr = (banks as any[]) ?? [];
      if (bArr[0]) setBanking({ ...blankBanking(), ...bArr[0] });

      const eArr = (emps as any[]) ?? [];
      if (eArr[0]) setEmployment({
        ...blankEmployment(), ...eArr[0],
        start_date: eArr[0].start_date ?? "",
        end_date: eArr[0].end_date ?? "",
      });

      setProfileDocs(pd ?? []);
      setLoading(false);
    })();
  }, [user]);

  // ---------- Savers ----------
  const savePersonal = async (v: Personal) => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({
      ...v,
      date_of_birth: v.date_of_birth || null,
    } as never).eq("id", user.id);
    if (error) throw error;
  };

  const saveAddress = async (slot: 1 | 2, v: Address) => {
    if (!user) return;
    const row = { ...v, user_id: user.id, kind: slot === 1 ? "home" : "postal", is_primary: slot === 1 };
    if (v.id) {
      const { error } = await (supabase.from as any)("addresses").update(row).eq("id", v.id);
      if (error) throw error;
    } else if (Object.values(v).some((x) => typeof x === "string" && x.trim())) {
      const { data, error } = await (supabase.from as any)("addresses").insert(row).select().single();
      if (error) throw error;
      slot === 1 ? setAddress1((p) => ({ ...p, id: data.id })) : setAddress2((p) => ({ ...p, id: data.id }));
    }
  };

  const saveNok = async (v: NextOfKin) => {
    if (!user) return;
    const row = { ...v, user_id: user.id, is_primary: true };
    if (v.id) {
      const { error } = await (supabase.from as any)("next_of_kin").update(row).eq("id", v.id);
      if (error) throw error;
    } else if (v.full_name?.trim() || v.phone?.trim()) {
      const { data, error } = await (supabase.from as any)("next_of_kin").insert(row).select().single();
      if (error) throw error;
      setNok((p) => ({ ...p, id: data.id }));
    }
  };

  const saveFinancial = async (v: Financial) => {
    if (!user) return;
    const row = {
      user_id: user.id,
      sars_tax_number: v.sars_tax_number || null,
      income_tax_ref: v.income_tax_ref || null,
      vat_number: v.vat_number || null,
      dependants: v.dependants ? Number(v.dependants) : null,
      marital_status: v.marital_status || null,
    };
    const { error } = await (supabase.from as any)("financial_profile").upsert(row, { onConflict: "user_id" });
    if (error) throw error;
  };

  const saveBanking = async (v: Banking) => {
    if (!user) return;
    const row = { ...v, user_id: user.id, is_primary: true };
    if (v.id) {
      const { error } = await (supabase.from as any)("banking_details").update(row).eq("id", v.id);
      if (error) throw error;
    } else if (v.account_number?.trim() || v.bank_name?.trim()) {
      const { data, error } = await (supabase.from as any)("banking_details").insert(row).select().single();
      if (error) throw error;
      setBanking((p) => ({ ...p, id: data.id }));
    }
  };

  const saveEmployment = async (v: Employment) => {
    if (!user) return;
    const row = {
      ...v, user_id: user.id,
      start_date: v.start_date || null,
      end_date: v.end_date || null,
    };
    if (v.id) {
      const { error } = await (supabase.from as any)("employment_details").update(row).eq("id", v.id);
      if (error) throw error;
    } else if (v.employer?.trim() || v.position?.trim()) {
      const { data, error } = await (supabase.from as any)("employment_details").insert(row).select().single();
      if (error) throw error;
      setEmployment((p) => ({ ...p, id: data.id }));
    }
  };

  // ---------- Wire autosaves ----------
  const personalStatus = useSectionAutoSave(personal, savePersonal);
  const address1Status = useSectionAutoSave(address1, (v) => saveAddress(1, v));
  const address2Status = useSectionAutoSave(address2, (v) => saveAddress(2, v));
  const nokStatus = useSectionAutoSave(nok, saveNok);
  const finStatus = useSectionAutoSave(financial, saveFinancial);
  const bankStatus = useSectionAutoSave(banking, saveBanking);
  const empStatus = useSectionAutoSave(employment, saveEmployment);

  // ---------- Section completeness ----------
  const personalSec = useMemo<SectionStatus>(() =>
    sectionStatus([personal.full_name, personal.email, personal.phone, personal.id_number, personal.date_of_birth, personal.gender]),
    [personal]);
  const address1Sec = useMemo<SectionStatus>(() =>
    sectionStatus([address1.line1, address1.city, address1.province, address1.postal_code]),
    [address1]);
  const address2Sec = useMemo<SectionStatus>(() =>
    sectionStatus([address2.line1, address2.city, address2.province, address2.postal_code]),
    [address2]);
  const nokSec = useMemo<SectionStatus>(() =>
    sectionStatus([nok.full_name, nok.relationship, nok.phone]),
    [nok]);
  const finSec = useMemo<SectionStatus>(() =>
    sectionStatus([financial.sars_tax_number, financial.marital_status]),
    [financial]);
  const bankSec = useMemo<SectionStatus>(() =>
    sectionStatus([banking.bank_name, banking.account_number, banking.branch_code, banking.account_type, banking.account_holder]),
    [banking]);
  const empSec = useMemo<SectionStatus>(() =>
    sectionStatus([employment.employer, employment.position]),
    [employment]);

  const allSections = [
    { id: "personal", label: "Personal", status: personalSec },
    { id: "address1", label: "Address 1", status: address1Sec },
    { id: "address2", label: "Address 2", status: address2Sec },
    { id: "nok", label: "Next of Kin", status: nokSec },
    { id: "sars", label: "SARS", status: finSec },
    { id: "banking", label: "Banking", status: bankSec },
    { id: "employment", label: "Employment", status: empSec },
  ] as const;
  const completedCount = allSections.filter((s) => s.status === "complete").length;

  // ---------- CV handlers (preserved) ----------
  const reloadCv = async () => {
    if (!user) return;
    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (!p) return;
    setPersonal((prev) => ({
      ...prev,
      full_name: p.full_name ?? prev.full_name,
      phone: p.phone ?? prev.phone,
      faculty: p.faculty ?? prev.faculty,
      department: p.department ?? prev.department,
      qualification: p.qualification ?? prev.qualification,
      year_of_study: p.year_of_study ?? prev.year_of_study,
      bio: p.bio ?? prev.bio,
    }));
    setCvPath((p as any).cv_path ?? null);
    setCvUploadedAt((p as any).cv_uploaded_at ?? null);
  };

  const handleCvUpload = async (file: File) => {
    if (!user) return;
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowed.includes(file.type)) { toast.error("Upload a PDF or image of your CV."); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("CV must be under 10 MB."); return; }
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
      toast.success(filled.length ? `Auto-filled ${filled.length} field(s) from your CV.` : "CV saved.");
      await reloadCv();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not parse CV");
    } finally { setCvParsing(false); }
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
      const { data: appRows } = await supabase.from("applications").select("id").eq("user_id", user.id);
      const appIds = (appRows ?? []).map((a) => a.id);
      if (appIds.length === 0) { toast.info("No applications yet to sync from."); return; }
      const { data: appDocs } = await supabase.from("application_documents").select("*").in("application_id", appIds);
      const docIds = Array.from(new Set((appDocs ?? []).map((d: any) => d.document_id).filter(Boolean)));
      let labels: Record<string, string> = {};
      if (docIds.length) {
        const { data: meta } = await supabase.from("workflow_documents").select("id,name").in("id", docIds as string[]);
        labels = Object.fromEntries((meta ?? []).map((m: any) => [m.id, m.name]));
      }
      const byLabel = new Map<string, any>();
      (appDocs ?? []).forEach((d: any) => {
        const label = (d.document_id && labels[d.document_id]) || d.file_name || "Document";
        const existing = byLabel.get(label);
        if (!existing || new Date(d.uploaded_at) > new Date(existing.uploaded_at)) byLabel.set(label, d);
      });
      const rows = Array.from(byLabel.entries()).map(([label, d]) => ({
        user_id: user.id, label, file_name: d.file_name, file_path: d.file_path, source_application_id: d.application_id,
      }));
      if (rows.length === 0) { toast.info("No documents found to sync."); return; }
      const { error } = await supabase.from("profile_documents").upsert(rows as never, { onConflict: "user_id,label" });
      if (error) throw error;
      const { data: pd } = await supabase.from("profile_documents").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setProfileDocs(pd ?? []);
      toast.success(`Synced ${rows.length} document(s).`);
    } catch (e: any) {
      toast.error(e?.message ?? "Sync failed");
    } finally { setSyncing(false); }
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
      <main className="container mx-auto px-4 py-6 md:py-8 flex-1 max-w-4xl w-full">
        <BackButton to="/dashboard" label="Back to dashboard" />
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-1">My Profile</h1>
            <p className="text-muted-foreground text-sm">
              Fill once — every application form auto-fills from these details. Changes save automatically.
            </p>
          </div>
          <div className="text-xs px-3 py-1.5 rounded-full bg-muted border">
            <strong>{completedCount}</strong> / {allSections.length} sections complete
          </div>
        </div>

        {/* Section navigator */}
        <div className="flex flex-wrap gap-2 mb-6">
          {allSections.map((s) => (
            <a key={s.id} href={`#${s.id}`}
               className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                 s.status === "complete" ? "bg-success/10 text-success border-success/30"
                   : s.status === "incomplete" ? "bg-warning/10 text-warning border-warning/30"
                   : "bg-muted border-border"
               }`}>
              {s.label}
            </a>
          ))}
        </div>

        {/* CV upload */}
        <Card className="mb-6 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="w-4 h-4 text-accent" /> Auto-fill from your CV
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Upload your CV (PDF or image). AI reads it and fills any blank fields below.
            </p>
            {cvPath ? (
              <div className="flex items-center justify-between gap-3 p-3 border rounded-lg bg-muted/30 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">CV on file</p>
                    <p className="text-xs text-muted-foreground">Uploaded {cvUploadedAt ? new Date(cvUploadedAt).toLocaleString() : ""}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
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
          </CardContent>
        </Card>

        {/* Section: Personal */}
        <div id="personal" className="scroll-mt-24 mb-6">
          <SectionCard title="Personal Details" status={personalSec} saveStatus={personalStatus}>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field id="title" label="Title" value={personal.title} onChange={(v) => setPersonal((p) => ({ ...p, title: v }))} placeholder="Mr / Ms / Dr" />
              <Field id="full_name" label="Full Name" value={personal.full_name} onChange={(v) => setPersonal((p) => ({ ...p, full_name: v }))} />
              <Field id="email" label="Email" type="email" value={personal.email} onChange={(v) => setPersonal((p) => ({ ...p, email: v }))} />
              <Field id="phone" label="Phone" type="tel" value={personal.phone} onChange={(v) => setPersonal((p) => ({ ...p, phone: v }))} />
              <Field id="dob" label="Date of Birth" type="date" value={personal.date_of_birth} onChange={(v) => setPersonal((p) => ({ ...p, date_of_birth: v }))} />
              <Field id="gender" label="Gender" value={personal.gender} onChange={(v) => setPersonal((p) => ({ ...p, gender: v }))}>
                <Select value={personal.gender} onValueChange={(v) => setPersonal((p) => ({ ...p, gender: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {["Female", "Male", "Other", "Prefer not to say"].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="id_number" label="ID Number / Passport" value={personal.id_number} onChange={(v) => setPersonal((p) => ({ ...p, id_number: v }))} />
              <Field id="nationality" label="Nationality" value={personal.nationality} onChange={(v) => setPersonal((p) => ({ ...p, nationality: v }))} />
              <Field id="race" label="Race" value={personal.race} onChange={(v) => setPersonal((p) => ({ ...p, race: v }))} />
              <Field id="home_language" label="Home Language" value={personal.home_language} onChange={(v) => setPersonal((p) => ({ ...p, home_language: v }))} />
              <Field id="disability" label="Disability (if any)" value={personal.disability} onChange={(v) => setPersonal((p) => ({ ...p, disability: v }))} placeholder="None" />
              <Field id="student_number" label="Student Number" value={personal.student_number} onChange={(v) => setPersonal((p) => ({ ...p, student_number: v }))} />
              <Field id="staff_number" label="Staff Number" value={personal.staff_number} onChange={(v) => setPersonal((p) => ({ ...p, staff_number: v }))} />
              <Field id="faculty" label="Faculty" value={personal.faculty} onChange={(v) => setPersonal((p) => ({ ...p, faculty: v, department: "" }))}>
                <Select value={personal.faculty} onValueChange={(v) => setPersonal((p) => ({ ...p, faculty: v, department: "" }))}>
                  <SelectTrigger><SelectValue placeholder="Select faculty" /></SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {UFH_FACULTY_NAMES.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="department" label="Department" value={personal.department} onChange={(v) => setPersonal((p) => ({ ...p, department: v }))}>
                <Select value={personal.department} onValueChange={(v) => setPersonal((p) => ({ ...p, department: v }))} disabled={!personal.faculty}>
                  <SelectTrigger><SelectValue placeholder={personal.faculty ? "Select department" : "Choose faculty first"} /></SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {(UFH_FACULTIES[personal.faculty] ?? []).map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="qualification" label="Qualification / Programme" value={personal.qualification} onChange={(v) => setPersonal((p) => ({ ...p, qualification: v }))} />
              <Field id="year_of_study" label="Year of Study" value={personal.year_of_study} onChange={(v) => setPersonal((p) => ({ ...p, year_of_study: v }))} />
              <Field id="bio" label="Short Bio" value={personal.bio} onChange={(v) => setPersonal((p) => ({ ...p, bio: v }))} textarea className="sm:col-span-2" />
            </div>
          </SectionCard>
        </div>

        {/* Address 1 */}
        <div id="address1" className="scroll-mt-24 mb-6">
          <SectionCard title="Address 1 (Home / Residential)" status={address1Sec} saveStatus={address1Status}>
            <AddressFields value={address1} onChange={setAddress1} prefix="addr1" />
          </SectionCard>
        </div>

        {/* Address 2 */}
        <div id="address2" className="scroll-mt-24 mb-6">
          <SectionCard title="Address 2 (Postal)" status={address2Sec} saveStatus={address2Status}
            description="Optional — used when postal address differs from residential.">
            <AddressFields value={address2} onChange={setAddress2} prefix="addr2" />
          </SectionCard>
        </div>

        {/* Next of Kin */}
        <div id="nok" className="scroll-mt-24 mb-6">
          <SectionCard title="Next of Kin" status={nokSec} saveStatus={nokStatus}>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field id="nok_name" label="Full Name" value={nok.full_name} onChange={(v) => setNok((p) => ({ ...p, full_name: v }))} />
              <Field id="nok_rel" label="Relationship" value={nok.relationship} onChange={(v) => setNok((p) => ({ ...p, relationship: v }))} />
              <Field id="nok_phone" label="Phone" type="tel" value={nok.phone} onChange={(v) => setNok((p) => ({ ...p, phone: v }))} />
              <Field id="nok_email" label="Email" type="email" value={nok.email} onChange={(v) => setNok((p) => ({ ...p, email: v }))} />
              <Field id="nok_addr" label="Address" value={nok.address} onChange={(v) => setNok((p) => ({ ...p, address: v }))} textarea className="sm:col-span-2" />
            </div>
          </SectionCard>
        </div>

        {/* SARS / Financial */}
        <div id="sars" className="scroll-mt-24 mb-6">
          <SectionCard title="SARS / Tax Information" status={finSec} saveStatus={finStatus}>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field id="sars_no" label="SARS Tax Number" value={financial.sars_tax_number} onChange={(v) => setFinancial((p) => ({ ...p, sars_tax_number: v }))} />
              <Field id="income_ref" label="Income Tax Ref" value={financial.income_tax_ref} onChange={(v) => setFinancial((p) => ({ ...p, income_tax_ref: v }))} />
              <Field id="vat_no" label="VAT Number (if any)" value={financial.vat_number} onChange={(v) => setFinancial((p) => ({ ...p, vat_number: v }))} />
              <Field id="dependants" label="Number of Dependants" type="number" value={financial.dependants} onChange={(v) => setFinancial((p) => ({ ...p, dependants: v }))} />
              <Field id="marital" label="Marital Status" value={financial.marital_status} onChange={(v) => setFinancial((p) => ({ ...p, marital_status: v }))}>
                <Select value={financial.marital_status} onValueChange={(v) => setFinancial((p) => ({ ...p, marital_status: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {["Single", "Married", "Divorced", "Widowed", "Civil Union"].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </SectionCard>
        </div>

        {/* Banking */}
        <div id="banking" className="scroll-mt-24 mb-6">
          <SectionCard title="Banking Details" status={bankSec} saveStatus={bankStatus}
            description="Used for stipend / honorarium payments. Only you and admin reviewers can see this.">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field id="bank_name" label="Bank Name" value={banking.bank_name} onChange={(v) => setBanking((p) => ({ ...p, bank_name: v }))} />
              <Field id="branch_code" label="Branch Code" value={banking.branch_code} onChange={(v) => setBanking((p) => ({ ...p, branch_code: v }))} />
              <Field id="account_number" label="Account Number" value={banking.account_number} onChange={(v) => setBanking((p) => ({ ...p, account_number: v }))} />
              <Field id="account_holder" label="Account Holder" value={banking.account_holder} onChange={(v) => setBanking((p) => ({ ...p, account_holder: v }))} />
              <Field id="account_type" label="Account Type" value={banking.account_type} onChange={(v) => setBanking((p) => ({ ...p, account_type: v }))}>
                <Select value={banking.account_type} onValueChange={(v) => setBanking((p) => ({ ...p, account_type: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {["Cheque", "Savings", "Transmission"].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </SectionCard>
        </div>

        {/* Employment */}
        <div id="employment" className="scroll-mt-24 mb-6">
          <SectionCard title="Employment" status={empSec} saveStatus={empStatus}
            description="Most recent or current employment. Add more roles after saving this one.">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field id="employer" label="Employer" value={employment.employer} onChange={(v) => setEmployment((p) => ({ ...p, employer: v }))} />
              <Field id="position" label="Position" value={employment.position} onChange={(v) => setEmployment((p) => ({ ...p, position: v }))} />
              <Field id="start_date" label="Start Date" type="date" value={employment.start_date} onChange={(v) => setEmployment((p) => ({ ...p, start_date: v }))} />
              <Field id="end_date" label="End Date" type="date" value={employment.end_date} onChange={(v) => setEmployment((p) => ({ ...p, end_date: v }))} />
              <Field id="sup_name" label="Supervisor Name" value={employment.supervisor_name} onChange={(v) => setEmployment((p) => ({ ...p, supervisor_name: v }))} />
              <Field id="sup_contact" label="Supervisor Contact" value={employment.supervisor_contact} onChange={(v) => setEmployment((p) => ({ ...p, supervisor_contact: v }))} />
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={employment.is_current} onChange={(e) => setEmployment((p) => ({ ...p, is_current: e.target.checked }))} />
                I currently work here
              </label>
            </div>
          </SectionCard>
        </div>

        {/* Saved documents */}
        <Card className="mt-6">

        </Card>
        {Object.keys(profileExtra).length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-accent" /> Additional information</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">
                Extra details collected from application forms — these grow your profile so future applications auto-fill them.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {Object.entries(profileExtra).map(([key, entry]) => (
                  <div key={key} className="p-3 border rounded-lg bg-muted/30">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{entry.label || key}</p>
                    <p className="text-sm font-medium break-words">{entry.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        <Card className="mt-6 hidden">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Saved Documents</CardTitle>
            <Button size="sm" variant="outline" onClick={syncFromApplications} disabled={syncing}>
              {syncing ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5 mr-1" />}
              Sync from applications
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Documents uploaded to past applications are saved here so future applications can reuse them.
            </p>
            {profileDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No saved documents yet.</p>
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

// ---------- Address sub-form ----------
const AddressFields = ({ value, onChange, prefix }: { value: Address; onChange: (v: Address) => void; prefix: string }) => (
  <div className="grid sm:grid-cols-2 gap-3">
    <Field id={`${prefix}_line1`} label="Address Line 1" value={value.line1} onChange={(v) => onChange({ ...value, line1: v })} className="sm:col-span-2" />
    <Field id={`${prefix}_line2`} label="Address Line 2" value={value.line2} onChange={(v) => onChange({ ...value, line2: v })} className="sm:col-span-2" />
    <Field id={`${prefix}_city`} label="City / Town" value={value.city} onChange={(v) => onChange({ ...value, city: v })} />
    <Field id={`${prefix}_province`} label="Province" value={value.province} onChange={(v) => onChange({ ...value, province: v })} />
    <Field id={`${prefix}_postal`} label="Postal Code" value={value.postal_code} onChange={(v) => onChange({ ...value, postal_code: v })} />
    <Field id={`${prefix}_country`} label="Country" value={value.country} onChange={(v) => onChange({ ...value, country: v })} />
  </div>
);

export default ProfilePage;