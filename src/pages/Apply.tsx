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
import { Check, ChevronLeft, ChevronRight, Loader2, Send, Upload, FileText, Trash2 } from "lucide-react";

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
        if (!respMap[f.id] && f.profile_field && profRes.data?.[f.profile_field]) {
          respMap[f.id] = String(profRes.data[f.profile_field]);
        }
      });
      setResponses(respMap);

      const { data: docFiles } = await supabase.from("application_documents").select("*").eq("application_id", app!.id);
      setUploadedDocs(docFiles ?? []);
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

    // also push to profile if mapped
    const f = fields.find((x) => x.id === fieldId);
    if (f?.profile_field && user) {
      supabase.from("profiles").update({ [f.profile_field]: value } as never).eq("id", user.id).then(() => setProfile((p: any) => ({ ...p, [f.profile_field]: value })));
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
    toast.success(`Uploaded ${file.name}`);
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

  const submitted = application?.status !== "draft";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 md:py-8 flex-1 max-w-4xl w-full">
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
              <FieldRenderer key={f.id} field={f} value={responses[f.id] || ""} onChange={(v) => updateField(f.id, v)} disabled={submitted} />
            ))}

            {isLastStep && (
              <>
                <div>
                  <h3 className="font-semibold mb-3">Required Documents</h3>
                  <div className="space-y-3">
                    {docs.length === 0 && <p className="text-sm text-muted-foreground">No documents required.</p>}
                    {docs.map((d) => {
                      const uploaded = uploadedDocs.filter((u) => u.document_id === d.id);
                      return (
                        <div key={d.id} className="p-4 border rounded-lg">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-sm flex items-center gap-2">
                                {d.name}
                                {d.required && <Badge variant="outline" className="text-[10px]">Required</Badge>}
                              </p>
                              {d.description && <p className="text-xs text-muted-foreground mt-1">{d.description}</p>}
                            </div>
                            {!submitted && (
                              <label className="cursor-pointer">
                                <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(d.id, e.target.files[0])} />
                                <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border bg-background hover:bg-muted">
                                  <Upload className="w-3 h-3" /> Upload
                                </span>
                              </label>
                            )}
                          </div>
                          {uploaded.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {uploaded.map((u) => (
                                <li key={u.id} className="flex items-center justify-between text-xs bg-muted/40 rounded px-2 py-1">
                                  <span className="flex items-center gap-1.5"><FileText className="w-3 h-3" /> {u.file_name}</span>
                                  {!submitted && (
                                    <button onClick={() => removeDoc(u)} className="text-destructive"><Trash2 className="w-3 h-3" /></button>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {!submitted && (
                  <div className="pt-4 border-t">
                    <Button onClick={submit} disabled={submitting} size="lg" className="w-full btn-gradient-primary text-primary-foreground">
                      {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                      Submit Application
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
      </main>
    </div>
  );
};

const FieldRenderer = ({ field, value, onChange, disabled }: { field: any; value: string; onChange: (v: string) => void; disabled?: boolean }) => {
  const common = { id: field.id, value, disabled, placeholder: field.placeholder ?? "" };
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