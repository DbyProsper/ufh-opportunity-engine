import { useEffect, useRef, useState, useCallback } from "react";
import { MessageCircle, X, Sparkles, Send, Loader2, ExternalLink, ArrowRight, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type ChatAction = { label: string; route?: string; url?: string };
type ChatMsg = { id?: string; role: "user" | "assistant"; content: string; actions?: ChatAction[] };

type Intent = {
  id: string;
  name: string;
  keywords: string[];
  response: string;
  actions: ChatAction[] | null;
  audience: "all" | "student" | "admin";
  priority: number;
};

const FALLBACK_DEFAULT: ChatMsg = {
  role: "assistant",
  content:
    "I can help you find opportunities, check eligibility, understand documents, navigate the platform, or open UFH services like ITS, Blackboard and the library. What would you like to do?",
  actions: [
    { label: "View Opportunities", route: "/dashboard" },
    { label: "UFH Website", url: "https://www.ufh.ac.za" },
  ],
};

function matchIntent(input: string, intents: Intent[], audience: "admin" | "student" | "guest"): ChatMsg | null {
  const q = input.toLowerCase();
  const eligible = intents.filter(
    (i) => i.audience === "all" || (i.audience === "admin" && audience === "admin") || (i.audience === "student" && audience !== "guest"),
  );
  const sorted = [...eligible].sort((a, b) => b.priority - a.priority);
  for (const intent of sorted) {
    if (intent.keywords.some((k) => k && q.includes(k.toLowerCase()))) {
      return { role: "assistant", content: intent.response, actions: intent.actions ?? undefined };
    }
  }
  return null;
}

function parseActions(text: string): { content: string; actions?: ChatAction[] } {
  const m = text.match(/ACTIONS:\s*(\[.*\])\s*$/s);
  if (!m) return { content: text };
  try {
    const actions = JSON.parse(m[1]) as ChatAction[];
    return { content: text.slice(0, m.index).trim(), actions: Array.isArray(actions) ? actions.slice(0, 3) : undefined };
  } catch { return { content: text }; }
}

const WELCOME: ChatMsg = {
  role: "assistant",
  content: "Hi! I'm the UFH Opportunity Assistant. Ask about opportunities, eligibility, documents, or UFH services like ITS and Blackboard.",
};

export const ChatBubble = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([WELCOME]);
  const [intents, setIntents] = useState<Intent[]>([]);
  const { user, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  const audience: "admin" | "student" | "guest" = isAdmin ? "admin" : user ? "student" : "guest";

  // Load intents once
  useEffect(() => {
    supabase
      .from("chat_intents")
      .select("id,name,keywords,response,actions,audience,priority")
      .eq("enabled", true)
      .then(({ data }) => setIntents((data as any) ?? []));
  }, []);

  // Load persisted history for the signed-in user
  useEffect(() => {
    if (!user) {
      setMessages([WELCOME]);
      return;
    }
    supabase
      .from("chat_messages")
      .select("id,role,content,actions")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(200)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setMessages(
            data.map((r: any) => ({ id: r.id, role: r.role, content: r.content, actions: r.actions ?? undefined })),
          );
        } else {
          setMessages([WELCOME]);
        }
      });
  }, [user?.id]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, open]);

  const persist = useCallback(
    async (msg: ChatMsg) => {
      if (!user) return;
      await supabase.from("chat_messages").insert({
        user_id: user.id,
        role: msg.role,
        content: msg.content,
        actions: msg.actions ?? null,
      });
    },
    [user],
  );

  const buildContext = useCallback(async () => {
    try {
      const path = location.pathname;
      // /apply/:slug → include workflow + user's application
      const applyMatch = path.match(/^\/apply\/([^/]+)/);
      if (applyMatch) {
        const slug = applyMatch[1];
        const { data: wf } = await supabase
          .from("workflows")
          .select("id,name,slug,description,category,faculty,department,deadline,is_postgraduate_only")
          .eq("slug", slug)
          .maybeSingle();
        let application: any = null;
        if (wf && user) {
          const { data: app } = await supabase
            .from("applications")
            .select("id,status,submitted_at,rejection_reason,is_editable")
            .eq("workflow_id", (wf as any).id)
            .eq("user_id", user.id)
            .maybeSingle();
          application = app;
        }
        return { page: "apply", workflow: wf, application };
      }
      return { page: path };
    } catch {
      return { page: location.pathname };
    }
  }, [location.pathname, user?.id]);

  const clearHistory = async () => {
    if (!user) {
      setMessages([WELCOME]);
      return;
    }
    await supabase.from("chat_messages").delete().eq("user_id", user.id);
    setMessages([WELCOME]);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: ChatMsg = { role: "user", content: text };
    const next: ChatMsg[] = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    void persist(userMsg);
    const context = await buildContext();
    try {
      const { data, error } = await supabase.functions.invoke("ai-assist", {
        body: {
          action: "chat",
          payload: {
            messages: next.map((m) => ({ role: m.role, content: m.content })),
            role: audience,
            page: location.pathname,
            userId: user?.id ?? null,
            context,
          },
        },
      });
      if (error) throw error;
      const raw = (data as any)?.text as string | null;
      let reply: ChatMsg;
      if (raw) {
        const parsed = parseActions(raw);
        reply = { role: "assistant", content: parsed.content, actions: parsed.actions };
      } else {
        reply = matchIntent(text, intents, audience) ?? FALLBACK_DEFAULT;
      }
      setMessages((m) => [...m, reply]);
      void persist(reply);
    } catch (e) {
      console.error("chat error", e);
      const reply = matchIntent(text, intents, audience) ?? FALLBACK_DEFAULT;
      setMessages((m) => [...m, reply]);
      void persist(reply);
    } finally {
      setLoading(false);
    }
  };

  const doAction = (a: ChatAction) => {
    if (a.url) window.open(a.url, "_blank", "noopener,noreferrer");
    else if (a.route) { navigate(a.route); setOpen(false); }
  };

  if (!open) {
    return (
      <button
        aria-label="Open UFH Assistant"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition flex items-center justify-center"
      >
        <MessageCircle className="w-5 h-5" />
      </button>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 z-40 w-[360px] max-w-[92vw] h-[520px] max-h-[80vh] shadow-2xl border-accent/30 flex flex-col overflow-hidden">
      <div className="p-3 border-b flex items-center justify-between bg-accent/5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-accent/15 text-accent flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <p className="text-sm font-semibold">UFH Opportunity Assistant</p>
            <p className="text-[10px] text-muted-foreground">{isAdmin ? "Admin mode" : "Student mode"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user && messages.length > 1 && (
            <button onClick={clearHistory} aria-label="Clear history" title="Clear chat history">
              <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          )}
          <button onClick={() => setOpen(false)} aria-label="Close">
            <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              {m.content}
              {m.actions && m.actions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.actions.map((a, j) => (
                    <Button key={j} size="sm" variant="secondary" className="h-7 text-xs" onClick={() => doAction(a)}>
                      {a.url ? <ExternalLink className="w-3 h-3 mr-1" /> : <ArrowRight className="w-3 h-3 mr-1" />}
                      {a.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(); }}
        className="p-2 border-t flex items-center gap-2 bg-background shrink-0"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about opportunities, eligibility, UFH…"
          disabled={loading}
          className="h-9 text-sm"
          autoFocus
        />
        <Button type="submit" size="sm" disabled={loading || !input.trim()} className="h-9 px-3">
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </Card>
  );
};

export default ChatBubble;
