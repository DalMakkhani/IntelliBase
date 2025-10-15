import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(username, password);
      navigate("/chat");
    } catch (error) {
      console.error("Login error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-block">
            <h1 className="text-3xl font-bold">
              <span className="text-foreground">Intelli</span>
              <span className="text-primary">Base</span>
            </h1>
          </Link>
        </div>

        {/* Login Form */}
        <div className="glass-card p-8 animate-terminal-fade-in">
          <div className="mb-6 border-b terminal-border pb-4">
            <h2 className="text-2xl font-semibold">
              <span className="terminal-prompt text-terminal-green"></span>
              Log In
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="> username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="terminal-border bg-glass-bg backdrop-blur-md focus:border-primary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="> ••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="terminal-border bg-glass-bg backdrop-blur-md focus:border-primary"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-purple-700 terminal-border hover:scale-105 transition-all"
              disabled={loading}
            >
              {loading ? (
                <span>Processing...</span>
              ) : (
                <span className="terminal-prompt">Log In</span>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-muted-foreground">New here? </span>
            <Link to="/signup" className="text-primary hover:text-primary/80 transition-colors">
              <span className="terminal-prompt">Create Account</span>
            </Link>
          </div>
        </div>

        {/* Terminal Decorator */}
        <div className="mt-8 text-center text-muted-foreground text-xs">
          ═══════════════════════════════════
        </div>
      </div>
    </div>
  );
};

export default Login;
