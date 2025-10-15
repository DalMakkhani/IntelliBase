import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, FileText, User, ChevronLeft, ChevronRight, MessageSquare, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { chatAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";

interface ChatSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onSessionSelect?: (sessionId: string) => void;
  currentSessionId?: string | null;
}

interface ChatSession {
  session_id: string;
  title: string;
  created_at: string;
  message_count: number;
}

const ChatSidebar = ({ isOpen, onToggle, onSessionSelect, currentSessionId }: ChatSidebarProps) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(false);

  // Load chat sessions
  useEffect(() => {
    if (isOpen && user) {
      loadSessions();
    }
  }, [isOpen, user]);

  // Reload sessions when current session changes (new chat created)
  useEffect(() => {
    if (currentSessionId && user) {
      loadSessions();
    }
  }, [currentSessionId]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const response = await chatAPI.getSessions();
      setSessions(response.sessions || []);
    } catch (error) {
      console.error("Failed to load sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent session selection
    
    try {
      await chatAPI.deleteSession(sessionId);
      toast({
        title: "✓ Deleted",
        description: "Conversation deleted successfully",
        className: "border-terminal-green",
      });
      
      // Reload sessions and clear if it was the current one
      await loadSessions();
      if (currentSessionId === sessionId && onSessionSelect) {
        onSessionSelect("");
      }
    } catch (error) {
      console.error("Failed to delete session:", error);
      toast({
        title: "✗ Delete failed",
        description: "Could not delete conversation",
        variant: "destructive",
        className: "border-terminal-red",
      });
    }
  };

  const handleNewChat = () => {
    if (onSessionSelect) {
      onSessionSelect("");
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
      toast({
        title: "✓ Logged out",
        description: "See you next time!",
        className: "border-terminal-green",
      });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Group sessions by date
  const groupSessionsByDate = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const grouped = {
      today: [] as ChatSession[],
      yesterday: [] as ChatSession[],
      lastWeek: [] as ChatSession[],
      older: [] as ChatSession[],
    };

    sessions.forEach((session) => {
      const sessionDate = new Date(session.created_at);
      const sessionDay = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());

      if (sessionDay.getTime() === today.getTime()) {
        grouped.today.push(session);
      } else if (sessionDay.getTime() === yesterday.getTime()) {
        grouped.yesterday.push(session);
      } else if (sessionDay >= lastWeek) {
        grouped.lastWeek.push(session);
      } else {
        grouped.older.push(session);
      }
    });

    return grouped;
  };

  const groupedSessions = groupSessionsByDate();

  return (
    <div
      className={`${
        isOpen ? "w-64" : "w-0"
      } transition-all duration-300 glass-card border-r terminal-border flex flex-col h-full overflow-hidden`}
    >
      {isOpen && (
        <>
          {/* Header - Static */}
          <div className="p-4 border-b terminal-border shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">
                <span className="text-foreground">Intelli</span>
                <span className="text-primary">Base</span>
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                className="terminal-border"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>

            <Button 
              onClick={handleNewChat}
              className="w-full bg-gradient-to-r from-terminal-green to-green-600 terminal-border hover:scale-105 transition-transform"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Chat
            </Button>
          </div>

          {/* Chat History - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loading ? (
              <div className="text-center text-terminal-green font-mono animate-pulse text-sm">
                [●○○] Loading...
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No conversations yet</p>
                <p className="text-xs mt-1">Start a new chat!</p>
              </div>
            ) : (
              <>
                {groupedSessions.today.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground border-b terminal-border pb-2">
                      ═══ Today
                    </div>
                    {groupedSessions.today.map((session) => (
                      <div
                        key={session.session_id}
                        className={`relative group w-full text-left p-2 glass-card terminal-border hover:border-primary/50 transition-all ${
                          currentSessionId === session.session_id ? "border-primary" : ""
                        }`}
                      >
                        <button
                          onClick={() => onSessionSelect?.(session.session_id)}
                          className="w-full text-left pr-8"
                        >
                          <span className="text-xs line-clamp-1">{session.title}</span>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {session.message_count} messages
                          </div>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity hover:text-terminal-red"
                          onClick={(e) => handleDeleteSession(session.session_id, e)}
                          title="Delete conversation"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {groupedSessions.yesterday.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground border-b terminal-border pb-2">
                      ═══ Yesterday
                    </div>
                    {groupedSessions.yesterday.map((session) => (
                      <div
                        key={session.session_id}
                        className={`relative group w-full text-left p-2 glass-card terminal-border hover:border-primary/50 transition-all ${
                          currentSessionId === session.session_id ? "border-primary" : ""
                        }`}
                      >
                        <button
                          onClick={() => onSessionSelect?.(session.session_id)}
                          className="w-full text-left pr-8"
                        >
                          <span className="text-xs line-clamp-1">{session.title}</span>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {session.message_count} messages
                          </div>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity hover:text-terminal-red"
                          onClick={(e) => handleDeleteSession(session.session_id, e)}
                          title="Delete conversation"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {groupedSessions.lastWeek.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground border-b terminal-border pb-2">
                      ═══ Last 7 Days
                    </div>
                    {groupedSessions.lastWeek.map((session) => (
                      <div
                        key={session.session_id}
                        className={`relative group w-full text-left p-2 glass-card terminal-border hover:border-primary/50 transition-all ${
                          currentSessionId === session.session_id ? "border-primary" : ""
                        }`}
                      >
                        <button
                          onClick={() => onSessionSelect?.(session.session_id)}
                          className="w-full text-left pr-8"
                        >
                          <span className="text-xs line-clamp-1">{session.title}</span>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {session.message_count} messages
                          </div>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity hover:text-terminal-red"
                          onClick={(e) => handleDeleteSession(session.session_id, e)}
                          title="Delete conversation"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {groupedSessions.older.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs text-muted-foreground border-b terminal-border pb-2">
                      ═══ Older
                    </div>
                    {groupedSessions.older.map((session) => (
                      <div
                        key={session.session_id}
                        className={`relative group w-full text-left p-2 glass-card terminal-border hover:border-primary/50 transition-all ${
                          currentSessionId === session.session_id ? "border-primary" : ""
                        }`}
                      >
                        <button
                          onClick={() => onSessionSelect?.(session.session_id)}
                          className="w-full text-left pr-8"
                        >
                          <span className="text-xs line-clamp-1">{session.title}</span>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {session.message_count} messages
                          </div>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity hover:text-terminal-red"
                          onClick={(e) => handleDeleteSession(session.session_id, e)}
                          title="Delete conversation"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Bottom Navigation - Static */}
          <div className="p-4 border-t terminal-border space-y-2 shrink-0">
            <Link to="/documents">
              <Button variant="ghost" className="w-full justify-start terminal-border">
                <FileText className="w-4 h-4 mr-2" />
                Documents
              </Button>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start terminal-border">
                  <User className="w-4 h-4 mr-2" />
                  <span className="truncate">{user?.username || "User"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="glass-card terminal-border backdrop-blur-lg">
                <DropdownMenuItem 
                  className="cursor-pointer"
                  onClick={() => navigate("/settings")}
                >
                  <span className="terminal-prompt">Account Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="cursor-pointer text-terminal-red"
                  onClick={handleLogout}
                >
                  <span className="terminal-prompt">Log Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      )}

      {!isOpen && (
        <div className="p-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="terminal-border"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default ChatSidebar;
