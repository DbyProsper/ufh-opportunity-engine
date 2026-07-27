import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { BackButton } from "@/components/BackButton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bell, MessageSquare, Inbox, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { UFHStateLoader } from "@/components/UFHStateLoader";

interface Notif {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  type: string;
  read_at: string | null;
  created_at: string;
  user_id: string;
}

const Notifications = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { play } = useNotificationSound();

  useEffect(() => { if (!authLoading && !user) navigate("/auth"); }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [nR, wR] = await Promise.all([
        supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200),
        supabase.from("workflows").select("id,name"),
      ]);
      setItems((nR.data as Notif[]) ?? []);
      setWorkflows(wR.data ?? []);
      setLoading(false);
    })();

    const channel = supabase
      .channel(`notif-page-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (p) => { setItems((prev) => [p.new as Notif, ...prev]); play(); }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (p) => { setItems((prev) => prev.map((n) => (n.id === p.new.id ? (p.new as Notif) : n))); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, play]);

  const grouped = useMemo(() => {
    // Group by detected workflow name in body; fall back to type-based buckets.
    const wfNames = workflows.map((w) => w.name as string).sort((a, b) => b.length - a.length);
    const byWorkflow = new Map<string, { name: string; items: Notif[] }>();
    const other: Notif[] = [];

    items.forEach((n) => {
      const haystack = `${n.title} ${n.body ?? ""}`.toLowerCase();
      const matched = wfNames.find((nm) => nm && haystack.includes(nm.toLowerCase()));
      if (matched) {
        if (!byWorkflow.has(matched)) byWorkflow.set(matched, { name: matched, items: [] });
        byWorkflow.get(matched)!.items.push(n);
      } else if (/message/i.test(n.title)) {
        const key = "Messages";
        if (!byWorkflow.has(key)) byWorkflow.set(key, { name: key, items: [] });
        byWorkflow.get(key)!.items.push(n);
      } else {
        other.push(n);
      }
    });

    return { byWorkflow: Array.from(byWorkflow.values()), other };
  }, [items, workflows]);

  const unreadCount = items.filter((n) => !n.read_at).length;

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  };

  const markGroupRead = async (groupItems: Notif[]) => {
    const ids = groupItems.filter((n) => !n.read_at).map((n) => n.id);
    if (ids.length === 0) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    const set = new Set(ids);
    setItems((prev) => prev.map((n) => set.has(n.id) ? { ...n, read_at: new Date().toISOString() } : n));
  };

  const markOne = async (id: string) => {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container mx-auto px-4 py-12">
          <div className="relative min-h-[280px] overflow-hidden rounded-2xl border bg-card/50">
            <UFHStateLoader message="Loading notifications..." />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 md:py-8 flex-1 max-w-3xl w-full">
        <BackButton to="/dashboard" label="Back to dashboard" />
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Notifications</h1>
              <p className="text-sm text-muted-foreground">{unreadCount} unread</p>
            </div>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <CheckCheck className="w-3.5 h-3.5 mr-1" /> Mark all read
            </Button>
          )}
        </div>

        {/* Message groups */}
        {grouped.byWorkflow.length > 0 && (
          <section className="mb-8">
            <h2 className="font-semibold mb-3 flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
              <MessageSquare className="w-4 h-4" /> Message threads
            </h2>
            <div className="space-y-3">
              {grouped.byWorkflow.map((g) => {
                const unread = g.items.filter((i) => !i.read_at).length;
                return (
                  <Card key={g.name}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-sm">{g.name}</h3>
                        <div className="flex items-center gap-2">
                          {unread > 0 && <Badge className="bg-accent text-accent-foreground">{unread} unread</Badge>}
                          {unread > 0 && (
                            <button onClick={() => markGroupRead(g.items)} className="text-xs text-primary hover:underline">
                              Mark read
                            </button>
                          )}
                        </div>
                      </div>
                      <ul className="space-y-1.5">
                        {g.items.slice(0, 8).map((n) => (
                          <li key={n.id}>
                            <button
                              onClick={() => { markOne(n.id); if (n.link) navigate(n.link); }}
                              className={`w-full text-left text-sm p-2 rounded hover:bg-muted/60 transition flex items-start gap-2 ${!n.read_at ? "bg-primary/5" : ""}`}
                            >
                              <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${!n.read_at ? "bg-primary" : "bg-transparent"}`} />
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">{n.title}</p>
                                {n.body && <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>}
                                <p className="text-[10px] text-muted-foreground mt-0.5">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Everything else */}
        <section>
          <h2 className="font-semibold mb-3 flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
            <Inbox className="w-4 h-4" /> Updates
          </h2>
          {grouped.other.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No notifications.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {grouped.other.map((n) => {
                const tone = n.type === "success" ? "border-success/30 bg-success/5"
                          : n.type === "error" ? "border-destructive/30 bg-destructive/5"
                          : n.type === "warning" ? "border-warning/30 bg-warning/5"
                          : "border-border";
                const content = (
                  <div className={`p-3 border rounded-lg ${tone} ${!n.read_at ? "ring-1 ring-primary/20" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-[10px] text-muted-foreground shrink-0">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                    </div>
                    {n.body && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{n.body}</p>}
                  </div>
                );
                return (
                  <button key={n.id} onClick={() => markOne(n.id)} className="w-full text-left">
                    {n.link ? <Link to={n.link} onClick={() => markOne(n.id)}>{content}</Link> : content}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default Notifications;