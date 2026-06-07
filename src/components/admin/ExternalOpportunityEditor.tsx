import { useState } from "react";
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ExternalOpportunity {
  id: string;
  title: string;
  description: string | null;
  external_link: string | null;
  image_url: string | null;
  organization: string | null;
}

interface ExternalOpportunityEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity: ExternalOpportunity | null;
  onSave: (updated: ExternalOpportunity) => void;
}

export const ExternalOpportunityEditor = ({
  open,
  onOpenChange,
  opportunity,
  onSave,
}: ExternalOpportunityEditorProps) => {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState(opportunity?.title || "");
  const [description, setDescription] = useState(opportunity?.description || "");
  const [externalLink, setExternalLink] = useState(opportunity?.external_link || "");
  const [imageUrl, setImageUrl] = useState(opportunity?.image_url || "");
  const [organization, setOrganization] = useState(opportunity?.organization || "");

  // Reset form when opportunity changes
  React.useEffect(() => {
    if (opportunity) {
      setTitle(opportunity.title);
      setDescription(opportunity.description || "");
      setExternalLink(opportunity.external_link || "");
      setImageUrl(opportunity.image_url || "");
      setOrganization(opportunity.organization || "");
    }
  }, [opportunity, open]);

  const handleSave = async () => {
    if (!opportunity) return;
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!externalLink.trim()) {
      toast.error("External link is required");
      return;
    }

    // Validate URL
    try {
      new URL(externalLink);
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from("external_opportunities")
      .update({
        title: title.trim(),
        description: description.trim() || null,
        external_link: externalLink.trim(),
        image_url: imageUrl.trim() || null,
        organization: organization.trim() || null,
      })
      .eq("id", opportunity.id);

    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Saved successfully");
    onSave({
      ...opportunity,
      title: title.trim(),
      description: description.trim() || null,
      external_link: externalLink.trim(),
      image_url: imageUrl.trim() || null,
      organization: organization.trim() || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit external opportunity</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="title" className="text-sm">
              Title *
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Opportunity title"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="organization" className="text-sm">
              Organization
            </Label>
            <Input
              id="organization"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              placeholder="e.g., Microsoft, Google"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="description" className="text-sm">
              Description
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the opportunity"
              rows={4}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="externalLink" className="text-sm">
              External link *
            </Label>
            <Input
              id="externalLink"
              type="url"
              value={externalLink}
              onChange={(e) => setExternalLink(e.target.value)}
              placeholder="https://example.com/opportunity"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="imageUrl" className="text-sm">
              Image URL
            </Label>
            <Input
              id="imageUrl"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="mt-1"
            />
            {imageUrl && (
              <div className="mt-2 w-full h-24 bg-muted rounded overflow-hidden">
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading} className="gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
