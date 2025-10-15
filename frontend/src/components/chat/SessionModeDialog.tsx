import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GraduationCap, FlaskConical, MessageCircle } from "lucide-react";

interface SessionModeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onModeSelect: (mode: "study" | "research" | "casual") => void;
}

const SessionModeDialog = ({ open, onOpenChange, onModeSelect }: SessionModeDialogProps) => {
  const modes = [
    {
      id: "casual" as const,
      icon: MessageCircle,
      title: "Casual Mode",
      description: "Quick, conversational answers for everyday questions",
      details: "Perfect for general queries and quick information lookup",
      color: "text-blue-400",
      borderColor: "border-blue-400/50",
      hoverColor: "hover:border-blue-400",
      bgColor: "hover:bg-blue-400/10",
    },
    {
      id: "study" as const,
      icon: GraduationCap,
      title: "Study Mode",
      description: "Detailed explanations with examples and analogies",
      details: "Great for learning new concepts and exam preparation",
      color: "text-green-400",
      borderColor: "border-green-400/50",
      hoverColor: "hover:border-green-400",
      bgColor: "hover:bg-green-400/10",
    },
    {
      id: "research" as const,
      icon: FlaskConical,
      title: "Research Mode",
      description: "In-depth analysis with multiple sources and synthesis",
      details: "Ideal for research papers and comprehensive understanding",
      color: "text-purple-400",
      borderColor: "border-purple-400/50",
      hoverColor: "hover:border-purple-400",
      bgColor: "hover:bg-purple-400/10",
    },
  ];

  const handleSelect = (mode: "study" | "research" | "casual") => {
    onModeSelect(mode);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] glass-card terminal-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-terminal-green">
            Choose Your Session Mode
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Select how you want IntelliBase to respond
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          {modes.map((mode) => {
            const Icon = mode.icon;
            
            return (
              <button
                key={mode.id}
                onClick={() => handleSelect(mode.id)}
                className={`
                  flex items-start gap-3 p-3 rounded-lg
                  glass-card terminal-border transition-all
                  ${mode.hoverColor} ${mode.bgColor}
                  hover:shadow-lg group
                `}
              >
                <div className={`p-2 rounded-lg glass-card ${mode.borderColor}`}>
                  <Icon className={`w-4 h-4 ${mode.color}`} />
                </div>
                
                <div className="flex-1 text-left">
                  <h3 className={`text-sm font-semibold mb-0.5 ${mode.color}`}>
                    {mode.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-1">
                    {mode.description}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70">
                    {mode.details}
                  </p>
                </div>

                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-sm text-terminal-green">→</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="text-xs text-muted-foreground text-center">
          You can change the mode anytime during your conversation
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SessionModeDialog;
