import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MessageThread } from "@/components/MessageThread";
import { BackButton } from "@/components/BackButton";
import { formatDistanceToNow } from "date-fns";

interface ThreadRow {
  id: string;
  application_id: string;
  subject: string | null;
  last_message_at: string;
  application: { id: string; user_id: string; workflow_id: string } | null;
  workflow_name?: string | null;
  unread: number;
  preview?: string | null;
}

const Messages = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const selectedId = params.get("thread");

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      // Pull threads visible to this user (RLS already restricts: applicants → own, admins → all)
      const { data: tRows } = await supabase
        .from("message_threads")
        .select("id, application_id, subject, last_message_at")
        .order("last_message_at", { ascending: false });
      const ts = tRows ?? [];
      const appIds = Array.from(new Set(ts.map((t) => t.application_id)));
      const [appsRes, wfsRes, msgsRes] = await Promise.all([
        appIds.length
          ? supabase.from("applications").select("id,user_id,workflow_id").in("id", appIds)
          : Promise.resolve({ data: [] as any[] }),
        Promise.resolve({ data: [] as any[] }),
        ts.length
          ? supabase
              .from("messages")
              .select("thread_id, body, sender_id, read_at, created_at")
              .in("thread_id", ts.map((t) => t.id))
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const apps = (appsRes as any).data ?? [];
      const wfIds = Array.from(new Set(apps.map((a: any) => a.workflow_id)));
      const { data: wfs } = wfIds.length
        ? await supabase.from("workflows").select("id,name").in("id", wfIds)
        : { data: [] as any[] };
      const msgs = (msgsRes as any).data ?? [];
      const byThread: Record<string, any[]> = {};
      msgs.forEach((m: any) => { (byThread[m.thread_id] ??= []).push(m); });

      const rows: ThreadRow[] = ts.map((t) => {
        const application = apps.find((a: any) => a.id === t.application_id) ?? null;
        const wfName = application
          ? (wfs ?? []).find((w: any) => w.id === application.workflow_id)?.name ?? null
          : null;
        const tMsgs = byThread[t.id] ?? [];
        const unread = tMsgs.filter((m) => m.sender_id !== user.id && !m.read_at).length;
        const preview = tMsgs[0]?.body ?? null;
        return { ...t, application, workflow_name: wfName, unread, preview };
      });
      setThreads(rows);
      setLoading(false);
    })();
  }, [user]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) =>
      `${t.workflow_name ?? ""} ${t.subject ?? ""} ${t.preview ?? ""}`.toLowerCase().includes(q)
    );
  }, [threads, search]);

  const selected = threads.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 md:py-8 flex-1">
        <BackButton />
        <div className="mb-5">
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary" /> Messages
          </h1>
          <p className="text-muted-foreground text-sm">
            {isAdmin ? "All applicant conversations across the platform." : "Conversations with reviewers about your applications."}
          </p>
        </div>

        <div className="grid md:grid-cols-[340px_1fr] gap-4">
          <Card className="h-fit">
            <CardContent className="p-3">
              <div className="relative mb-3">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search conversations…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              {loading ? (
                <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
              ) : filtered.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No conversations yet.{" "}
                  {!isAdmin && (
                    <Link to="/dashboard" className="text-primary underline">Open an application</Link>
                  )}
                </div>
              ) : (
                <ul className="space-y-1 max-h-[70vh] overflow-y-auto pr-1">
                  {filtered.map((t) => {
                    const active = t.id === selectedId;
                    return (
                      <li key={t.id}>
                        <button
                          onClick={() => setParams({ thread: t.id })}
                          className={`w-full text-left p-2.5 rounded-md border transition-colors ${active ? "bg-primary/5 border-primary/40" : "hover:bg-muted/60 border-transparent"}`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <p className="text-sm font-medium truncate">{t.workflow_name ?? t.subject ?? "Application"}</p>
                            {t.unread > 0 && <Badge className="h-5 px-1.5 text-[10px]">{t.unread}</Badge>}
                          </div>
                          {t.preview && (
                            <p className="text-xs text-muted-foreground truncate">{t.preview}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatDistanceToNow(new Date(t.last_message_at), { addSuffix: true })}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <div>
            {selected && selected.application ? (
              <Card>
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold">{selected.workflow_name ?? "Application"}</p>
                      <p className="text-xs text-muted-foreground">Conversation thread</p>
                    </div>
                    {isAdmin && (
                      <Link to="/admin" className="text-xs text-primary underline">Open in Admin</Link>
                    )}
                  </div>
                  <MessageThread
                    applicationId={selected.application.id}
                    applicantId={selected.application.user_id}
                  />
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-10 text-center text-sm text-muted-foreground">
                  Select a conversation to view messages.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Messages;