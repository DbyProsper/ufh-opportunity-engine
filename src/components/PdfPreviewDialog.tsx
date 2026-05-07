import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { downloadFromUrl } from "@/lib/download";

interface Props {
  open: boolean;
  onClose: () => void;
  url: string | null;
  title?: string;
  fileName?: string;
  notice?: string | null;
}

/** In-app PDF viewer that bypasses Chrome's signed-URL/popup blocking by
 *  rendering the PDF inline and providing an explicit blob-based Download. */
export const PdfPreviewDialog = ({ open, onClose, url, title = "Preview", fileName = "document.pdf", notice }: Props) => (
  <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
    <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-4">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      {notice && (
        <div className="text-xs p-2 rounded border border-warning/40 bg-warning/5 text-foreground whitespace-pre-wrap">
          {notice}
        </div>
      )}
      <div className="flex-1 min-h-0 border rounded-md overflow-hidden bg-muted">
        {url ? (
          <iframe src={`${url}#toolbar=1`} title={title} className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Close</Button>
        <Button
          className="btn-gradient-primary text-primary-foreground"
          disabled={!url}
          onClick={() => url && downloadFromUrl(url, fileName)}
        >
          <Download className="w-3.5 h-3.5 mr-1" /> Download
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default PdfPreviewDialog;