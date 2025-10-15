import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, Menu } from "lucide-react";
import { chatAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import ChatMessage from "./ChatMessage";
import FileUploadDialog from "./FileUploadDialog";
import SessionModeDialog from "./SessionModeDialog";

interface ChatAreaProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  sessionId: string | null;
  onSessionChange?: (sessionId: string) => void;
  onOpenPDF?: (url: string, filename: string, page: number) => void;
}

const ChatArea = ({ sidebarOpen, onToggleSidebar, sessionId, onSessionChange, onOpenPDF }: ChatAreaProps) => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [modeDialogOpen, setModeDialogOpen] = useState(false);
  const [sessionMode, setSessionMode] = useState<"study" | "research" | "casual">("casual");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Show mode selector on new chat (when there's no session and no messages)
  useEffect(() => {
    if (!sessionId && messages.length === 0) {
      setModeDialogOpen(true);
    }
  }, [sessionId, messages.length]);

  // Load messages when session changes
  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId);
    } else {
      setMessages([]);
    }
  }, [sessionId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadSession = async (sessionId: string) => {
    try {
      const response = await chatAPI.getSession(sessionId);
      const loadedMessages = response.messages?.map((msg: any, index: number) => ({
        id: index,
        type: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
        timestamp: new Date(msg.timestamp),
        citations: msg.citations || [],
      })) || [];
      setMessages(loadedMessages);
    } catch (error) {
      console.error("Failed to load session:", error);
      toast({
        title: "✗ Failed to load conversation",
        description: "Could not load chat history",
        variant: "destructive",
        className: "border-terminal-red",
      });
    }
  };

  const handleSend = async () => {
    if (!message.trim() || loading) return;

    const userMessage = {
      id: Date.now(),
      type: "user" as const,
      content: message,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setMessage("");
    setLoading(true);

    try {
      // Call the RAG API
      const response = await chatAPI.query({
        query: message,
        session_id: sessionId || undefined,
        top_k: 15,  // Increased from 10 to 15 for better context retrieval
        session_mode: sessionMode,  // Pass session mode to backend
      });

      // Update session ID if this is the first message
      if (!sessionId && response.session_id && onSessionChange) {
        onSessionChange(response.session_id);
      }

      // Format citations for display
      const formattedCitations = response.citations?.map((citation: any) => ({
        file: citation.document,
        page: citation.page || 0,
        lines: citation.line_start && citation.line_end 
          ? `${citation.line_start}-${citation.line_end}`
          : "",
        snippet: citation.text_snippet,
        score: citation.score,
      })) || [];

      // Add assistant response
      const assistantMessage = {
        id: Date.now() + 1,
        type: "assistant" as const,
        content: response.answer,
        timestamp: new Date(),
        citations: formattedCitations,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error("Chat error:", error);
      toast({
        title: "✗ Query failed",
        description: error.response?.data?.detail || "Failed to get response",
        variant: "destructive",
        className: "border-terminal-red",
      });

      // Add error message
      const errorMessage = {
        id: Date.now() + 1,
        type: "assistant" as const,
        content: "Sorry, I encountered an error processing your request. Please try again.",
        timestamp: new Date(),
        citations: [],
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Expand Sidebar Button - Shows when sidebar is closed */}
      {!sidebarOpen && (
        <div className="absolute top-4 left-4 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="terminal-border glass-card hover:scale-105 transition-transform"
            title="Open sidebar"
          >
            <Menu className="w-5 h-5" />
          </Button>
        </div>
      )}

      {/* Messages Container - This is the only scrollable part */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <h2 className="text-2xl font-bold mb-4">
                <span className="text-foreground">Intelli</span>
                <span className="text-primary">Base</span>
              </h2>
              <p className="text-sm">
                {"> Upload documents and start asking questions..."}
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} onOpenPDF={onOpenPDF} sessionId={sessionId} />
            ))}
            {loading && (
              <div className="text-terminal-green font-mono text-sm animate-pulse">
                [●○○] IntelliBase is thinking...
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area - Static at bottom */}
      <div className="border-t terminal-border p-4 glass-card shrink-0">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3 items-end">
            <Button
              variant="ghost"
              size="icon"
              className="terminal-border shrink-0"
              title="Upload documents"
              onClick={() => setUploadDialogOpen(true)}
            >
              <Paperclip className="w-5 h-5" />
            </Button>

            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="> Ask me anything..."
              className="terminal-border bg-glass-bg backdrop-blur-md focus:border-primary resize-none"
              rows={1}
              disabled={loading}
            />

            <Button
              onClick={handleSend}
              disabled={!message.trim() || loading}
              className="bg-gradient-to-r from-primary to-purple-700 terminal-border hover:scale-105 transition-transform shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* File Upload Dialog */}
      <FileUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
      />

      {/* Session Mode Dialog - Auto-shows on new chat */}
      <SessionModeDialog
        open={modeDialogOpen}
        onOpenChange={setModeDialogOpen}
        onModeSelect={setSessionMode}
      />
    </div>
  );
};

export default ChatArea;
