import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, MessageSquare, ScrollText, RefreshCw } from "lucide-react";

type Intent = {
  id: string;
  name: string;
  keywords: string[];
  response: string;
  actions: { label: string; route?: string; url?: string }[] | null;
  audience: "all" | "student" | "admin";
  enabled: boolean;
  priority: number;
};

type ChatLog = {
  id: string;
  user_id: string | null;
  event_type: string;
  source: string | null;
  model: string | null;
  duration_ms: number | null;
  success: boolean | null;
  error_message: string | null;
  metadata: any;
  created_at: string;
};

const empty = (): Intent => ({
  id: "",
  name: "",
  keywords: [],
  response: "",
  actions: [],
  audience: "all",
  enabled: true,
  priority: 50,
});

export function ChatIntentManager() {
  const [intents, setIntents] = useState<Intent[]>([]);
  const [logs, setLogs] = useState<ChatLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Intent | null>(null);
  const [tab, setTab] = useState<"intents" | "logs">("intents");

  const load = async () => {
    setLoading(true);
    const [intentRes, logsRes] = await Promise.all([
      supabase.from("chat_intents").select("*").order("priority", { ascending: false }),
      supabase.from("chat_logs").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setIntents((intentRes.data as any) ?? []);
    setLogs((logsRes.data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim() || !editing.response.trim()) {
      toast.error("Name and response are required");
      return;
    }
    const payload = {
      name: editing.name.trim(),
      keywords: editing.keywords.map((k) => k.trim()).filter(Boolean),
      response: editing.response.trim(),
      actions: editing.actions && editing.actions.length > 0 ? editing.actions : null,
      audience: editing.audience,
      enabled: editing.enabled,
      priority: Number(editing.priority) || 0,
    };
    const res = editing.id
      ? await supabase.from("chat_intents").update(payload).eq("id", editing.id)
      : await supabase.from("chat_intents").insert(payload);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success("Intent saved");
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this intent?")) return;
    const { error } = await supabase.from("chat_intents").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const toggleEnabled = async (intent: Intent) => {
    const { error } = await supabase.from("chat_intents").update({ enabled: !intent.enabled }).eq("id", intent.id);
    if (error) return toast.error(error.message);
    load();
  };

  const failCount = useMemo(() => logs.filter((l) => l.success === false).length, [logs]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant={tab === "intents" ? "default" : "outline"} size="sm" onClick={() => setTab("intents")}>
          <MessageSquare className="w-4 h-4 mr-1" /> Intents ({intents.length})
        </Button>
        <Button variant={tab === "logs" ? "default" : "outline"} size="sm" onClick={() => setTab("logs")}>
          <ScrollText className="w-4 h-4 mr-1" /> Logs {failCount > 0 && <Badge variant="destructive" className="ml-1">{failCount} failed</Badge>}
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
        {tab === "intents" && (
          <Button size="sm" onClick={() => setEditing(empty())}>
            <Plus className="w-4 h-4 mr-1" /> New intent
          </Button>
        )}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {tab === "intents" && !loading && (
        <div className="grid gap-2">
          {intents.map((i) => (
            <Card key={i.id} className="p-3">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{i.name}</p>
                    <Badge variant="outline" className="text-[10px]">{i.audience}</Badge>
                    <Badge variant="outline" className="text-[10px]">priority {i.priority}</Badge>
                    {!i.enabled && <Badge variant="secondary" className="text-[10px]">disabled</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">{i.response}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {i.keywords.map((k) => (
                      <Badge key={k} variant="secondary" className="text-[10px]">{k}</Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Switch checked={i.enabled} onCheckedChange={() => toggleEnabled(i)} />
                  <Button size="icon" variant="ghost" onClick={() => setEditing(i)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(i.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
          {intents.length === 0 && <p className="text-sm text-muted-foreground">No intents yet.</p>}
        </div>
      )}

      {tab === "logs" && !loading && (
        <div className="grid gap-1.5">
          {logs.map((l) => (
            <Card key={l.id} className="p-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={l.success === false ? "destructive" : l.success ? "default" : "secondary"} className="text-[10px]">
                  {l.event_type}
                </Badge>
                {l.source && <span className="text-muted-foreground">{l.source}</span>}
                {l.model && <span className="text-muted-foreground">{l.model}</span>}
                {typeof l.duration_ms === "number" && <span className="text-muted-foreground">{l.duration_ms}ms</span>}
                <span className="ml-auto text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span>
              </div>
              {l.error_message && <p className="mt-1 text-destructive">{l.error_message}</p>}
              {l.metadata && Object.keys(l.metadata).length > 0 && (
                <pre className="mt-1 text-[10px] text-muted-foreground overflow-x-auto">{JSON.stringify(l.metadata)}</pre>
              )}
            </Card>
          ))}
          {logs.length === 0 && <p className="text-sm text-muted-foreground">No chat logs yet.</p>}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit intent" : "New intent"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label>Keywords (comma separated, matched as lowercase substrings)</Label>
                <Input
                  value={editing.keywords.join(", ")}
                  onChange={(e) => setEditing({ ...editing, keywords: e.target.value.split(",").map((s) => s.trim()) })}
                  placeholder="bursary, funding, financial aid"
                />
              </div>
              <div>
                <Label>Response</Label>
                <Textarea rows={4} value={editing.response} onChange={(e) => setEditing({ ...editing, response: e.target.value })} />
              </div>
              <div>
                <Label>Actions JSON (optional)</Label>
                <Textarea
                  rows={3}
                  value={JSON.stringify(editing.actions ?? [], null, 2)}
                  onChange={(e) => {
                    try {
                      const v = JSON.parse(e.target.value || "[]");
                      setEditing({ ...editing, actions: Array.isArray(v) ? v : [] });
                    } catch {
                      /* let user keep typing */
                    }
                  }}
                  placeholder='[{"label":"View Opportunities","route":"/dashboard"}]'
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Audience</Label>
                  <Select value={editing.audience} onValueChange={(v: any) => setEditing({ ...editing, audience: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Everyone</SelectItem>
                      <SelectItem value="student">Students</SelectItem>
                      <SelectItem value="admin">Admins</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Priority</Label>
                  <Input type="number" value={editing.priority} onChange={(e) => setEditing({ ...editing, priority: Number(e.target.value) })} />
                </div>
                <div className="flex items-end gap-2">
                  <Switch checked={editing.enabled} onCheckedChange={(v) => setEditing({ ...editing, enabled: v })} />
                  <Label className="mb-2">Enabled</Label>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}