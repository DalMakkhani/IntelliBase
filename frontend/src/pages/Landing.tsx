import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, Search, BookOpen } from "lucide-react";

const Landing = () => {
  const [displayText, setDisplayText] = useState("");
  const fullText = "IntelliBase_";
  
  useEffect(() => {
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex <= fullText.length) {
        setDisplayText(fullText.slice(0, currentIndex));
        currentIndex++;
      } else {
        clearInterval(interval);
      }
    }, 150);
    
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: FileText,
      title: "Upload PDFs & Query",
      description: "Multi-document RAG with intelligent semantic search",
    },
    {
      icon: Search,
      title: "RAG Search with Memory",
      description: "Context-aware conversations that remember your queries",
    },
    {
      icon: BookOpen,
      title: "Precise Citations",
      description: "Track sources to exact pages and line numbers",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 backdrop-blur-md bg-background/80 border-b terminal-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="text-xl font-bold">
            <span className="text-foreground">Intelli</span>
            <span className="text-primary">Base</span>
          </div>
          <div className="flex gap-4">
            <Link to="/login">
              <Button variant="ghost" className="terminal-border">
                <span className="terminal-prompt">Log In</span>
              </Button>
            </Link>
            <Link to="/signup">
              <Button className="bg-gradient-to-r from-primary to-purple-700 terminal-border hover:scale-105 transition-transform">
                <span className="terminal-prompt">Sign Up</span>
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto text-center">
          <div className="glass-card max-w-2xl mx-auto p-12 animate-terminal-fade-in">
            <div className="text-5xl md:text-6xl font-bold mb-6 min-h-[80px] flex items-center justify-center">
              <span className="terminal-prompt text-terminal-green"></span>
              <span className="text-foreground">{displayText.replace("_", "")}</span>
              <span className={displayText.endsWith("_") ? "animate-blink" : ""}>
                {displayText.endsWith("_") ? "_" : ""}
              </span>
            </div>
            
            <h2 className="text-2xl md:text-3xl mb-4 text-muted-foreground">
              Your AI-Powered
            </h2>
            <h2 className="text-2xl md:text-3xl mb-8 text-muted-foreground">
              Knowledge Assistant
            </h2>
            
            <Link to="/signup">
              <Button 
                size="lg"
                className="bg-gradient-to-r from-primary to-purple-700 terminal-border hover:scale-105 transition-all hover:shadow-lg hover:shadow-primary/50 text-lg px-8"
              >
                <span className="terminal-prompt">Get Started</span>
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="glass-card p-8 hover:scale-105 transition-all hover:border-primary/50"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start gap-4">
                  <span className="text-terminal-green text-2xl terminal-prompt"></span>
                  <div className="flex-1">
                    <div className="mb-4 text-primary">
                      <feature.icon className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Terminal Decorators */}
      <div className="fixed bottom-0 left-0 right-0 p-4 text-center text-muted-foreground text-sm pointer-events-none">
        <div className="terminal-border inline-block px-6 py-2 glass-card">
          ═══════════════════════════════════════
        </div>
      </div>
    </div>
  );
};

export default Landing;
