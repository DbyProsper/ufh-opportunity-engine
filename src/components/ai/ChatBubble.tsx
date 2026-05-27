import { useState } from "react";
import { MessageCircle, X, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * Floating placeholder for a future UFH-wide assistant chatbot.
 * UI only — no backend logic. Visible across the app via App.tsx.
 */
export const ChatBubble = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      {!open && (
        <button
          aria-label="Open UFH Assistant"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition flex items-center justify-center"
        >
          <MessageCircle className="w-5 h-5" />
        </button>
      )}
      {open && (
        <Card className="fixed bottom-4 right-4 z-40 w-[300px] shadow-xl border-accent/30">
          <div className="p-3 border-b flex items-center justify-between bg-accent/5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-accent/15 text-accent flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-sm font-semibold">UFH Assistant</p>
                <p className="text-[10px] text-muted-foreground">Coming soon</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close">
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
          <div className="p-4 text-sm text-muted-foreground">
            An AI Assistant for general UFH queries (applications, opportunities, deadlines) will be available soon.
            <div className="mt-3 p-2 rounded-md bg-muted/40 text-xs">
              In the meantime, try the in-form <span className="font-semibold">AI Assistant</span> while filling out an application,
              or click <span className="font-semibold">"Why?"</span> on any opportunity to get an eligibility explanation.
            </div>
          </div>
        </Card>
      )}
    </>
  );
};

export default ChatBubble;
