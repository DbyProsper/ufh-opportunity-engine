import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

/** Renders a Back button that pops history (or falls back to `to`). */
export const BackButton = ({ to = "/dashboard", label = "Back" }: { to?: string; label?: string }) => {
  const navigate = useNavigate();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1 -ml-2 text-muted-foreground hover:text-foreground"
      onClick={() => {
        if (window.history.length > 1) navigate(-1);
        else navigate(to);
      }}
    >
      <ChevronLeft className="w-4 h-4" /> {label}
    </Button>
  );
};

export default BackButton;