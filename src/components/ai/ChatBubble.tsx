import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Sparkles, Send, Loader2, ExternalLink, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type ChatAction = { label: string; route?: string; url?: string };
type ChatMsg = { role: "user" | "assistant"; content: string; actions?: ChatAction[] };

const UFH_LINKS: Record<string, { label: string; url: string }> = {
  its: { label: "UFH ITS / iEnabler", url: "https://ienabler.ufh.ac.za/pls/prodi41/w99pkg.mi_login" },
  ienabler: { label: "UFH ITS / iEnabler", url: "https://ienabler.ufh.ac.za/pls/prodi41/w99pkg.mi_login" },
  blackboard: { label: "UFH Blackboard", url: "https://ufh.blackboard.com" },
  library: { label: "UFH Library", url: "https://libguides.ufh.ac.za" },
  financial: { label: "UFH Financial Aid", url: "https://www.ufh.ac.za/students/financial-aid" },
  website: { label: "UFH Website", url: "https://www.ufh.ac.za" },
  ufh: { label: "UFH Website", url: "https://www.ufh.ac.za" },
};

function ruleBasedReply(input: string, isAdmin: boolean): ChatMsg {
  const q = input.toLowerCase();
  const hit = Object.keys(UFH_LINKS).find((k) => q.includes(k));
  if (hit) {
    const link = UFH_LINKS[hit];
    return { role: "assistant", content: `Here is the ${link.label}. Click below to open it in a new tab.`, actions: [{ label: `Open ${link.label}`, url: link.url }] };
  }
  if (/eligib|qualify|can i apply/.test(q)) {
    return { role: "assistant", content: "Eligibility depends on your qualification, year of study, faculty and department. Open an opportunity and tap 'Why?' to see the exact check for it.", actions: [{ label: "Browse Opportunities", route: "/dashboard" }, { label: "Update Profile", route: "/profile" }] };
  }
  if (/document|upload|require|what do i need/.test(q)) {
    return { role: "assistant", content: "Most applications need: certified ID, latest academic transcript, CV, and any opportunity-specific documents listed on the application page.", actions: [{ label: "My Applications", route: "/dashboard" }] };
  }
  if (/opportun|bursary|intern|tutor|apply|browse/.test(q)) {
    return { role: "assistant", content: "You can browse all published opportunities on your dashboard. Filter by category or use the search bar.", actions: [{ label: "View Opportunities", route: "/dashboard" }] };
  }
  if (/deadline|due|when/.test(q)) {
    return { role: "assistant", content: "Each opportunity shows its closing date on the card. Open the details dialog for the exact deadline.", actions: [{ label: "View Opportunities", route: "/dashboard" }] };
  }
  if (/message|reviewer|chat/.test(q)) {
    return { role: "assistant", content: "All conversations with reviewers appear in your Messages inbox.", actions: [{ label: "Open Messages", route: "/messages" }] };
  }
  if (isAdmin && /(workflow|admin|extract|bulletin|invite)/.test(q)) {
    return { role: "assistant", content: "In the Admin dashboard you can create workflows, extract opportunities from the Daily Bulletin PDF, review applications, and manage admins.", actions: [{ label: "Admin Dashboard", route: "/admin" }, { label: "Audit Log", route: "/admin/audit" }] };
  }
  if (/profile|banking|next of kin/.test(q)) {
    return { role: "assistant", content: "Update your personal details, qualification and banking info on the Profile page. A complete profile speeds up applications.", actions: [{ label: "Open Profile", route: "/profile" }] };
  }
  if (/theme|dark|light|setting/.test(q)) {
    return { role: "assistant", content: "Change your theme (light, dark, UFH, minimal, image) from Settings.", actions: [{ label: "Open Settings", route: "/settings" }] };
  }
  return {
    role: "assistant",
    content: "I can help you find opportunities, check eligibility, understand documents, navigate the platform, or open UFH services like ITS, Blackboard and the library. What would you like to do?",
    actions: [
      { label: "View Opportunities", route: "/dashboard" },
      { label: "UFH Website", url: "https://www.ufh.ac.za" },
    ],
  };
}

function parseActions(text: string): { content: string; actions?: ChatAction[] } {
  const m = text.match(/ACTIONS:\s*(\[.*\])\s*$/s);
  if (!m) return { content: text };
  try {
    const actions = JSON.parse(m[1]) as ChatAction[];
    return { content: text.slice(0, m.index).trim(), actions: Array.isArray(actions) ? actions.slice(0, 3) : undefined };
  } catch { return { content: text }; }
}

export const ChatBubble = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "assistant", content: "Hi! I'm the UFH Opportunity Assistant. Ask about opportunities, eligibility, documents, or UFH services like ITS and Blackboard." },
  ]);
  const { user, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-assist", {
        body: {
          action: "chat",
          payload: {
            messages: next.map((m) => ({ role: m.role, content: m.content })),
            role: isAdmin ? "admin" : user ? "student" : "guest",
            page: location.pathname,
          },
        },
      });
      if (error) throw error;
      const raw = (data as any)?.text as string | null;
      if (raw) {
        const parsed = parseActions(raw);
        setMessages((m) => [...m, { role: "assistant", content: parsed.content, actions: parsed.actions }]);
      } else {
        setMessages((m) => [...m, ruleBasedReply(text, isAdmin)]);
      }
    } catch (e) {
      console.error("chat error", e);
      setMessages((m) => [...m, ruleBasedReply(text, isAdmin)]);
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
        <button onClick={() => setOpen(false)} aria-label="Close">
          <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
        </button>
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
