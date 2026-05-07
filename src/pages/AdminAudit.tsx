import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert, Filter, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";

interface AuditRow {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  table_name: string;
  row_id: string | null;
  operation: string;
  changed_keys: string[] | null;
  before: any;
  after: any;
  created_at: string;
}

const TABLES = [
  "applications","application_documents","application_responses",
  "offers","offer_documents","workflows","workflow_steps","workflow_fields",
  "workflow_documents","workflow_offer_templates","eligibility_rules",
  "profiles","user_roles","signatures","affidavit_submissions",
  "addresses","next_of_kin","financial_profile","banking_details","employment_details",
];

const opTone = (op: string) =>
  op === "INSERT" ? "bg-success/15 text-success" :
  op === "UPDATE" ? "bg-primary/15 text-primary" :
  op === "DELETE" ? "bg-destructive/15 text-destructive" :
  "bg-muted text-foreground";

const AdminAudit = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [search, setSearch] = useState("");
  const [tableFilter, setTableFilter] = useState("all");
  const [opFilter, setOpFilter] = useState("all");
  const [actorFilter, setActorFilter] = useState("all");
  const [showRow, setShowRow] = useState<AuditRow | null>(null);

  useEffect(() => { if (!authLoading && !user) navigate("/auth"); }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user || !isAdmin) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase.from("audit_log" as any).select("*").order("created_at", { ascending: false }).limit(500);
      setRows((data as AuditRow[]) ?? []);
      setLoading(false);
    })();
  }, [user, isAdmin]);

  const actors = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => { if (r.actor_id) map.set(r.actor_id, r.actor_email || r.actor_id); });
    return Array.from(map.entries());
  }, [rows]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (tableFilter !== "all" && r.table_name !== tableFilter) return false;
    if (opFilter !== "all" && r.operation !== opFilter) return false;
    if (actorFilter !== "all" && r.actor_id !== actorFilter) return false;
    if (search) {
      const hay = `${r.actor_email ?? ""} ${r.table_name} ${r.row_id ?? ""} ${(r.changed_keys ?? []).join(",")}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  }), [rows, search, tableFilter, opFilter, actorFilter]);

  if (!authLoading && user && !isAdmin) {
    return (
      <div className="min-h-screen bg-background"><AppHeader />
        <div className="container mx-auto py-16 max-w-md text-center">
          <ShieldAlert className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Admin access required</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 flex-1">
        <BackButton to="/admin" label="Back to admin" />
        <div className="flex items-center justify-between mb-4 mt-2 flex-wrap gap-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Audit trail</h1>
            <p className="text-muted-foreground text-sm">Every important system change is logged here.</p>
          </div>
        </div>
        <Card className="mb-4">
          <CardContent className="p-3 grid gap-2 md:grid-cols-12 items-end">
            <div className="md:col-span-4">
              <Input placeholder="Search email, table, row id, key…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="md:col-span-3">
              <Select value={tableFilter} onValueChange={setTableFilter}>
                <SelectTrigger><SelectValue placeholder="Table" /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">All tables</SelectItem>
                  {TABLES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Select value={opFilter} onValueChange={setOpFilter}>
                <SelectTrigger><SelectValue placeholder="Op" /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">All ops</SelectItem>
                  <SelectItem value="INSERT">Insert</SelectItem>
                  <SelectItem value="UPDATE">Update</SelectItem>
                  <SelectItem value="DELETE">Delete</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3">
              <Select value={actorFilter} onValueChange={setActorFilter}>
                <SelectTrigger><SelectValue placeholder="Actor" /></SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="all">All actors</SelectItem>
                  {actors.map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Filter className="w-4 h-4" /> {filtered.length} entries</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> :
             filtered.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Nothing matches.</p> :
             <div className="space-y-1.5">
               {filtered.map((r) => (
                 <button key={r.id} onClick={() => setShowRow(r)} className="w-full text-left flex items-center gap-3 p-2.5 border rounded-md hover:bg-muted/50">
                   <Badge className={`${opTone(r.operation)} font-mono text-[10px]`}>{r.operation}</Badge>
                   <span className="font-mono text-xs text-muted-foreground w-44 truncate">{r.table_name}</span>
                   <span className="text-xs flex-1 truncate">
                     {r.actor_email || <em className="text-muted-foreground">system</em>}
                     {r.changed_keys && r.changed_keys.length > 0 && (
                       <span className="text-muted-foreground"> · changed {r.changed_keys.slice(0,4).join(", ")}{r.changed_keys.length > 4 ? "…" : ""}</span>
                     )}
                   </span>
                   <span className="text-[10px] text-muted-foreground shrink-0">{new Date(r.created_at).toLocaleString()}</span>
                   <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                 </button>
               ))}
             </div>
            }
          </CardContent>
        </Card>
      </main>

      <Dialog open={!!showRow} onOpenChange={(o) => !o && setShowRow(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2">
            <Badge className={opTone(showRow?.operation ?? "")}>{showRow?.operation}</Badge>
            <span className="font-mono text-sm">{showRow?.table_name}</span>
          </DialogTitle></DialogHeader>
          {showRow && (
            <div className="space-y-3 text-sm">
              <p className="text-xs text-muted-foreground">
                {showRow.actor_email || "system"} · {new Date(showRow.created_at).toLocaleString()} · row <span className="font-mono">{showRow.row_id}</span>
              </p>
              {showRow.changed_keys && showRow.changed_keys.length > 0 && (
                <p className="text-xs">Changed: <span className="font-mono">{showRow.changed_keys.join(", ")}</span></p>
              )}
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <p className="font-semibold mb-1 text-xs uppercase text-muted-foreground">Before</p>
                  <pre className="text-[11px] bg-muted/40 border rounded p-2 overflow-auto max-h-80 whitespace-pre-wrap break-all">{JSON.stringify(showRow.before, null, 2) || "—"}</pre>
                </div>
                <div>
                  <p className="font-semibold mb-1 text-xs uppercase text-muted-foreground">After</p>
                  <pre className="text-[11px] bg-muted/40 border rounded p-2 overflow-auto max-h-80 whitespace-pre-wrap break-all">{JSON.stringify(showRow.after, null, 2) || "—"}</pre>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setShowRow(null)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAudit;