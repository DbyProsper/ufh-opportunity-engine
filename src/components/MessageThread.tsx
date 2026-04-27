import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Check, CheckCheck, Zap } from "lucide-react";
import { toast } from "sonner";
import { REVIEWER_QUICK_REPLIES } from "@/data/quickReplies";

interface Props {
  applicationId: string;
  applicantId: string;
  className?: string;
  emptyHint?: string;
}

interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export const MessageThread = ({ applicationId, applicantId, className, emptyHint }: Props) => {
  const { user } = useAuth();
  const isReviewer = !!user && user.id !== applicantId;
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load or create thread + initial messages
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const existing = await supabase
        .from("message_threads")
        .select("id")
        .eq("application_id", applicationId)
        .maybeSingle();

      let tId = existing.data?.id ?? null;
      if (!tId) {
        const created = await supabase
          .from("message_threads")
          .insert({ application_id: applicationId })
          .select("id")
          .maybeSingle();
        tId = created.data?.id ?? null;
      }
      if (!active || !tId) { setLoading(false); return; }
      setThreadId(tId);

      const msgs = await supabase
        .from("messages")
        .select("*")
        .eq("thread_id", tId)
        .order("created_at", { ascending: true });
      if (!active) return;
      setMessages((msgs.data as Message[]) ?? []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [applicationId]);

  // Realtime
  useEffect(() => {
    if (!threadId) return;
    const channel = supabase
      .channel(`thread-${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Message])
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
        (payload) => setMessages((prev) => prev.map((m) => m.id === (payload.new as Message).id ? (payload.new as Message) : m))
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [threadId]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // Mark unread incoming as read
  useEffect(() => {
    if (!user || !threadId) return;
    const unread = messages.filter((m) => m.sender_id !== user.id && !m.read_at);
    if (unread.length === 0) return;
    supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", unread.map((m) => m.id))
      .then(() => {});
  }, [messages, user, threadId]);

  const send = async () => {
    if (!text.trim() || !threadId || !user) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      thread_id: threadId,
      sender_id: user.id,
      body: text.trim(),
    });
    setSending(false);
    if (error) return toast.error(error.message);
    setText("");
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-10 ${className ?? ""}`}>
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-[440px] border rounded-lg bg-background ${className ?? ""}`}>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            {emptyHint ?? "No messages yet. Start the conversation below."}
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          const fromApplicant = m.sender_id === applicantId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                  mine
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`text-[10px] mt-1 opacity-70 flex items-center gap-1 ${mine ? "text-primary-foreground justify-end" : "text-muted-foreground"}`}>
                  <span>{fromApplicant ? "Applicant" : mine ? "You" : "Reviewer"} · {new Date(m.created_at).toLocaleString()}</span>
                  {mine && (
                    m.read_at
                      ? <span title={`Read ${new Date(m.read_at).toLocaleString()}`} className="inline-flex items-center"><CheckCheck className="w-3 h-3" /></span>
                      : <span title="Sent" className="inline-flex items-center"><Check className="w-3 h-3" /></span>
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      {isReviewer && showQuickReplies && (
        <div className="border-t px-3 pt-2 pb-1 flex flex-wrap gap-1.5 bg-muted/30">
          {REVIEWER_QUICK_REPLIES.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => { setText((prev) => prev ? prev : q.body); setShowQuickReplies(false); }}
              className="text-[11px] px-2.5 py-1 rounded-full border bg-background hover:bg-muted transition"
            >
              {q.label}
            </button>
          ))}
        </div>
      )}
      <div className="border-t p-3 flex gap-2 items-end">
        {isReviewer && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setShowQuickReplies((s) => !s)}
            title="Quick replies"
            className="shrink-0"
          >
            <Zap className="w-4 h-4" />
          </Button>
        )}
        <Textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Type a message… (Cmd/Ctrl+Enter to send)"
          className="resize-none"
        />
        <Button onClick={send} disabled={sending || !text.trim()} className="btn-gradient-primary text-primary-foreground">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
};