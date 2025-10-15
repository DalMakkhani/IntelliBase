import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="glass-card p-12 text-center max-w-md animate-terminal-fade-in">
        <div className="mb-6">
          <h1 className="text-6xl font-bold text-terminal-red mb-2">404</h1>
          <div className="text-xs text-muted-foreground">
            ════════════════════
          </div>
        </div>
        
        <p className="mb-2 text-xl font-semibold">
          <span className="terminal-prompt text-terminal-red">[ERROR]:</span>
          Page Not Found
        </p>
        <p className="mb-8 text-sm text-muted-foreground">
          The requested route does not exist in the system
        </p>
        
        <Link to="/">
          <Button className="bg-gradient-to-r from-primary to-purple-700 terminal-border hover:scale-105 transition-transform">
            <Home className="w-4 h-4 mr-2" />
            <span className="terminal-prompt">Return to Home</span>
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
