import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Force-download a file from a Supabase storage bucket as a blob, bypassing
 *  Chrome's "open in new tab"/popup blocking that breaks signed URLs. */
export const downloadFromBucket = async (bucket: string, path: string, suggestedName?: string) => {
  try {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) throw error ?? new Error("Download failed");
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = suggestedName || path.split("/").pop() || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch (e: any) {
    toast.error(e?.message ?? "Download failed");
  }
};

/** Force-download a remote URL (e.g. signed URL returned by an edge function) as a blob. */
export const downloadFromUrl = async (url: string, suggestedName: string) => {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 1500);
  } catch (e: any) {
    toast.error(e?.message ?? "Download failed");
  }
};

/** Get a signed URL for inline preview in an <iframe>. */
export const previewSignedUrl = async (bucket: string, path: string, expiresIn = 60 * 5) => {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error || !data) {
    toast.error("Could not open file");
    return null;
  }
  return data.signedUrl;
};