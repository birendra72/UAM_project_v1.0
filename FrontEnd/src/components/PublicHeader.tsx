import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Moon, Sun, BarChart3 } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export function PublicHeader() {
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center space-x-2 group">
          <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center group-hover:shadow-glow transition-all">
            <BarChart3 className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            UAM
          </span>
        </Link>

        <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
          <Link to="/solutions" className="transition-colors hover:text-primary">
            Solutions
          </Link>
          <Link to="/pricing" className="transition-colors hover:text-primary">
            Pricing
          </Link>
          <Link to="/templates" className="transition-colors hover:text-primary">
            Templates
          </Link>
          <Link to="/demo" className="transition-colors hover:text-primary">
            Demo
          </Link>
          <Link to="/about" className="transition-colors hover:text-primary">
            About
          </Link>
          <Link to="/contact" className="transition-colors hover:text-primary">
            Contact
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>
          <Link to="/login">
            <Button variant="ghost">Login</Button>
          </Link>
          <Link to="/register">
            <Button>Get Started</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
