import { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  textarea?: boolean;
  className?: string;
  placeholder?: string;
  children?: ReactNode; // optional custom control (e.g. <Select/>)
}

export const Field = ({ id, label, value, onChange, type = "text", textarea, className, placeholder, children }: FieldProps) => (
  <div className={`space-y-1.5 ${className ?? ""}`}>
    <Label htmlFor={id} className="text-xs">{label}</Label>
    {children ? (
      children
    ) : textarea ? (
      <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} rows={2} placeholder={placeholder} />
    ) : (
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    )}
  </div>
);

export default Field;