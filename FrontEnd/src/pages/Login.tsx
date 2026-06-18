import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart3, Lock, Mail, Sparkles, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    try {
      const user = await login(email, password);
      if (user.role === "Admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/app/dashboard");
      }
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || "Login failed");
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-950 text-slate-100 font-body overflow-hidden">
      
      {/* Left Column: Interactive Form */}
      <div className="flex flex-col justify-center px-6 sm:px-16 lg:px-24 py-12 bg-slate-950 border-r border-slate-900/40 relative z-10">
        <div className="absolute top-0 left-0 h-96 w-96 bg-radial-gradient from-violet-500/5 to-transparent pointer-events-none rounded-full blur-3xl" />
        
        <div className="mx-auto w-full max-w-md space-y-8">
          <div className="space-y-3">
            <Link to="/" className="inline-flex items-center gap-2 group">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white shadow-glow group-hover:scale-105 transition-transform duration-300">
                <BarChart3 className="h-5 w-5" />
              </div>
              <span className="font-display font-extrabold text-xl tracking-tight bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
                UAM
              </span>
            </Link>
            <h1 className="text-3xl font-extrabold tracking-tight font-display bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
              Welcome Back
            </h1>
            <p className="text-sm text-slate-400">
              Sign in to manage and train automated analytics pipelines.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="alex@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-slate-900 border-slate-800 text-slate-200 placeholder-slate-500 focus:border-violet-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Password</Label>
                <Link to="/forgot-password" className="text-xs text-violet-400 hover:text-violet-300 hover:underline">
                  Forgot password?
                </Link>
              </div>
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

            {error && (
              <p className="text-xs text-rose-500 font-mono bg-rose-500/5 border border-rose-500/10 p-2.5 rounded-lg">
                ⚠ {error}
              </p>
            )}

            <Button type="submit" size="lg" className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold shadow-glow border border-violet-500/30">
              Sign In
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-900" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-950 px-3 text-slate-500 font-semibold">
                Or continue with
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-10 border-slate-900 bg-slate-950 hover:bg-slate-900 text-slate-300 text-xs">
              Google
            </Button>
            <Button variant="outline" className="h-10 border-slate-900 bg-slate-950 hover:bg-slate-900 text-slate-300 text-xs">
              GitHub
            </Button>
          </div>

          <p className="text-center text-xs text-slate-400">
            Don't have an account?{" "}
            <Link to="/register" className="text-violet-400 hover:text-violet-300 font-bold hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>

      {/* Right Column: Premium AI Graphic / Rings */}
      <div className="hidden lg:flex flex-col justify-between p-16 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
        <div className="absolute top-0 right-0 h-[600px] w-[600px] bg-radial-gradient from-violet-500/10 to-transparent pointer-events-none rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 bg-radial-gradient from-cyan-500/5 to-transparent pointer-events-none rounded-full blur-3xl" />
        
        {/* Top badge */}
        <div className="flex items-center gap-1.5 self-start px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-300 border border-violet-500/20">
          <Sparkles className="h-3.5 w-3.5" />
          Guided Analytics Hub
        </div>

        {/* Center: Interactive Rotating Dials */}
        <div className="relative flex items-center justify-center my-auto">
          {/* Animated Glow */}
          <div className="absolute h-64 w-64 rounded-full bg-violet-600/10 blur-3xl animate-pulse" />
          
          <div className="relative h-64 w-64 flex items-center justify-center">
            {/* Outer Ring */}
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-violet-500/20 animate-[spin_40s_linear_infinite]" />
            {/* Middle Ring */}
            <div className="absolute inset-4 rounded-full border border-cyan-500/30 border-t-transparent animate-[spin_20s_linear_infinite_reverse]" />
            {/* Inner Core */}
            <div className="absolute inset-12 rounded-full bg-gradient-to-br from-violet-600 to-cyan-500 flex flex-col items-center justify-center text-white shadow-2xl">
              <TrendingUp className="h-8 w-8 text-white animate-bounce" />
              <span className="font-mono text-lg font-bold mt-2">94.2%</span>
              <span className="text-[9px] uppercase tracking-wider text-white/80">AutoML Peak</span>
            </div>
          </div>
        </div>

        {/* Bottom context */}
        <div className="space-y-2 relative z-10">
          <blockquote className="text-base text-slate-300 italic font-body leading-relaxed">
            "Automated EDA generated full multicollinearity charts and recommended optimal hyperparameters, cutting our model preparation cycles from days to minutes."
          </blockquote>
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
            Lead Solution Architect, UAM Systems
          </p>
        </div>
      </div>

    </div>
  );
}
