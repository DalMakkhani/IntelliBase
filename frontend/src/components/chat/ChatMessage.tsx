import { User, Bot } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import FlashcardViewer from './FlashcardViewer';

interface Citation {
  file: string;
  page: number;
  lines: string;
}

interface Message {
  id: number;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  citations?: Citation[];
}

interface ChatMessageProps {
  message: Message;
  onOpenPDF?: (url: string, filename: string, page: number) => void;
  sessionId?: string | null;
}

const ChatMessage = ({ message, onOpenPDF, sessionId }: ChatMessageProps) => {
  const isUser = message.type === "user";

  // Check if message contains flashcards
  const hasFlashcards = message.content.includes('FLASHCARD_START') && 
                        message.content.includes('FLASHCARD_END');

  // Remove flashcard markers from displayed content
  const displayContent = message.content.replace(/FLASHCARD_START[\s\S]*?FLASHCARD_END/g, '').trim();

  const handleCitationClick = async (citation: Citation) => {
    try {
      console.log("📄 Opening citation:", citation);
      
      // Get auth token - using 'access_token' to match AuthContext
      const token = localStorage.getItem("access_token");
      if (!token) {
        console.error("No auth token found in localStorage");
        alert("Please log in to view documents");
        return;
      }
      
      console.log("✅ Token found, length:", token.length);
      
      // Create a URL to view the document
      const url = `${API_BASE_URL}/documents/view/${encodeURIComponent(citation.file)}`;
      console.log("📡 Fetching from URL:", url);
      console.log("🔑 Using Authorization header with Bearer token");
      
      // Fetch the PDF with auth token
      const response = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      
      console.log("📥 Response status:", response.status, response.statusText);
      
      if (!response.ok) {
        let errorMessage = `Server returned ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
          console.error("❌ Error details:", errorData);
        } catch {
          const errorText = await response.text();
          console.error("❌ Error text:", errorText);
          errorMessage = errorText || errorMessage;
        }
        
        alert(`Failed to open document: ${errorMessage}`);
        return;
      }
      
      // Convert to blob and create URL
      const blob = await response.blob();
      console.log("✅ Blob received, size:", blob.size, "type:", blob.type);
      
      if (blob.size === 0) {
        console.error("❌ Received empty blob");
        alert("Document is empty or failed to download");
        return;
      }
      
      const blobUrl = window.URL.createObjectURL(blob);
      console.log("🔗 Blob URL created:", blobUrl);
      
      // Use the new split-view PDF viewer if callback provided
      if (onOpenPDF) {
        console.log("✅ Opening PDF in split view, page:", citation.page || 1);
        onOpenPDF(blobUrl, citation.file, citation.page || 1);
      } else {
        // Fallback to opening in new tab
        console.log("⚠️ onOpenPDF not provided, opening in new tab");
        const newWindow = window.open(blobUrl, "_blank");
        
        if (!newWindow) {
          console.warn("⚠️ Popup blocked");
          alert("Please allow popups to view documents");
        } else {
          console.log("✅ Document opened successfully in new window");
        }
        
        // Clean up blob URL after a delay
        setTimeout(() => {
          window.URL.revokeObjectURL(blobUrl);
          console.log("🧹 Blob URL cleaned up");
        }, 5000);
      }
      
    } catch (error) {
      console.error("❌ Error opening document:", error);
      alert(`Failed to open document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div
      className={`flex gap-4 animate-terminal-fade-in ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 terminal-border">
          <Bot className="w-4 h-4 text-primary" />
        </div>
      )}

      <div
        className={`max-w-2xl glass-card p-4 ${
          isUser
            ? "bg-glass-bg terminal-border"
            : "bg-glass-bg border border-primary/30"
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold">
            {isUser ? "You" : "IntelliBase"}
          </span>
          <span className="text-xs text-muted-foreground">
            {message.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        <div className="text-sm leading-relaxed prose prose-invert prose-sm max-w-none">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={{
              // Custom styling for markdown elements
              h1: ({node, ...props}) => <h1 className="text-xl font-bold mt-4 mb-2 text-terminal-green" {...props} />,
              h2: ({node, ...props}) => <h2 className="text-lg font-bold mt-3 mb-2 text-terminal-green" {...props} />,
              h3: ({node, ...props}) => <h3 className="text-base font-bold mt-2 mb-1 text-terminal-green" {...props} />,
              ul: ({node, ...props}) => (
                <ul className="list-disc list-outside my-3 space-y-2 ml-6" style={{display: 'block'}} {...props} />
              ),
              ol: ({node, ...props}) => (
                <ol className="list-decimal list-outside my-3 space-y-2 ml-6" style={{display: 'block'}} {...props} />
              ),
              li: ({node, children, ...props}) => (
                <li 
                  className="pl-2 leading-relaxed" 
                  style={{
                    display: 'list-item',
                    wordWrap: 'break-word',
                    whiteSpace: 'normal',
                    maxWidth: '100%',
                    overflowWrap: 'break-word'
                  }}
                  {...props}
                >
                  {children}
                </li>
              ),
              p: ({node, children, ...props}) => {
                // Style paragraphs that start with "Source:" as citations (grey + italic)
                const childrenArray = Array.isArray(children) ? children : [children];
                const firstChild = childrenArray[0];
                const isSource = typeof firstChild === 'string' && firstChild.trim().startsWith('Source:');
                
                if (isSource && typeof firstChild === 'string') {
                  // Parse "Source: [Document.pdf, p.5]" into clickable link
                  const sourceText = firstChild.trim();
                  const match = sourceText.match(/Source:\s*\[([^\]]+\.pdf),\s*p\.(\d+)\]/i);
                  
                  if (match) {
                    const filename = match[1];
                    const pageNum = parseInt(match[2], 10);
                    
                    return (
                      <p className="my-2 text-gray-400 italic text-xs mt-1" {...props}>
                        <button
                          onClick={() => handleCitationClick({ file: filename, page: pageNum, lines: '' })}
                          className="hover:text-terminal-green hover:underline transition-colors cursor-pointer"
                        >
                          Source: [{filename}, p.{pageNum}]
                        </button>
                      </p>
                    );
                  }
                }
                
                return (
                  <p 
                    className={`my-2 ${isSource ? 'text-gray-400 italic text-xs mt-1' : ''}`} 
                    {...props}
                  >
                    {children}
                  </p>
                );
              },
              code: ({node, inline, ...props}: any) => 
                inline 
                  ? <code className="bg-terminal-bg/50 px-1 py-0.5 rounded text-terminal-green" {...props} />
                  : <code className="block bg-terminal-bg/50 p-3 rounded my-2 overflow-x-auto" {...props} />,
              a: ({node, ...props}) => <a className="text-terminal-green hover:underline" {...props} />,
              blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-terminal-green/30 pl-4 italic my-2" {...props} />,
              strong: ({node, ...props}) => <strong className="font-bold text-terminal-green" {...props} />,
              table: ({node, ...props}) => (
                <div className="overflow-x-auto my-4">
                  <table className="min-w-full border border-terminal-green/30 rounded" {...props} />
                </div>
              ),
              thead: ({node, ...props}) => <thead className="bg-terminal-green/10" {...props} />,
              th: ({node, ...props}) => <th className="border border-terminal-green/30 px-4 py-2 text-left text-terminal-green font-semibold" {...props} />,
              td: ({node, ...props}) => <td className="border border-terminal-green/30 px-4 py-2" {...props} />,
            }}
          >
            {displayContent}
          </ReactMarkdown>
        </div>

        {/* Display flashcards if present */}
        {hasFlashcards && sessionId && (
          <FlashcardViewer sessionId={sessionId} />
        )}

        {message.citations && message.citations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.citations.map((citation, idx) => (
              <button
                key={idx}
                onClick={() => handleCitationClick(citation)}
                className="inline-flex items-center gap-2 px-3 py-1 glass-card terminal-border text-xs text-primary hover:border-primary hover:shadow-lg hover:shadow-primary/20 transition-all cursor-pointer"
                title="Click to view document"
              >
                <span>📄</span>
                <span>
                  {citation.file}
                  {citation.page > 0 && ` · p.${citation.page}`}
                  {citation.lines && ` · ln.${citation.lines}`}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {isUser && (
        <div className="w-8 h-8 rounded-full bg-terminal-green/20 flex items-center justify-center shrink-0 terminal-border">
          <User className="w-4 h-4 text-terminal-green" />
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
