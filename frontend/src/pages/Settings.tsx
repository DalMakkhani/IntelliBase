import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Settings as SettingsIcon, LogOut, Key } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { authAPI } from "@/lib/api";
import { useState } from "react";

const Settings = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged out successfully",
        description: "See you next time!",
      });
      navigate("/login");
    } catch (error) {
      toast({
        title: "Logout failed",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast({
        title: "✗ Missing fields",
        description: "Please fill in all password fields",
        variant: "destructive",
        className: "border-terminal-red",
      });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: "✗ Passwords don't match",
        description: "New password and confirm password must match",
        variant: "destructive",
        className: "border-terminal-red",
      });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast({
        title: "✗ Password too short",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
        className: "border-terminal-red",
      });
      return;
    }

    try {
      setChangingPassword(true);
      await authAPI.changePassword({
        current_password: passwordForm.currentPassword,
        new_password: passwordForm.newPassword,
      });

      toast({
        title: "✓ Password changed",
        description: "Your password has been updated successfully",
        className: "border-terminal-green",
      });

      // Clear form
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      // Log out and redirect to login
      setTimeout(async () => {
        await logout();
        navigate("/login");
      }, 2000);

    } catch (error: any) {
      console.error("Change password error:", error);
      toast({
        title: "✗ Password change failed",
        description: error.response?.data?.detail || "Please check your current password",
        variant: "destructive",
        className: "border-terminal-red",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b terminal-border glass-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/chat">
              <Button variant="ghost" size="icon" className="terminal-border">
                <ChevronLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">
                <SettingsIcon className="inline w-6 h-6 mr-2 text-primary" />
                Account Settings
              </h1>
              <div className="text-xs text-muted-foreground mt-1">
                ══════════════════
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-8">
          {/* Profile Information */}
          <div className="glass-card p-6 animate-terminal-fade-in">
            <h2 className="text-xl font-semibold mb-4 border-b terminal-border pb-3">
              <span className="terminal-prompt text-terminal-green"></span>
              Profile Information
            </h2>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={user?.username || ""}
                  disabled
                  className="terminal-border bg-glass-bg backdrop-blur-md"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={user?.email || ""}
                  disabled
                  className="terminal-border bg-glass-bg backdrop-blur-md"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="namespace">Pinecone Namespace</Label>
                <Input
                  id="namespace"
                  value={user?.pinecone_namespace || ""}
                  disabled
                  className="terminal-border bg-glass-bg backdrop-blur-md font-mono text-xs"
                />
              </div>

              <Button
                onClick={handleLogout}
                className="bg-gradient-to-r from-primary to-purple-700 terminal-border hover:scale-105 transition-transform"
              >
                <LogOut className="w-4 h-4 mr-2" />
                <span className="terminal-prompt">Logout</span>
              </Button>
            </div>
          </div>

          {/* Change Password */}
          <div className="glass-card p-6 animate-terminal-fade-in" style={{ animationDelay: "100ms" }}>
            <h2 className="text-xl font-semibold mb-4 border-b terminal-border pb-3">
              <Key className="inline w-5 h-5 mr-2 text-primary" />
              Change Password
            </h2>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  className="terminal-border bg-glass-bg backdrop-blur-md"
                  placeholder="Enter current password"
                  disabled={changingPassword}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="terminal-border bg-glass-bg backdrop-blur-md"
                  placeholder="Enter new password (min 6 characters)"
                  disabled={changingPassword}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="terminal-border bg-glass-bg backdrop-blur-md"
                  placeholder="Confirm new password"
                  disabled={changingPassword}
                />
              </div>

              <Button
                type="submit"
                disabled={changingPassword}
                className="bg-gradient-to-r from-primary to-purple-700 terminal-border hover:scale-105 transition-transform"
              >
                <Key className="w-4 h-4 mr-2" />
                {changingPassword ? "Changing Password..." : "Change Password"}
              </Button>
            </form>
          </div>

          {/* Usage Statistics */}
          <div className="glass-card p-6 animate-terminal-fade-in" style={{ animationDelay: "200ms" }}>
            <h2 className="text-xl font-semibold mb-4 border-b terminal-border pb-3">
              <span className="terminal-prompt text-terminal-green"></span>
              Usage Statistics
            </h2>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="glass-card p-4 terminal-border">
                <div className="text-sm text-muted-foreground mb-1">Member Since</div>
                <div className="text-2xl font-bold text-primary">
                  {formatDate(user?.created_at)}
                </div>
              </div>

              <div className="glass-card p-4 terminal-border">
                <div className="text-sm text-muted-foreground mb-1">Account ID</div>
                <div className="text-sm font-mono text-terminal-green truncate">
                  {user?.user_id?.slice(0, 12) || "N/A"}...
                </div>
              </div>

              <div className="glass-card p-4 terminal-border">
                <div className="text-sm text-muted-foreground mb-1">Status</div>
                <div className="text-2xl font-bold text-terminal-green">Active</div>
              </div>

              <div className="glass-card p-4 terminal-border">
                <div className="text-sm text-muted-foreground mb-1">Auth Method</div>
                <div className="text-2xl font-bold text-primary">JWT</div>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="glass-card p-6 animate-terminal-fade-in border-terminal-red" style={{ animationDelay: "300ms" }}>
            <h2 className="text-xl font-semibold mb-4 border-b terminal-border pb-3 text-terminal-red">
              <span className="terminal-prompt"></span>
              Danger Zone
            </h2>

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Once you delete your account, there is no going back. Please be certain.
              </p>
              <Button 
                variant="destructive" 
                className="terminal-border bg-terminal-red/20 hover:bg-terminal-red/30 text-terminal-red"
              >
                <span className="terminal-prompt">Delete Account</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
