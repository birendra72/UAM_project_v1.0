import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PublicHeader } from "@/components/PublicHeader";
import { PublicFooter } from "@/components/PublicFooter";
import { Sparkles, Zap, Brain, TrendingUp, Database, ShieldCheck, ArrowRight, Activity, Terminal } from "lucide-react";

export default function Home() {
  const features = [
    {
      icon: Zap,
      title: "Intelligent Cleaning",
      description: "Automatically detect outliers, impute missing values, and standardize features with AI heuristics.",
      glow: "hover:shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:border-amber-500/30",
      iconColor: "text-amber-400 bg-amber-500/10"
    },
    {
      icon: Brain,
      title: "Automated EDA",
      description: "Generate comprehensive multicollinearity matrices, distribution analytics, and correlation heatmaps.",
      glow: "hover:shadow-[0_0_20px_rgba(124,58,237,0.15)] hover:border-violet-500/30",
      iconColor: "text-violet-400 bg-violet-500/10"
    },
    {
      icon: Sparkles,
      title: "Guided AutoML",
      description: "Train classification, regression, and clustering algorithms in seconds without writing a line of code.",
      glow: "hover:shadow-[0_0_20px_rgba(236,72,153,0.15)] hover:border-pink-500/30",
      iconColor: "text-pink-400 bg-pink-500/10"
    },
    {
      icon: TrendingUp,
      title: "Model Leaderboards",
      description: "Compare validation metrics (accuracy, recall, precision, F1-score) in clear leaderboard summaries.",
      glow: "hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] hover:border-cyan-500/30",
      iconColor: "text-cyan-400 bg-cyan-500/10"
    },
    {
      icon: Database,
      title: "Data Repository",
      description: "Securely catalog datasets, trace file updates, and preview column formats directly in your workspace.",
      glow: "hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:border-emerald-500/30",
      iconColor: "text-emerald-400 bg-emerald-500/10"
    },
    {
      icon: ShieldCheck,
      title: "1-Click API Deploy",
      description: "Instantly provision production-grade REST API prediction endpoints with detailed latency monitoring.",
      glow: "hover:shadow-[0_0_20px_rgba(99,102,241,0.15)] hover:border-indigo-500/30",
      iconColor: "text-indigo-400 bg-indigo-500/10"
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-body relative overflow-hidden">
      
      {/* Background Radial Gradients */}
      <div className="absolute top-0 left-1/4 h-[800px] w-[800px] bg-radial-gradient from-violet-600/5 to-transparent pointer-events-none rounded-full blur-3xl" />
      <div className="absolute top-1/2 right-1/4 h-[600px] w-[600px] bg-radial-gradient from-cyan-600/5 to-transparent pointer-events-none rounded-full blur-3xl" />

      <PublicHeader />
      
      <main className="flex-1 relative z-10">
        
        {/* Hero Section */}
        <section className="relative pt-20 md:pt-32 pb-16 overflow-hidden">
          <div className="container px-6 mx-auto">
            <div className="max-w-4xl mx-auto text-center space-y-8">
              
              {/* Feature Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-300 border border-violet-500/20 mx-auto">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                </span>
                Guided ML & AutoML Engines
              </div>

              <h1 className="text-4xl md:text-7xl font-extrabold tracking-tight font-display bg-gradient-to-r from-slate-100 via-slate-300 to-slate-400 bg-clip-text text-transparent leading-[1.1]">
                Turn Raw Data Into<br />
                <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">
                  AI-Powered Predictions
                </span>
              </h1>
              
              <p className="text-base md:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed font-body">
                Upload your business datasets, clean anomalies automatically, train hyperparameter-optimized models, and deploy real-time prediction endpoints without writing code.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/register">
                  <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold shadow-glow border border-violet-500/30 transition-all duration-300 hover:-translate-y-0.5">
                    Start Analyzing Free
                  </Button>
                </Link>
                <Link to="/demo">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto border-slate-800 bg-slate-950/20 text-slate-300 hover:bg-slate-900 transition-all">
                    Try Demo Sandbox
                  </Button>
                </Link>
              </div>

            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-24 border-t border-slate-900/60 bg-slate-950/40">
          <div className="container px-6 mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
              <h2 className="text-3xl md:text-4xl font-bold font-display text-slate-100">
                End-to-End Predictive Analytics Pipeline
              </h2>
              <p className="text-sm text-slate-400 font-body">
                Everything you need to turn files into live predictions, integrated into a unified workspace.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {features.map((feature, index) => (
                <Card 
                  key={index} 
                  className={`p-6 bg-slate-950/40 border border-slate-900/60 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 group ${feature.glow}`}
                >
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-105 ${feature.iconColor}`}>
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold font-display text-slate-200 mb-2">{feature.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed font-body">{feature.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Call to Action (CTA) */}
        <section className="py-20 border-t border-slate-900/60">
          <div className="container px-6 mx-auto max-w-5xl">
            <Card className="relative overflow-hidden p-12 bg-gradient-to-br from-violet-600 to-indigo-700 text-white border-0 shadow-2xl rounded-2xl">
              <div className="absolute top-0 right-0 h-96 w-96 bg-radial-gradient from-white/10 to-transparent pointer-events-none rounded-full blur-3xl" />
              
              <div className="relative z-10 max-w-2xl mx-auto text-center space-y-6">
                <h2 className="text-3xl md:text-5xl font-extrabold font-display leading-tight text-white">
                  Ready to Deploy Your First Machine Learning Pipeline?
                </h2>
                <p className="text-sm text-white/80 font-body max-w-lg mx-auto leading-relaxed">
                  Join hundreds of product developers and solution builders leveraging UAM to run lightning-fast data predictions.
                </p>
                <div className="pt-2">
                  <Link to="/register">
                    <Button size="lg" variant="secondary" className="bg-white text-indigo-700 hover:bg-white/95 font-semibold gap-2 transition-transform hover:-translate-y-0.5">
                      Create Free Account
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          </div>
        </section>

      </main>

      <PublicFooter />
    </div>
  );
}
