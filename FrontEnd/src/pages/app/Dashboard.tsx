import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  FolderKanban, 
  Database, 
  Brain, 
  TrendingUp, 
  Sparkles, 
  ArrowUpRight, 
  Activity, 
  Terminal, 
  HelpCircle,
  Code2,
  FileCheck,
  Cpu
} from "lucide-react";
import { Link } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useUser";
import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";

export default function Dashboard() {
  const isAdmin = useIsAdmin();
  const [loading, setLoading] = useState(true);
  
  const [stats, setStats] = useState({
    activeProjects: 0,
    datasetsUsed: 0,
    modelsTraining: 0,
    avgDataQuality: "N/A",
    topModelType: "N/A"
  });

  const [recentProjects, setRecentProjects] = useState<Array<{
    id: string;
    name: string;
    dataset: string;
    status: string;
    updated: string;
  }>>([]);

  const [leaderboard, setLeaderboard] = useState<Array<{
    id: string;
    name: string;
    accuracy: number;
    task_type: string;
    created_at?: string;
  }>>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const statsData = await apiClient.getPortfolioStats();
        if (statsData) {
          setStats({
            activeProjects: statsData.activeProjects || 0,
            datasetsUsed: statsData.datasetsUsed || 0,
            modelsTraining: statsData.modelsTraining || 0,
            avgDataQuality: statsData.avgDataQuality || "N/A",
            topModelType: statsData.topModelType || "N/A"
          });
        }

        const projectsData = await apiClient.getRecentProjects();
        if (projectsData) {
          setRecentProjects(projectsData);
        }

        const leaderboardData = await apiClient.getLeaderboard(5);
        if (leaderboardData) {
          setLeaderboard(leaderboardData);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <AppLayout isAdmin={isAdmin}>
      <div className="space-y-8 animate-fade-in pb-12">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight font-display bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
              Command Center
            </h1>
            <p className="text-slate-400 mt-1 font-body text-sm">
              Universal Analyst Model · Premium Dashboard v2.0
            </p>
          </div>
          <Link to="/app/projects?create=true">
            <Button className="gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold shadow-glow border border-violet-500/30 transition-all duration-300 hover:-translate-y-0.5">
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </Link>
        </div>

        {/* AI Executive Summary Banner */}
        <div className="relative group overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/20 via-slate-900/40 to-cyan-950/20 p-6 backdrop-blur-md transition-all duration-300">
          <div className="absolute top-0 right-0 h-64 w-64 bg-radial-gradient from-violet-500/10 to-transparent pointer-events-none rounded-full blur-3xl group-hover:from-violet-500/15 transition-all duration-500" />
          <div className="absolute bottom-0 left-1/3 h-48 w-48 bg-radial-gradient from-cyan-500/5 to-transparent pointer-events-none rounded-full blur-3xl" />
          
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-white flex-shrink-0 shadow-lg">
              <Sparkles className="h-5 w-5 animate-pulse" />
            </div>
            
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-bold text-slate-100 text-base">AI Executive Summary</h3>
                  <span className="text-xs text-slate-500">•</span>
                  <span className="text-xs text-slate-400 font-mono">Real-time analysis feed</span>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-300 border border-violet-500/20">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                  </span>
                  Live Insight
                </span>
              </div>
              
              <p className="text-slate-300 text-sm leading-relaxed max-w-4xl font-body">
                {stats.activeProjects > 0 ? (
                  <>
                    Active workspace is synchronized. You have <span className="text-cyan-400 font-semibold">{stats.activeProjects} project{stats.activeProjects !== 1 ? 's' : ''}</span> active and <span className="text-cyan-400 font-semibold">{stats.datasetsUsed} dataset{stats.datasetsUsed !== 1 ? 's' : ''}</span> linked. 
                    {stats.topModelType !== "N/A" ? (
                      <span> Your current best-performing pipeline is powered by <span className="text-violet-400 font-semibold">{stats.topModelType}</span>.</span>
                    ) : (
                      <span> AutoML model pipelines are ready to be trained. Select a project below to launch.</span>
                    )}
                  </>
                ) : (
                  <>
                    Your analytical workspace is currently empty. Get started by clicking <span className="text-cyan-400 font-semibold">"New Project"</span>, uploading your data files, and letting UAM auto-generate full exploratory data analysis (EDA) and trained machine learning pipelines in seconds.
                  </>
                )}
              </p>
              
              <div className="flex flex-wrap gap-2 pt-1">
                {stats.activeProjects > 0 ? (
                  <>
                    <Link to="/app/projects">
                      <Button size="sm" variant="secondary" className="h-8 text-xs bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/60 font-semibold">
                        View Projects Hub
                      </Button>
                    </Link>
                    <Link to="/app/datasets">
                      <Button size="sm" variant="secondary" className="h-8 text-xs bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/60 font-semibold">
                        Link Datasets
                      </Button>
                    </Link>
                  </>
                ) : (
                  <Link to="/app/projects?create=true">
                    <Button size="sm" className="h-8 text-xs bg-violet-600 hover:bg-violet-500 text-white font-semibold">
                      Create First Project
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Active Projects */}
          <Card className="relative p-6 overflow-hidden bg-slate-950/40 border border-slate-900 backdrop-blur-sm transition-all duration-300 hover:border-violet-500/40 hover:-translate-y-1 group hover:shadow-glow">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-violet-600 to-indigo-600" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-display">Active Projects</span>
              <div className="h-8 w-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400 group-hover:scale-110 transition-transform">
                <FolderKanban className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-100">{stats.activeProjects}</div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-body">
              <span className="text-emerald-400 font-semibold flex items-center">Live Sync</span>
            </div>
          </Card>

          {/* Datasets */}
          <Card className="relative p-6 overflow-hidden bg-slate-950/40 border border-slate-900 backdrop-blur-sm transition-all duration-300 hover:border-cyan-500/40 hover:-translate-y-1 group hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 to-teal-500" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-display">Datasets</span>
              <div className="h-8 w-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                <Database className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-100">{stats.datasetsUsed}</div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-body">
              <span className="text-slate-400">Total registered</span>
            </div>
          </Card>

          {/* Trained Models */}
          <Card className="relative p-6 overflow-hidden bg-slate-950/40 border border-slate-900 backdrop-blur-sm transition-all duration-300 hover:border-pink-500/40 hover:-translate-y-1 group hover:shadow-[0_0_20px_rgba(236,72,153,0.15)]">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-pink-500 to-rose-500" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-display">Trained Models</span>
              <div className="h-8 w-8 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-400 group-hover:scale-110 transition-transform">
                <Brain className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-100">{stats.modelsTraining}</div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-body">
              <span className="text-slate-400">Pipelines generated</span>
            </div>
          </Card>

          {/* Data Quality */}
          <Card className="relative p-6 overflow-hidden bg-slate-950/40 border border-slate-900 backdrop-blur-sm transition-all duration-300 hover:border-emerald-500/40 hover:-translate-y-1 group hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-green-500" />
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-display">Avg. Data Quality</span>
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-bold font-mono text-slate-100">{stats.avgDataQuality}</div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-body">
              <span className="text-emerald-400 font-semibold">{stats.avgDataQuality !== "N/A" ? "Healthy rating" : "No active audit"}</span>
            </div>
          </Card>

        </div>

        {/* 2:1 Split Grid - Core Workspaces & Leaderboards */}
        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* Recent Projects Table - taking 2 cols */}
          <Card className="lg:col-span-2 p-6 bg-slate-950/40 border border-slate-900 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-violet-400" />
                <h2 className="text-xl font-bold font-display text-slate-100">Recent Projects Workspace</h2>
              </div>
              <Link to="/app/projects">
                <Button variant="ghost" size="sm" className="text-xs font-semibold text-violet-400 hover:text-violet-300 hover:bg-violet-500/10">
                  View All Hub
                </Button>
              </Link>
            </div>

            <div className="space-y-4">
              {recentProjects.length > 0 ? (
                recentProjects.map((project) => (
                  <Link key={project.id} to={`/app/projects/${project.id}/overview`}>
                    <div className="group flex items-center justify-between p-4 border border-slate-900 rounded-xl bg-slate-950/20 hover:bg-slate-900/50 hover:border-violet-500/20 transition-all duration-300">
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-200 group-hover:text-violet-400 transition-colors truncate">
                            {project.name}
                          </h3>
                          <ArrowUpRight className="h-3.5 w-3.5 text-slate-600 opacity-0 group-hover:opacity-100 group-hover:text-violet-400 transition-all" />
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-1">
                          Dataset: <span className="font-mono text-slate-400">{project.dataset}</span>
                        </p>
                      </div>
                      
                      <div className="flex items-center gap-6 flex-shrink-0">
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border ${
                          project.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          project.status === 'RUNNING' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 animate-pulse' :
                          project.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                          'bg-slate-800/30 text-slate-400 border-slate-700/25'
                        }`}>
                          {project.status}
                        </span>
                        
                        <div className="text-right hidden sm:block">
                          <div className="text-[10.5px] text-slate-500 font-mono">{project.updated}</div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl">
                  <FolderKanban className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No recent projects found</p>
                  <p className="text-xs text-slate-500 mt-1">Create a project to launch automated ML workflows</p>
                </div>
              )}
            </div>
          </Card>

          {/* Model Benchmarks Leaderboard - dynamic from API */}
          <Card className="p-6 bg-slate-950/40 border border-slate-900 backdrop-blur-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <Cpu className="h-5 w-5 text-pink-400" />
                <h2 className="text-xl font-bold font-display text-slate-100">Model Leaderboard</h2>
              </div>

              <div className="space-y-4">
                {loading ? (
                  <div className="text-center py-6">
                    <Activity className="h-5 w-5 animate-spin mx-auto text-pink-400 mb-2" />
                    <p className="text-xs text-slate-500 font-mono">Loading models...</p>
                  </div>
                ) : leaderboard.length > 0 ? (
                  leaderboard.map((model, idx) => {
                    const colors = [
                      "from-violet-500 to-indigo-500",
                      "from-cyan-500 to-teal-500",
                      "from-pink-500 to-rose-500",
                      "from-amber-500 to-orange-500",
                      "from-emerald-500 to-green-500",
                    ];
                    const textColors = ["text-violet-400", "text-cyan-400", "text-pink-400", "text-amber-400", "text-emerald-400"];
                    return (
                      <div key={model.id} className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-slate-300 truncate max-w-[140px]" title={model.name}>
                            {model.name}
                          </span>
                          <span className={`font-mono font-bold ${textColors[idx % textColors.length]}`}>
                            {model.accuracy}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`bg-gradient-to-r ${colors[idx % colors.length]} h-full rounded-full transition-all duration-700`}
                            style={{ width: `${Math.min(model.accuracy, 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 border border-dashed border-slate-800 rounded-xl">
                    <Cpu className="h-7 w-7 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">No models trained yet</p>
                    <p className="text-[10px] text-slate-600 mt-1">Train a model in a project to see rankings</p>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-900 pt-4 mt-6">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>AutoML evaluation criteria</span>
                <span className="font-semibold">Accuracy / R²</span>
              </div>
            </div>
          </Card>

        </div>

        {/* Bottom Actions grid */}
        <div className="grid md:grid-cols-2 gap-6">
          
          {/* Quick Actions */}
          <Card className="p-6 bg-slate-950/40 border border-slate-900 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4">
              <Terminal className="h-5 w-5 text-cyan-400" />
              <h3 className="text-lg font-bold font-display text-slate-100">Quick Actions</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <Link to="/app/projects?create=true" className="w-full">
                <Button variant="outline" className="w-full justify-start gap-2 h-10 border-slate-900 hover:border-violet-500/30 hover:bg-violet-500/5 text-slate-300 hover:text-slate-100 text-xs">
                  <Plus className="h-3.5 w-3.5" />
                  Create Project
                </Button>
              </Link>
              <Link to="/app/datasets" className="w-full">
                <Button variant="outline" className="w-full justify-start gap-2 h-10 border-slate-900 hover:border-cyan-500/30 hover:bg-cyan-500/5 text-slate-300 hover:text-slate-100 text-xs">
                  <Database className="h-3.5 w-3.5" />
                  Link Dataset
                </Button>
              </Link>
              <Link to="/app/models" className="w-full">
                <Button variant="outline" className="w-full justify-start gap-2 h-10 border-slate-900 hover:border-pink-500/30 hover:bg-pink-500/5 text-slate-300 hover:text-slate-100 text-xs">
                  <Brain className="h-3.5 w-3.5" />
                  Active AutoML
                </Button>
              </Link>
              <a href="/app/settings" className="w-full">
                <Button variant="outline" className="w-full justify-start gap-2 h-10 border-slate-900 hover:border-slate-800 hover:bg-slate-800/30 text-slate-300 hover:text-slate-100 text-xs">
                  <Code2 className="h-3.5 w-3.5" />
                  API Access Keys
                </Button>
              </a>
            </div>
          </Card>

          {/* Interactive Pro Tip */}
          <Card className="relative overflow-hidden p-6 bg-gradient-to-br from-violet-600 to-indigo-700 text-white border-0 shadow-lg">
            <div className="absolute top-0 right-0 h-48 w-48 bg-radial-gradient from-white/10 to-transparent pointer-events-none rounded-full blur-2xl" />
            
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="space-y-3">
                <h3 className="text-lg font-bold font-display text-white">💡 Pro Tip: AutoML Pipeline</h3>
                <p className="text-white/80 text-xs leading-relaxed font-body">
                  You can deploy any completed ML model with a single click. Every deployment automatically provisions a production-grade REST API endpoint complete with latency metrics and telemetry logs.
                </p>
                <div className="pt-1">
                  <a href="https://github.com" target="_blank" rel="noreferrer">
                    <Button variant="secondary" className="h-8 text-xs bg-white text-indigo-700 hover:bg-white/95 font-semibold">
                      Explore SDK Documentation
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          </Card>

        </div>

      </div>
    </AppLayout>
  );
}
