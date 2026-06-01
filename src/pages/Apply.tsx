import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useDebouncedCallback } from "@/hooks/useDebounce";
import { Check, ChevronLeft, ChevronRight, Loader2, Send, Upload, FileText, Trash2, Eye } from "lucide-react";
import { MessageThread } from "@/components/MessageThread";
import { Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { OfferPanel } from "@/components/OfferPanel";
import { Sparkles, AlertCircle } from "lucide-react";
import { AffidavitPanel } from "@/components/AffidavitPanel";
import { BackButton } from "@/components/BackButton";
import { EventTimeline, TimelineEvent } from "@/components/EventTimeline";
import { AIAssistantPanel } from "@/components/ai/AIAssistantPanel";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const Apply = () => {
  const { slug } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [workflow, setWorkflow] = useState<any>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [application, setApplication] = useState<any>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [uploadedDocs, setUploadedDocs] = useState<any[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [savingStatus, setSavingStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [usingCv, setUsingCv] = useState<string | null>(null);
  const [appEvents, setAppEvents] = useState<TimelineEvent[]>([]);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  useEffect(() => { if (!authLoading && !user) navigate("/auth"); }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user || !slug) return;
    (async () => {
      const { data: wf } = await supabase.from("workflows").select("*").eq("slug", slug).maybeSingle();
      if (!wf) { setLoading(false); return; }
      setWorkflow(wf);
      const [stepsRes, fieldsRes, docsRes, profRes] = await Promise.all([
        supabase.from("workflow_steps").select("*").eq("workflow_id", wf.id).order("step_order"),
        supabase.from("workflow_fields").select("*").eq("workflow_id", wf.id).order("field_order"),
        supabase.from("workflow_documents").select("*").eq("workflow_id", wf.id).order("doc_order"),
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      ]);
      setSteps(stepsRes.data ?? []);
      setFields(fieldsRes.data ?? []);
      setDocs(docsRes.data ?? []);
      setProfile(profRes.data);

      // Pull related profile tables for richer auto-fill
      const [{ data: addrs }, { data: noks }, { data: fin }, { data: banks }, { data: emps }] = await Promise.all([
        (supabase.from as any)("addresses").select("*").eq("user_id", user.id),
        (supabase.from as any)("next_of_kin").select("*").eq("user_id", user.id).limit(1),
        (supabase.from as any)("financial_profile").select("*").eq("user_id", user.id).maybeSingle(),
        (supabase.from as any)("banking_details").select("*").eq("user_id", user.id).limit(1),
        (supabase.from as any)("employment_details").select("*").eq("user_id", user.id).order("is_current", { ascending: false }).limit(1),
      ]);
      const addrHome = ((addrs as any[]) ?? []).find((a) => a.kind === "home") ?? (addrs as any[])?.[0];
      const addrPost = ((addrs as any[]) ?? []).find((a) => a.kind === "postal");
      const profileLookup: Record<string, any> = { ...(profRes.data ?? {}) };
      const prefixMap: Record<string, any> = {
        "address.": addrHome,
        "address1.": addrHome,
        "address2.": addrPost,
        "nok.": ((noks as any[]) ?? [])[0],
        "fin.": fin,
        "bank.": ((banks as any[]) ?? [])[0],
        "employment.": ((emps as any[]) ?? [])[0],
      };

      // get-or-create application
      let { data: app } = await supabase.from("applications").select("*").eq("user_id", user.id).eq("workflow_id", wf.id).maybeSingle();
      if (!app) {
        const { data: newApp, error: createErr } = await supabase
          .from("applications")
          .insert({ user_id: user.id, workflow_id: wf.id, status: "draft" })
          .select()
          .single();
        if (createErr) {
          toast.error(`Could not start application: ${createErr.message}`);
          setLoading(false);
          return;
        }
        app = newApp;
      }
      setApplication(app);

      const { data: respData } = await supabase.from("application_responses").select("*").eq("application_id", app!.id);
      const respMap: Record<string, string> = {};
      (respData ?? []).forEach((r: any) => { respMap[r.field_id] = r.value ?? ""; });

      // auto-fill from profile for any field with profile_field
      (fieldsRes.data ?? []).forEach((f: any) => {
        if (respMap[f.id] || !f.profile_field) return;
        const pf: string = f.profile_field;
        // 1) Direct profile column
        if (profileLookup[pf] != null && profileLookup[pf] !== "") {
          respMap[f.id] = String(profileLookup[pf]);
          return;
        }
        // 2) Prefixed lookup, e.g. "address.line1", "bank.account_number"
        const prefixKey = Object.keys(prefixMap).find((k) => pf.startsWith(k));
        if (prefixKey) {
          const src = prefixMap[prefixKey];
          const col = pf.slice(prefixKey.length);
          if (src && src[col] != null && src[col] !== "") {
            respMap[f.id] = String(src[col]);
          }
        }
      });
      setResponses(respMap);

      const { data: docFiles } = await supabase.from("application_documents").select("*").eq("application_id", app!.id);
      setUploadedDocs(docFiles ?? []);

      const { data: evs } = await supabase
        .from("application_events" as any)
        .select("*")
        .eq("application_id", app!.id)
        .order("created_at", { ascending: true });
      setAppEvents((evs as any[] ?? []) as TimelineEvent[]);

      setLoading(false);
    })();
  }, [user, slug]);

  // Auto-save (debounced)
  const debouncedSave = useDebouncedCallback(async (newResponses: Record<string, string>) => {
    if (!application) return;
    setSavingStatus("saving");
    const rows = Object.entries(newResponses)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([field_id, value]) => ({ application_id: application.id, field_id, value: String(value) }));
    if (rows.length === 0) { setSavingStatus("saved"); return; }
    const { error } = await supabase.from("application_responses").upsert(rows, { onConflict: "application_id,field_id" });
    if (error) { setSavingStatus("idle"); console.error(error); }
    else { setSavingStatus("saved"); setTimeout(() => setSavingStatus("idle"), 1500); }
  }, 800);

  const updateField = (fieldId: string, value: string) => {
    const next = { ...responses, [fieldId]: value };
    setResponses(next);
    debouncedSave(next);

    // Back-fill profile if this field maps to a profile attribute and the profile is empty for it
    const f = fields.find((x) => x.id === fieldId);
    if (!user || !f || !value || !value.trim()) return;
    if (f.profile_field) {
      const existing = profile?.[f.profile_field];
      if (!existing || String(existing).trim() === "") {
        supabase.from("profiles").update({ [f.profile_field]: value } as never).eq("id", user.id).then(() => setProfile((p: any) => ({ ...p, [f.profile_field]: value })));
      }
    } else if (f.field_key) {
      // Dynamically extend the profile with any new admin-introduced field
      const extra = (profile?.profile_extra as any) ?? {};
      const entry = extra[f.field_key];
      if (!entry || entry.value !== value || entry.label !== f.label) {
        const nextExtra = { ...extra, [f.field_key]: { label: f.label, value, updated_at: new Date().toISOString() } };
        supabase.from("profiles").update({ profile_extra: nextExtra } as never).eq("id", user.id)
          .then(() => setProfile((p: any) => ({ ...p, profile_extra: nextExtra })));
      }
    }
  };

  const handleFileUpload = async (docId: string, file: File) => {
    if (!user || !application) return;
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${application.id}/${docId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("application-documents").upload(path, file);
    if (error) { toast.error(error.message); return; }
    const { data: inserted } = await supabase.from("application_documents").insert({
      application_id: application.id, document_id: docId, file_path: path, file_name: file.name,
    }).select().single();
    if (inserted) setUploadedDocs((p) => [...p, inserted]);
    // Back-fill into profile document library so future applications can reuse it
    const docMeta = docs.find((d) => d.id === docId);
    if (docMeta?.name) {
      await supabase.from("profile_documents").upsert({
        user_id: user.id,
        label: docMeta.name,
        file_name: file.name,
        file_path: path,
        source_application_id: application.id,
      } as never, { onConflict: "user_id,label" });
    }
    toast.success(`Uploaded ${file.name}`);
  };

  const useCvForDoc = async (docId: string) => {
    if (!user || !application || !profile?.cv_path) return;
    setUsingCv(docId);
    try {
      // Download CV from user-cvs, then upload as application document
      const { data: blob, error } = await supabase.storage.from("user-cvs").download(profile.cv_path);
      if (error || !blob) throw error ?? new Error("Could not load CV");
      const ext = profile.cv_path.split(".").pop() || "pdf";
      const path = `${user.id}/${application.id}/${docId}-cv-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("application-documents").upload(path, blob);
      if (upErr) throw upErr;
      const { data: inserted } = await supabase.from("application_documents").insert({
        application_id: application.id, document_id: docId, file_path: path, file_name: `CV.${ext}`,
      }).select().single();
      if (inserted) setUploadedDocs((p) => [...p, inserted]);
      toast.success("Used your saved CV");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not attach CV");
    } finally {
      setUsingCv(null);
    }
  };

  const removeDoc = async (docRow: any) => {
    await supabase.storage.from("application-documents").remove([docRow.file_path]);
    await supabase.from("application_documents").delete().eq("id", docRow.id);
    setUploadedDocs((p) => p.filter((d) => d.id !== docRow.id));
  };

  const stepFields = useMemo(
    () => fields.filter((f) => f.step_id === steps[stepIndex]?.id),
    [fields, steps, stepIndex]
  );
  // If the current step's title mentions "document", render the documents uploader inside that step
  const currentStepIsDocStep = useMemo(() => {
    const title = steps[stepIndex]?.title || "";
    return /document/i.test(title);
  }, [steps, stepIndex]);
  const hasDedicatedDocStep = useMemo(
    () => steps.some((s: any) => /document/i.test(s?.title || "")),
    [steps]
  );
  const isLastStep = stepIndex === steps.length;

  const validateAll = () => {
    const missingFields = fields.filter((f) => f.required && !responses[f.id]?.trim());
    const missingDocs = docs.filter((d) => d.required && !uploadedDocs.some((u) => u.document_id === d.id));
    return { missingFields, missingDocs };
  };

  const submit = async () => {
    if (!application) {
      toast.error("Application not initialised. Please refresh and try again.");
      return;
    }
    const { missingFields, missingDocs } = validateAll();
    if (missingFields.length || missingDocs.length) {
      toast.error(`Missing ${missingFields.length} field(s) and ${missingDocs.length} document(s)`);
      return;
    }
    // Final confirmation before submit
    setConfirmSubmit(true);
  };

  const doSubmit = async () => {
    if (!application) return;
    setConfirmSubmit(false);
    setSubmitting(true);
    const { error } = await supabase.from("applications").update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      is_editable: false,
    }).eq("id", application.id);
    setSubmitting(false);
    if (error) toast.error(`Submit failed: ${error.message}`);
    else {
      toast.success("Application submitted!");
      // create notification
      await supabase.from("notifications").insert({
        user_id: user!.id,
        title: "Application submitted",
        body: `Your ${workflow.name} application has been received.`,
        link: "/dashboard",
        type: "success",
      });
      navigate("/dashboard");
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-background"><AppHeader /><div className="container mx-auto py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div></div>;
  }

  if (!workflow) {
    return <div className="min-h-screen bg-background"><AppHeader /><div className="container mx-auto py-12 text-center"><p>Workflow not found.</p></div></div>;
  }

  const submitted = application?.status !== "draft" && application?.status !== "changes_requested";
  const editable = application?.status === "draft" || application?.status === "changes_requested";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 md:py-8 flex-1 max-w-4xl w-full">
        <BackButton to="/dashboard" label="Back to dashboard" />
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">{workflow.name}</h1>
          <p className="text-muted-foreground">{workflow.description}</p>
        </div>

        {submitted && (
          <Card className="mb-4 border-success/30 bg-success/5">
            <CardContent className="p-4 flex items-center gap-3">
              <Check className="w-5 h-5 text-success" />
              <p className="text-sm">Submitted — currently <strong>{application.status.replace("_"," ")}</strong>.</p>
            </CardContent>
          </Card>
        )}

        {(application?.status === "rejected" || application?.status === "changes_requested") && application?.rejection_reason && (
          <Card className={`mb-4 ${application.status === "rejected" ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5"}`}>
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className={`w-5 h-5 mt-0.5 ${application.status === "rejected" ? "text-destructive" : "text-warning"}`} />
              <div>
                <p className="text-sm font-semibold">{application.status === "rejected" ? "Application rejected" : "Changes requested by reviewer"}</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{application.rejection_reason}</p>
                {application.status === "changes_requested" && (
                  <p className="text-xs mt-1.5">Update your answers below and resubmit.</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stepper */}
        <div className="flex flex-wrap gap-2 mb-6">
          {steps.map((s, i) => (
            <button key={s.id} onClick={() => setStepIndex(i)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                i === stepIndex ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border hover:bg-muted/70"
              }`}>
              {i + 1}. {s.title}
            </button>
          ))}
          <button onClick={() => setStepIndex(steps.length)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              stepIndex === steps.length ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground border-border hover:bg-muted/70"
            }`}>
            {steps.length + 1}. Review & Submit
          </button>
          <div className="ml-auto text-xs text-muted-foreground self-center">
            {savingStatus === "saving" && <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving…</span>}
            {savingStatus === "saved" && <span className="text-success flex items-center gap-1"><Check className="w-3 h-3" /> Saved</span>}
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>{isLastStep ? "Review & Documents" : steps[stepIndex]?.title}</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {!isLastStep && stepFields.map((f) => (
              <FieldRenderer
                key={f.id}
                field={f}
                value={responses[f.id] || ""}
                onChange={(v) => updateField(f.id, v)}
                disabled={submitted}
                onFocus={() => setActiveFieldId(f.id)}
              />
            ))}

            {/* If this step is the documents step, show the documents uploader inline here */}
            {!isLastStep && currentStepIsDocStep && (
              <DocumentsUploader
                docs={docs}
                uploadedDocs={uploadedDocs}
                editable={editable}
                profile={profile}
                onUpload={handleFileUpload}
                onRemove={removeDoc}
                onUseCv={useCvForDoc}
                usingCv={usingCv}
              />
            )}

            {isLastStep && (
              <>
                {/* Profile snapshot */}
                <div>
                  <h3 className="font-semibold mb-3">Your Profile</h3>
                  <div className="grid sm:grid-cols-2 gap-3 p-4 border rounded-lg bg-muted/30 text-sm">
                    {[
                      ["Full Name", profile?.full_name],
                      ["Email", profile?.email],
                      ["Student Number", profile?.student_number],
                      ["Phone", profile?.phone],
                      ["Faculty", profile?.faculty],
                      ["Department", profile?.department],
                      ["Qualification", profile?.qualification],
                      ["Year of Study", profile?.year_of_study],
                    ].map(([label, val]) => (
                      <div key={label as string}>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
                        <p className="font-medium">{val || <span className="text-muted-foreground italic">Not set</span>}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* All field responses, grouped by step */}
                {steps.map((s) => {
                  const sf = fields.filter((f) => f.step_id === s.id);
                  if (sf.length === 0) return null;
                  return (
                    <div key={s.id}>
                      <h3 className="font-semibold mb-3">{s.title}</h3>
                      <div className="space-y-2 p-4 border rounded-lg bg-muted/30 text-sm">
                        {sf.map((f) => (
                          <div key={f.id} className="flex flex-col sm:flex-row sm:gap-3 border-b last:border-b-0 pb-2 last:pb-0">
                            <p className="text-muted-foreground sm:w-1/3 text-xs sm:text-sm">{f.label}</p>
                            <p className="font-medium flex-1 break-words">
                              {responses[f.id] || <span className="text-muted-foreground italic">Not answered</span>}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <div>
                  <h3 className="font-semibold mb-3">Required Documents</h3>
                  {hasDedicatedDocStep ? (
                    <p className="text-sm text-muted-foreground">Documents are uploaded in the &ldquo;Documents&rdquo; step above. {uploadedDocs.length} file(s) attached.</p>
                  ) : (
                    <DocumentsUploader
                      docs={docs}
                      uploadedDocs={uploadedDocs}
                      editable={editable}
                      profile={profile}
                      onUpload={handleFileUpload}
                      onRemove={removeDoc}
                      onUseCv={useCvForDoc}
                      usingCv={usingCv}
                    />
                  )}
                </div>

                {editable && (
                  <div className="pt-4 border-t">
                    <Button onClick={submit} disabled={submitting} size="lg" className="w-full btn-gradient-primary text-primary-foreground">
                      {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                      {application?.status === "changes_requested" ? "Resubmit Application" : "Submit Application"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between mt-4">
          <Button variant="outline" disabled={stepIndex === 0} onClick={() => setStepIndex((i) => Math.max(0, i - 1))}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>
          {stepIndex < steps.length && (
            <Button onClick={() => setStepIndex((i) => Math.min(steps.length, i + 1))}>
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>

        {submitted && application && user && (
          <>
            {/* Full application timeline */}
            <Card className="mt-6">
              <CardHeader><CardTitle className="text-lg">Application timeline</CardTitle></CardHeader>
              <CardContent>
                <EventTimeline events={appEvents} filterable empty="No history yet." />
              </CardContent>
            </Card>

            {/* Official UFH document downloads — only after admin approval and only for the Tutor workflow */}
            {application.status === "approved" && /tutor/i.test(workflow?.slug || workflow?.name || "") && (
              <Card className="mt-6">
                <CardHeader><CardTitle className="text-lg">Official UFH documents</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <UFHDocButton applicationId={application.id} kind="personal_info" label="Tutor Personal Information Form" />
                  <UFHDocButton applicationId={application.id} kind="acceptance" label="Acceptance of Post" />
                </CardContent>
              </Card>
            )}

            {/* Hybrid affidavit workflow — only after admin approves the application */}
            {application.status === "approved" && (
              <div className="mt-6">
                <AffidavitPanel applicationId={application.id} applicantId={user.id} />
              </div>
            )}

            {application.status === "approved" && (
              <div className="mt-6">
                <OfferPanel applicationId={application.id} workflowId={workflow.id} applicantId={user.id} isAdmin={false} />
              </div>
            )}
            <Card className="mt-6">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Messages with reviewers</CardTitle>
                {application.status === "approved" && (
                  <PreviewPackButton applicationId={application.id} />
                )}
              </CardHeader>
              <CardContent>
                <MessageThread applicationId={application.id} applicantId={user.id} />
              </CardContent>
            </Card>
          </>
        )}
      </main>
      {!submitted && (
        <AIAssistantPanel
          activeField={(() => {
            const f = fields.find((x) => x.id === activeFieldId);
            return f ? { id: f.id, label: f.label, help_text: f.help_text, type: f.type } : null;
          })()}
          profile={profile}
          workflow={workflow}
          applicationId={application?.id}
          currentValue={activeFieldId ? (responses[activeFieldId] || "") : ""}
          onInsert={(id, text) => {
            updateField(id, (responses[id] ? responses[id] + "\n\n" : "") + text);
            toast.success("Inserted into field");
          }}
        />
      )}

      <AlertDialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit your application?</AlertDialogTitle>
            <AlertDialogDescription>
              Please confirm all your information is correct. Once submitted, you won&apos;t be able to edit the application unless the reviewer sends it back to you.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Review again</AlertDialogCancel>
            <AlertDialogAction onClick={doSubmit} className="btn-gradient-primary text-primary-foreground">
              Yes, submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export const PreviewPackButton = ({
  applicationId,
  label = "Preview pack",
  includeOfferSigned = false,
  title = "Application pack preview",
  signedCopyAvailable,
}: {
  applicationId: string;
  label?: string;
  includeOfferSigned?: boolean;
  title?: string;
  signedCopyAvailable?: boolean;
}) => {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const generate = async () => {
    setLoading(true); setOpen(true); setUrl(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-application-pdf", {
        body: { applicationId, includeOfferSigned },
      });
      if (error) throw error;
      const u = (data as any)?.url;
      if (!u) throw new Error("No URL returned");
      setUrl(u);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate PDF");
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };
  return (
    <>
      <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
        {loading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
        {label}
      </Button>
      <Dialog open={open} onOpenChange={(o) => { if (!o) { setOpen(false); setUrl(null); } }}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 border rounded-md overflow-hidden bg-muted">
            {url ? (
              <div className="w-full h-full flex flex-col">
                {includeOfferSigned && signedCopyAvailable === false && (
                  <div className="bg-warning/10 text-warning border-b border-warning/30 px-3 py-2 text-xs">
                    No signed offer copy is available yet — showing the application pack without the signed offer.
                  </div>
                )}
                <iframe src={url} title="Application pack" className="w-full flex-1" />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Generating preview…
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setUrl(null); }}>Close</Button>
            <Button
              className="btn-gradient-primary text-primary-foreground"
              disabled={!url}
              onClick={() => url && window.open(url, "_blank")}
            >
              <Download className="w-3.5 h-3.5 mr-1" /> Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const UFHDocButton = ({
  applicationId,
  kind,
  label,
}: {
  applicationId: string;
  kind: "personal_info" | "acceptance" | "affidavit_blank";
  label: string;
}) => {
  const [loading, setLoading] = useState(false);
  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-ufh-pdf", {
        body: { applicationId, kind },
      });
      if (error) throw error;
      const u = (data as any)?.url;
      if (!u) throw new Error("No URL returned");
      window.open(u, "_blank");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate document");
    } finally { setLoading(false); }
  };
  return (
    <Button size="sm" variant="outline" onClick={generate} disabled={loading}>
      {loading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />}
      {label}
    </Button>
  );
};

const FieldRenderer = ({ field, value, onChange, disabled, onFocus }: { field: any; value: string; onChange: (v: string) => void; disabled?: boolean; onFocus?: () => void }) => {
  const common = { id: field.id, value, disabled, placeholder: field.placeholder ?? "", onFocus };
  const opts: string[] = Array.isArray(field.options) ? field.options : [];

  return (
    <div className="space-y-2">
      <Label htmlFor={field.id}>
        {field.label} {field.required && <span className="text-destructive">*</span>}
      </Label>
      {field.type === "textarea" ? (
        <Textarea {...common} rows={4} onChange={(e) => onChange(e.target.value)} />
      ) : field.type === "select" ? (
        <Select value={value} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
          <SelectContent className="bg-popover">
            {opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : (
        <Input
          {...common}
          type={field.type === "number" ? "number" : field.type === "email" ? "email" : field.type === "date" ? "date" : field.type === "phone" ? "tel" : "text"}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {field.help_text && <p className="text-xs text-muted-foreground">{field.help_text}</p>}
    </div>
  );
};

export default Apply;