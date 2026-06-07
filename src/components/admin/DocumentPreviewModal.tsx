import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Document, Page } from "react-pdf";
import { pdfjs } from "react-pdf";

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface DocumentPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileUrl: string;
  fileName: string;
  onDownload?: () => void;
}

export const DocumentPreviewModal = ({
  open,
  onOpenChange,
  fileUrl,
  fileName,
  onDownload,
}: DocumentPreviewModalProps) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);

  useEffect(() => {
    // Determine file type
    const ext = fileName.toLowerCase().split(".").pop();
    setIsPdf(ext === "pdf");
    setError(null);
    setLoading(true);
  }, [fileName]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const onDocumentLoadError = () => {
    setError("Could not load document. It may be corrupted or in an unsupported format.");
    setLoading(false);
  };

  const handlePrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages || prev));
  };

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else {
      // Fallback: try to download directly
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="truncate">{fileName}</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>

        {/* Document Viewer */}
        <div className="flex-1 overflow-auto bg-muted/30 rounded-lg flex items-center justify-center p-4">
          {loading && (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading document...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-sm text-destructive font-medium">Could not preview</p>
              <p className="text-xs text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={handleDownload} className="mt-2">
                <Download className="w-3.5 h-3.5 mr-1" /> Download Instead
              </Button>
            </div>
          )}

          {!error && isPdf && (
            <div className="w-full h-full flex flex-col items-center">
              <Document
                file={fileUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={<Loader2 className="w-8 h-8 animate-spin" />}
              >
                <div className="flex justify-center overflow-auto flex-1 w-full">
                  <Page
                    pageNumber={pageNumber}
                    scale={1.5}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                  />
                </div>
              </Document>
            </div>
          )}

          {!error && !isPdf && !loading && (
            <div className="flex flex-col items-center gap-4 w-full h-full">
              {fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <img
                  src={fileUrl}
                  alt={fileName}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-center">
                  <p className="text-sm text-muted-foreground">Preview not available for this file type</p>
                  <p className="text-xs text-muted-foreground">({fileName.split(".").pop()?.toUpperCase()})</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t">
          {isPdf && numPages && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={pageNumber <= 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-fit">
                Page {pageNumber} of {numPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={pageNumber >= numPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={handleDownload} className="gap-2">
              <Download className="w-4 h-4" /> Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
