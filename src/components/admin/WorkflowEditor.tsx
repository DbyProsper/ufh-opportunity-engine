import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, FileText, GripVertical, Layers, ListChecks, Loader2, Plus, ScrollText, Sparkles, Trash2, Wand2 } from "lucide-react";
import { UFH_FACULTIES, UFH_FACULTY_NAMES } from "@/data/ufh";
import { generateSuggestion, rewriteSuggestion } from "@/lib/ai";
import { RULE_TYPES, RULE_TYPE_LABELS, YEAR_OF_STUDY_OPTIONS, QUALIFICATION_LEVELS } from "@/lib/eligibility";

const FIELD_TYPES = ["text", "textarea", "select", "multiselect", "date", "file", "number", "email", "phone"] as const;
const PROFILE_FIELDS = ["full_name", "email", "phone", "student_number", "staff_number", "faculty", "department", "qualification", "year_of_study", "address", "bio"];

interface Props {
  workflowId: string;
  onClose: () => void;
}

export const WorkflowEditor = ({ workflowId, onClose }: Props) => {
  const [loading, setLoading] = useState(true);
  const [wf, setWf] = useState<any>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [aiBusy, setAiBusy] = useState<string | null>(null);

  const aiHelp = async (label: string, current: string, onResult: (text: string) => void, key: string) => {
    setAiBusy(key);
    try {
      const field = { id: key, label, type: "textarea" };
      const ctxWorkflow = { name: wf?.name ?? "Workflow", description: wf?.description ?? "" };
      const res = current?.trim()
        ? await rewriteSuggestion(field, current, null, ctxWorkflow as any, "admin_workflow_description")
        : await generateSuggestion(field, null, ctxWorkflow as any, { regenerate: false, context: "admin_workflow_description" });
      if (res?.text) {
        onResult(res.text);
        toast.success(current?.trim() ? "Rewritten with AI" : "AI suggestion inserted");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "AI assist failed");
    } finally { setAiBusy(null); }
  };

  const load = async () => {
    const [wfR, sR, fR, dR, rR] = await Promise.all([
      supabase.from("workflows").select("*").eq("id", workflowId).maybeSingle(),
      supabase.from("workflow_steps").select("*").eq("workflow_id", workflowId).order("step_order"),
      supabase.from("workflow_fields").select("*").eq("workflow_id", workflowId).order("field_order"),
      supabase.from("workflow_documents").select("*").eq("workflow_id", workflowId).order("doc_order"),
      supabase.from("eligibility_rules").select("*").eq("workflow_id", workflowId).order("created_at"),
    ]);
    setWf(wfR.data);
    setSteps(sR.data ?? []);
    setFields(fR.data ?? []);
    setDocs(dR.data ?? []);
    setRules(rR.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [workflowId]);

  // ---------- WORKFLOW META ----------
  const saveMeta = async (patch: any) => {
    const { error } = await supabase.from("workflows").update(patch).eq("id", workflowId);
    if (error) return toast.error(error.message);
    setWf((w: any) => ({ ...w, ...patch }));
    toast.success("Saved");
  };

  // ---------- STEPS ----------
  const addStep = async () => {
    const { data, error } = await supabase.from("workflow_steps").insert({
      workflow_id: workflowId, title: `Step ${steps.length + 1}`, step_order: steps.length,
    }).select().single();
    if (error) return toast.error(error.message);
    setSteps((p) => [...p, data]);
  };
  const updateStep = async (id: string, patch: any) => {
    setSteps((p) => p.map((s) => s.id === id ? { ...s, ...patch } : s));
    await supabase.from("workflow_steps").update(patch).eq("id", id);
  };
  const deleteStep = async (id: string) => {
    if (!confirm("Delete this step? Fields linked to it will become unassigned.")) return;
    await supabase.from("workflow_fields").update({ step_id: null }).eq("step_id", id);
    await supabase.from("workflow_steps").delete().eq("id", id);
    setSteps((p) => p.filter((s) => s.id !== id));
    setFields((p) => p.map((f) => f.step_id === id ? { ...f, step_id: null } : f));
  };
  const moveStep = async (id: string, dir: -1 | 1) => {
    const idx = steps.findIndex((s) => s.id === id);
    const swap = idx + dir;
    if (swap < 0 || swap >= steps.length) return;
    const next = [...steps];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    next.forEach((s, i) => s.step_order = i);
    setSteps(next);
    await Promise.all(next.map((s) => supabase.from("workflow_steps").update({ step_order: s.step_order }).eq("id", s.id)));
  };

  // ---------- FIELDS ----------
  const addField = async (stepId: string | null) => {
    const { data, error } = await supabase.from("workflow_fields").insert({
      workflow_id: workflowId, step_id: stepId, label: "Untitled question",
      field_key: `field_${Date.now()}`, type: "text", field_order: fields.filter((f) => f.step_id === stepId).length,
    }).select().single();
    if (error) return toast.error(error.message);
    setFields((p) => [...p, data]);
  };
  const updateFieldLocal = (id: string, patch: any) =>
    setFields((p) => p.map((f) => f.id === id ? { ...f, ...patch } : f));
  const persistField = async (id: string, patch: any) => {
    await supabase.from("workflow_fields").update(patch).eq("id", id);
  };
  const deleteField = async (id: string) => {
    if (!confirm("Delete this field?")) return;
    await supabase.from("workflow_fields").delete().eq("id", id);
    setFields((p) => p.filter((f) => f.id !== id));
  };
  const moveField = async (id: string, dir: -1 | 1) => {
    const f = fields.find((x) => x.id === id);
    if (!f) return;
    const sibs = fields.filter((x) => x.step_id === f.step_id).sort((a, b) => a.field_order - b.field_order);
    const idx = sibs.findIndex((x) => x.id === id);
    const swap = idx + dir;
    if (swap < 0 || swap >= sibs.length) return;
    [sibs[idx], sibs[swap]] = [sibs[swap], sibs[idx]];
    sibs.forEach((x, i) => x.field_order = i);
    setFields((p) => p.map((x) => sibs.find((s) => s.id === x.id) ?? x));
    await Promise.all(sibs.map((x) => supabase.from("workflow_fields").update({ field_order: x.field_order }).eq("id", x.id)));
  };

  // ---------- DOCUMENTS ----------
  const addDoc = async () => {
    const { data, error } = await supabase.from("workflow_documents").insert({
      workflow_id: workflowId, name: "New document", required: true, doc_order: docs.length,
    }).select().single();
    if (error) return toast.error(error.message);
    setDocs((p) => [...p, data]);
  };
  const updateDocLocal = (id: string, patch: any) =>
    setDocs((p) => p.map((d) => d.id === id ? { ...d, ...patch } : d));
  const persistDoc = async (id: string, patch: any) => {
    await supabase.from("workflow_documents").update(patch).eq("id", id);
  };
  const deleteDoc = async (id: string) => {
    if (!confirm("Delete this document requirement?")) return;
    await supabase.from("workflow_documents").delete().eq("id", id);
    setDocs((p) => p.filter((d) => d.id !== id));
  };

  // ---------- ELIGIBILITY RULES ----------
  const addRule = async () => {
    const { data, error } = await supabase.from("eligibility_rules").insert({
      workflow_id: workflowId, rule_type: "faculty", rule_value: "",
    }).select().single();
    if (error) return toast.error(error.message);
    setRules((p) => [...p, data]);
  };
  const updateRuleLocal = (id: string, patch: any) =>
    setRules((p) => p.map((r) => r.id === id ? { ...r, ...patch } : r));
  const persistRule = async (id: string, patch: any) => {
    await supabase.from("eligibility_rules").update(patch).eq("id", id);
  };
  const deleteRule = async (id: string) => {
    await supabase.from("eligibility_rules").delete().eq("id", id);
    setRules((p) => p.filter((r) => r.id !== id));
  };

  if (loading || !wf) {
    return <div className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" /> Edit: {wf.name}
            <Badge variant={wf.is_active ? "default" : "outline"}>{wf.is_active ? "Active" : "Draft"}</Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="meta">
          <TabsList className="w-full justify-start flex-wrap h-auto">
            <TabsTrigger value="meta">Details</TabsTrigger>
            <TabsTrigger value="steps">Steps & Fields ({steps.length}/{fields.length})</TabsTrigger>
            <TabsTrigger value="docs">Documents ({docs.length})</TabsTrigger>
            <TabsTrigger value="rules">Eligibility ({rules.length})</TabsTrigger>
          </TabsList>

          {/* META */}
          <TabsContent value="meta" className="space-y-4 mt-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Name</Label>
                <Input defaultValue={wf.name} onBlur={(e) => saveMeta({ name: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>Slug</Label>
                <Input defaultValue={wf.slug} onBlur={(e) => saveMeta({ slug: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <Label>Description</Label>
                  <Button size="sm" variant="ghost" disabled={aiBusy === "wf-desc"}
                    onClick={() => {
                      const ta = document.getElementById("wf-desc-ta") as HTMLTextAreaElement | null;
                      aiHelp("Workflow description", ta?.value ?? "", (text) => {
                        if (ta) ta.value = text;
                        saveMeta({ description: text });
                      }, "wf-desc");
                    }}>
                    {aiBusy === "wf-desc" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1 text-accent" />}
                    AI assist
                  </Button>
                </div>
                <Textarea id="wf-desc-ta" defaultValue={wf.description ?? ""} rows={3} onBlur={(e) => saveMeta({ description: e.target.value })} />
              </div>
              <div className="space-y-2"><Label>Target audience</Label>
                <Select defaultValue={wf.target_role} onValueChange={(v) => saveMeta({ target_role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="student">Students</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="any">Anyone</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Deadline (optional)</Label>
                <Input type="datetime-local" defaultValue={wf.deadline ? new Date(wf.deadline).toISOString().slice(0, 16) : ""}
                  onBlur={(e) => saveMeta({ deadline: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              </div>
              <div className="space-y-2"><Label>Faculty (optional restriction)</Label>
                <Select defaultValue={wf.faculty ?? "__none__"} onValueChange={(v) => saveMeta({ faculty: v === "__none__" ? null : v, department: null })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="__none__">Any faculty</SelectItem>
                    {UFH_FACULTY_NAMES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Department (optional restriction)</Label>
                <Select defaultValue={wf.department ?? "__none__"} onValueChange={(v) => saveMeta({ department: v === "__none__" ? null : v })} disabled={!wf.faculty}>
                  <SelectTrigger><SelectValue placeholder={wf.faculty ? "Select…" : "Pick faculty first"} /></SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="__none__">Any department</SelectItem>
                    {(UFH_FACULTIES[wf.faculty] ?? []).map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between sm:col-span-2 p-3 border rounded-lg">
                <div>
                  <Label className="text-sm">Active</Label>
                  <p className="text-xs text-muted-foreground">Inactive workflows are hidden from users.</p>
                </div>
                <Switch checked={wf.is_active} onCheckedChange={(v) => saveMeta({ is_active: v })} />
              </div>
            </div>
          </TabsContent>

          {/* STEPS & FIELDS */}
          <TabsContent value="steps" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Organise the application form into ordered steps with custom fields.</p>
              <Button size="sm" onClick={addStep}><Plus className="w-3.5 h-3.5 mr-1" /> Add step</Button>
            </div>
            {steps.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No steps yet — add your first step above.</p>}
            {steps.map((s, i) => (
              <Card key={s.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-mono text-muted-foreground w-6">#{i + 1}</span>
                    <Input className="flex-1 font-medium" defaultValue={s.title}
                      onBlur={(e) => updateStep(s.id, { title: e.target.value })} />
                    <Button size="icon" variant="ghost" onClick={() => moveStep(s.id, -1)} disabled={i === 0}><ArrowUp className="w-3.5 h-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => moveStep(s.id, 1)} disabled={i === steps.length - 1}><ArrowDown className="w-3.5 h-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteStep(s.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                  <Textarea placeholder="Step description (optional)" defaultValue={s.description ?? ""} rows={2}
                    onBlur={(e) => updateStep(s.id, { description: e.target.value })} />
                  <div className="space-y-2 pl-4 border-l-2 border-primary/30">
                    {fields.filter((f) => f.step_id === s.id).sort((a, b) => a.field_order - b.field_order).map((f, fi, arr) => (
                      <FieldRow key={f.id} field={f} index={fi} total={arr.length}
                        onChange={(p) => updateFieldLocal(f.id, p)}
                        onPersist={(p) => persistField(f.id, p)}
                        onDelete={() => deleteField(f.id)}
                        onMove={(d) => moveField(f.id, d)} />
                    ))}
                    <Button size="sm" variant="outline" onClick={() => addField(s.id)}>
                      <Plus className="w-3 h-3 mr-1" /> Add field to this step
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* DOCUMENTS */}
          <TabsContent value="docs" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Documents the applicant must (or may) upload.</p>
              <Button size="sm" onClick={addDoc}><Plus className="w-3.5 h-3.5 mr-1" /> Add document</Button>
            </div>
            {docs.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No documents required.</p>}
            {docs.map((d) => (
              <Card key={d.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <Input className="flex-1 font-medium" defaultValue={d.name}
                      onBlur={(e) => { updateDocLocal(d.id, { name: e.target.value }); persistDoc(d.id, { name: e.target.value }); }} />
                    <div className="flex items-center gap-1.5 text-xs">
                      <Switch checked={d.required} onCheckedChange={(v) => { updateDocLocal(d.id, { required: v }); persistDoc(d.id, { required: v }); }} />
                      Required
                    </div>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteDoc(d.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                  <Textarea placeholder="Description / instructions (optional)" defaultValue={d.description ?? ""} rows={2}
                    onBlur={(e) => { updateDocLocal(d.id, { description: e.target.value }); persistDoc(d.id, { description: e.target.value }); }} />
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* RULES */}
          <TabsContent value="rules" className="space-y-4 mt-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">Profile-based rules block applicants when their profile doesn't match.</p>
              <Button size="sm" onClick={addRule}><Plus className="w-3.5 h-3.5 mr-1" /> Add rule</Button>
            </div>
            {rules.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No additional rules — only built-in faculty/department/deadline checks apply.</p>}
            {rules.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4 flex flex-wrap items-end gap-3">
                  <div className="space-y-1 flex-1 min-w-[140px]">
                    <Label className="text-xs">Profile field</Label>
                    <Select defaultValue={r.rule_type} onValueChange={(v) => { updateRuleLocal(r.id, { rule_type: v }); persistRule(r.id, { rule_type: v }); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-popover">
                        {PROFILE_FIELDS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 flex-1 min-w-[200px]">
                    <Label className="text-xs">Required value (case-insensitive)</Label>
                    <Input defaultValue={r.rule_value}
                      onBlur={(e) => { updateRuleLocal(r.id, { rule_value: e.target.value }); persistRule(r.id, { rule_value: e.target.value }); }} />
                  </div>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteRule(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------- inner field row ----------
const FieldRow = ({ field, index, total, onChange, onPersist, onDelete, onMove }: any) => {
  const isSelect = field.type === "select" || field.type === "multiselect";
  const optsText = Array.isArray(field.options) ? field.options.join("\n") : "";

  return (
    <div className="p-3 rounded-md border bg-muted/30 space-y-2">
      <div className="flex items-center gap-2">
        <ListChecks className="w-3.5 h-3.5 text-muted-foreground" />
        <Input className="flex-1 text-sm" placeholder="Question label" defaultValue={field.label}
          onBlur={(e) => { onChange({ label: e.target.value }); onPersist({ label: e.target.value }); }} />
        <Button size="icon" variant="ghost" onClick={() => onMove(-1)} disabled={index === 0}><ArrowUp className="w-3 h-3" /></Button>
        <Button size="icon" variant="ghost" onClick={() => onMove(1)} disabled={index === total - 1}><ArrowDown className="w-3 h-3" /></Button>
        <Button size="icon" variant="ghost" className="text-destructive" onClick={onDelete}><Trash2 className="w-3 h-3" /></Button>
      </div>
      <div className="grid sm:grid-cols-3 gap-2">
        <Select defaultValue={field.type} onValueChange={(v) => { onChange({ type: v }); onPersist({ type: v }); }}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-popover">
            {FIELD_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input className="h-9" placeholder="Placeholder" defaultValue={field.placeholder ?? ""}
          onBlur={(e) => { onChange({ placeholder: e.target.value }); onPersist({ placeholder: e.target.value }); }} />
        <Select defaultValue={field.profile_field ?? "__none__"} onValueChange={(v) => {
          const val = v === "__none__" ? null : v;
          onChange({ profile_field: val }); onPersist({ profile_field: val });
        }}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Auto-fill from profile…" /></SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="__none__">— No auto-fill —</SelectItem>
            {PROFILE_FIELDS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {isSelect && (
        <Textarea placeholder="One option per line" rows={3} defaultValue={optsText}
          onBlur={(e) => {
            const opts = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean);
            onChange({ options: opts }); onPersist({ options: opts });
          }} />
      )}
      <div className="flex items-center gap-4 text-xs">
        <label className="flex items-center gap-1.5">
          <Switch checked={field.required} onCheckedChange={(v) => { onChange({ required: v }); onPersist({ required: v }); }} />
          Required
        </label>
        <Input className="h-7 text-xs flex-1" placeholder="Help text (optional)" defaultValue={field.help_text ?? ""}
          onBlur={(e) => { onChange({ help_text: e.target.value }); onPersist({ help_text: e.target.value }); }} />
      </div>
    </div>
  );
};