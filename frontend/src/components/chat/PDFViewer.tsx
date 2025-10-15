import { useState } from "react";
import { X, ZoomIn, ZoomOut, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PDFViewerProps {
  pdfUrl: string;
  filename: string;
  page?: number;
  onClose: () => void;
}

const PDFViewer = ({ pdfUrl, filename, page = 1, onClose }: PDFViewerProps) => {
  const [zoom, setZoom] = useState(100);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = filename;
    link.click();
  };

  const handleOpenNewTab = () => {
    window.open(pdfUrl, "_blank");
  };

  // Construct PDF URL with page parameter
  const pdfUrlWithPage = page > 1 ? `${pdfUrl}#page=${page}` : pdfUrl;

  return (
    <div className="h-full flex flex-col glass-card border-l terminal-border">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b terminal-border shrink-0 bg-glass-bg backdrop-blur-md">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs text-terminal-green">📄</span>
          <span className="text-sm font-mono truncate" title={filename}>
            {filename}
          </span>
          {page > 1 && (
            <span className="text-xs text-muted-foreground">
              · Page {page}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            className="w-7 h-7"
            title="Zoom out"
          >
            <ZoomOut className="w-3 h-3" />
          </Button>

          <span className="text-xs text-muted-foreground px-2 min-w-[3rem] text-center">
            {zoom}%
          </span>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            className="w-7 h-7"
            title="Zoom in"
          >
            <ZoomIn className="w-3 h-3" />
          </Button>

          <div className="w-px h-5 bg-border mx-1" />

          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            className="w-7 h-7"
            title="Download"
          >
            <Download className="w-3 h-3" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleOpenNewTab}
            className="w-7 h-7"
            title="Open in new tab"
          >
            <ExternalLink className="w-3 h-3" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="w-7 h-7"
            title="Close"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* PDF Iframe */}
      <div className="flex-1 overflow-hidden bg-gray-900">
        <iframe
          src={pdfUrlWithPage}
          className="w-full h-full border-0"
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: "top left",
            width: `${10000 / zoom}%`,
            height: `${10000 / zoom}%`,
          }}
          title={filename}
        />
      </div>

      {/* Footer */}
      <div className="p-2 border-t terminal-border shrink-0 bg-glass-bg backdrop-blur-md">
        <div className="text-xs text-muted-foreground text-center font-mono">
          Use browser PDF controls or toolbar above to navigate
        </div>
      </div>
    </div>
  );
};

export default PDFViewer;
