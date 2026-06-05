import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Shows a celebratory (approved) or empathetic (rejected) dialog once per application.
 * Tracks "seen" in localStorage so it never re-appears.
 */
export const ApprovalCelebration = ({
  applicationId,
  workflowName,
  status,
}: { applicationId: string; workflowName: string; status: "approved" | "rejected" }) => {
  const key = `app-celebration-${applicationId}-${status}`;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.localStorage.getItem(key)) {
      setOpen(true);
    }
  }, [key]);

  const dismiss = () => {
    window.localStorage.setItem(key, "1");
    setOpen(false);
  };

  const isApproved = status === "approved";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent className="max-w-sm text-center">
        <div className="py-4 space-y-4 relative overflow-hidden">
          {isApproved && (
            <div className="pointer-events-none absolute inset-0 -z-10">
              {Array.from({ length: 24 }).map((_, i) => (
                <span
                  key={i}
                  className="absolute w-2 h-2 rounded-sm animate-fade-in"
                  style={{
                    left: `${(i * 37) % 100}%`,
                    top: `${(i * 53) % 100}%`,
                    backgroundColor: ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--success))"][i % 3],
                    opacity: 0.4 + (i % 5) * 0.1,
                    transform: `rotate(${(i * 23) % 360}deg)`,
                    animationDelay: `${i * 80}ms`,
                  }}
                />
              ))}
            </div>
          )}
          <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${isApproved ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
            {isApproved ? <CheckCircle2 className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
          </div>
          <h2 className="text-xl font-bold">
            {isApproved ? "Congratulations!" : "Decision received"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isApproved ? (
              <>Your <strong>{workflowName}</strong> application has been <span className="text-success font-semibold">approved</span>. Watch for next steps from the reviewer.</>
            ) : (
              <>Your <strong>{workflowName}</strong> application was not selected this time. Keep going — your profile keeps you eligible for future opportunities.</>
            )}
          </p>
          <div className="flex gap-2 justify-center pt-2">
            <Button variant="outline" onClick={dismiss}>Dismiss</Button>
            <Link to="/dashboard" onClick={dismiss}>
              <Button className="btn-gradient-primary text-primary-foreground">
                <Sparkles className="w-3.5 h-3.5 mr-1" /> Go to dashboard
              </Button>
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ApprovalCelebration;