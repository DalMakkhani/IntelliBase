import { GraduationCap, FlaskConical, MessageCircle } from "lucide-react";

interface SessionModeSelectorProps {
  currentMode: "study" | "research" | "casual";
  onModeChange: (mode: "study" | "research" | "casual") => void;
}

const SessionModeSelector = ({ currentMode, onModeChange }: SessionModeSelectorProps) => {
  const modes = [
    {
      id: "casual" as const,
      icon: MessageCircle,
      title: "Casual",
      description: "Quick, conversational answers",
      color: "text-blue-400",
      hoverColor: "hover:border-blue-400",
      activeColor: "border-blue-400",
    },
    {
      id: "study" as const,
      icon: GraduationCap,
      title: "Study",
      description: "Detailed explanations with examples",
      color: "text-green-400",
      hoverColor: "hover:border-green-400",
      activeColor: "border-green-400",
    },
    {
      id: "research" as const,
      icon: FlaskConical,
      title: "Research",
      description: "In-depth analysis and synthesis",
      color: "text-purple-400",
      hoverColor: "hover:border-purple-400",
      activeColor: "border-purple-400",
    },
  ];

  return (
    <div className="flex items-center gap-3 p-4 glass-card terminal-border mb-4">
      <span className="text-sm text-muted-foreground">Mode:</span>
      <div className="flex gap-2">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isActive = currentMode === mode.id;
          
          return (
            <button
              key={mode.id}
              onClick={() => onModeChange(mode.id)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg
                glass-card terminal-border transition-all
                ${isActive ? mode.activeColor + ' shadow-lg' : mode.hoverColor}
                ${isActive ? 'opacity-100' : 'opacity-60 hover:opacity-100'}
              `}
              title={mode.description}
            >
              <Icon className={`w-4 h-4 ${mode.color}`} />
              <span className="text-sm font-medium">{mode.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SessionModeSelector;
