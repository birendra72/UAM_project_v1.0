import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart3, User, Mail, Lock, Sparkles, CheckCircle2, ShieldCheck, Database, Zap } from "lucide-react";
import { useState } from "react";
import { apiClient } from "@/lib/api";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      const response = await apiClient.register(name, email, password);
      localStorage.setItem("access_token", response.access_token);
      navigate("/app/dashboard");
    } catch (err: any) {
      setError(err.message || "Registration failed");
    }
  };

  const valueProps = [
    {
      icon: Zap,
      title: "Automated Data Cleaning",
      desc: "Instantly detect outliers, fill missing inputs, and align schemas with AI heuristics."
    },
    {
      icon: Sparkles,
      title: "Guided AutoML Pipelines",
      desc: "Train Random Forest, XGBoost, and Decision Trees without writing any code."
    },
    {
      icon: Database,
      title: "Data Quality Audits",
      desc: "Access granular feature distribution analysis, multicollinearity stats, and heatmaps."
    },
    {
      icon: ShieldCheck,
      title: "Enterprise REST Deployment",
      desc: "Deploy trained pipelines with one click to highly scalable prediction API endpoints."
    }
  ];

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-950 text-slate-100 font-body overflow-hidden">
      
      {/* Left Column: Form */}
      <div className="flex flex-col justify-center px-6 sm:px-16 lg:px-24 py-12 bg-slate-950 border-r border-slate-900/40 relative z-10">
        <div className="absolute top-0 left-0 h-96 w-96 bg-radial-gradient from-violet-500/5 to-transparent pointer-events-none rounded-full blur-3xl" />
        
        <div className="mx-auto w-full max-w-md space-y-6">
          <div className="space-y-2">
            <Link to="/" className="inline-flex items-center gap-2 group">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-glow group-hover:scale-105 transition-transform duration-300">
                <BarChart3 className="h-5 w-5" />
              </div>
              <span className="font-display font-extrabold text-xl tracking-tight bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
                UAM
              </span>
            </Link>
            <h1 className="text-3xl font-extrabold tracking-tight font-display bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
              Create Your Account
            </h1>
            <p className="text-xs text-slate-400">
              Start generating automated insights and predictive models in minutes.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            
            <div className="space-y-1">
              <Label htmlFor="name" className="text-[10.5px] text-slate-400 font-semibold uppercase tracking-wider">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <Input
                  id="name"
                  type="text"
                  required
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-10 bg-slate-900 border-slate-800 text-slate-200 placeholder-slate-500 focus:border-violet-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="email" className="text-[10.5px] text-slate-400 font-semibold uppercase tracking-wider">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="john@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-slate-900 border-slate-800 text-slate-200 placeholder-slate-500 focus:border-violet-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="password" className="text-[10.5px] text-slate-400 font-semibold uppercase tracking-wider">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-slate-900 border-slate-800 text-slate-200 focus:border-violet-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="confirm-password" className="text-[10.5px] text-slate-400 font-semibold uppercase tracking-wider">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <Input
                  id="confirm-password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10 bg-slate-900 border-slate-800 text-slate-200 focus:border-violet-500"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-rose-500 font-mono bg-rose-500/5 border border-rose-500/10 p-2.5 rounded-lg">
                ⚠ {error}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold shadow-glow border border-violet-500/30 pt-1">
              Create Account
            </Button>
          </form>

          <p className="text-center text-xs text-slate-400">
            Already have an account?{" "}
            <Link to="/login" className="text-violet-400 hover:text-violet-300 font-bold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right Column: Premium Value Props */}
      <div className="hidden lg:flex flex-col justify-between p-16 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
        <div className="absolute top-0 right-0 h-[600px] w-[600px] bg-radial-gradient from-violet-500/10 to-transparent pointer-events-none rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 bg-radial-gradient from-cyan-500/5 to-transparent pointer-events-none rounded-full blur-3xl" />
        
        {/* Top Header */}
        <div className="flex items-center gap-1.5 self-start px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-300 border border-violet-500/20">
          <Sparkles className="h-3.5 w-3.5 animate-pulse" />
          Analytics Hub v2.0
        </div>

        {/* Center: List of Value Props */}
        <div className="space-y-6 my-auto max-w-lg">
          <h2 className="text-2xl font-extrabold font-display bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
            Build Powerful Machine Learning Workflows Instantly
          </h2>
          
          <div className="space-y-4">
            {valueProps.map((prop, index) => (
              <div key={index} className="flex gap-4 p-4 rounded-xl border border-slate-900/50 bg-slate-950/20 hover:border-violet-500/20 hover:bg-slate-900/30 transition-all duration-300">
                <div className="h-9 w-9 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center flex-shrink-0">
                  <prop.icon className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-200">{prop.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed font-body">{prop.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom footer context */}
        <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-900 pt-4">
          <span>Secure AES-256 JWT Authentication</span>
          <span>© UAM Analytics</span>
        </div>
      </div>

    </div>
  );
}
