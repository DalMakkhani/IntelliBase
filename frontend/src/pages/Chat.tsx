import { useState } from "react";
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChatArea from "@/components/chat/ChatArea";
import PDFViewer from "@/components/chat/PDFViewer";

interface PDFViewState {
  url: string;
  filename: string;
  page: number;
}

const Chat = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [pdfView, setPdfView] = useState<PDFViewState | null>(null);

  const handleSessionSelect = (sessionId: string) => {
    setCurrentSessionId(sessionId || null);
  };

  const handleOpenPDF = (url: string, filename: string, page: number = 1) => {
    setPdfView({ url, filename, page });
  };

  const handleClosePDF = () => {
    setPdfView(null);
  };

  return (
    <div className="h-screen flex w-full bg-background overflow-hidden">
      <ChatSidebar 
        isOpen={sidebarOpen} 
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onSessionSelect={handleSessionSelect}
        currentSessionId={currentSessionId}
      />
      <ChatArea 
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        sessionId={currentSessionId}
        onSessionChange={setCurrentSessionId}
        onOpenPDF={handleOpenPDF}
      />
      {pdfView && (
        <div className="w-1/2 h-full">
          <PDFViewer
            pdfUrl={pdfView.url}
            filename={pdfView.filename}
            page={pdfView.page}
            onClose={handleClosePDF}
          />
        </div>
      )}
    </div>
  );
};

export default Chat;
