import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, FolderKanban, Database, Brain, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { useIsAdmin } from "@/hooks/useUser";
import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";

export default function Dashboard() {
  const isAdmin = useIsAdmin();
  const [stats, setStats] = useState([
    { label: "Active Projects", value: "0", icon: FolderKanban, color: "text-primary" },
    { label: "Datasets", value: "0", icon: Database, color: "text-accent" },
    { label: "Trained Models", value: "0", icon: Brain, color: "text-primary" },
    { label: "Success Rate", value: "0%", icon: TrendingUp, color: "text-accent" },
  ]);
  const [recentProjects, setRecentProjects] = useState<Array<{
    id: string;
    name: string;
    dataset: string;
    status: string;
    updated: string;
  }>>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const statsData = await apiClient.getPortfolioStats();
        setStats([
          { label: "Active Projects", value: statsData.activeProjects.toString(), icon: FolderKanban, color: "text-primary" },
          { label: "Datasets", value: statsData.datasetsUsed.toString(), icon: Database, color: "text-accent" },
          { label: "Trained Models", value: statsData.modelsTraining.toString(), icon: Brain, color: "text-primary" },
          { label: "Data Quality", value: statsData.avgDataQuality, icon: TrendingUp, color: "text-accent" },
        ]);

        // Fetch recent projects
        const projectsData = await apiClient.getRecentProjects();
        setRecentProjects(projectsData);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      }
    };

    fetchData();
  }, []);

  return (
    <AppLayout isAdmin={isAdmin}>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back! Here's your analytics overview.</p>
          </div>
          <Link to="/app/projects/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <Card key={index} className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{stat.label}</span>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div className="text-3xl font-bold">{stat.value}</div>
            </Card>
          ))}
        </div>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold">Recent Projects</h2>
            <Link to="/app/projects">
              <Button variant="outline" size="sm">View All</Button>
            </Link>
          </div>

          <div className="space-y-4">
            {recentProjects.length > 0 ? (
              recentProjects.map((project) => (
                <Link key={project.id} to={`/app/projects/${project.id}/overview`}>
                  <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <h3 className="font-semibold">{project.name}</h3>
                      <p className="text-sm text-muted-foreground">{project.dataset}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        project.status === 'COMPLETED' ? 'bg-accent/20 text-accent' :
                        project.status === 'RUNNING' ? 'bg-primary/20 text-primary' :
                        project.status === 'PENDING' ? 'bg-yellow-200 text-yellow-800' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {project.status}
                      </span>
                      <span className="text-sm text-muted-foreground">{project.updated}</span>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-muted-foreground">No recent projects found.</p>
            )}
          </div>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <Link to="/app/templates">
                <Button variant="outline" className="w-full justify-start">
                  Browse Templates
                </Button>
              </Link>
              <Link to="/app/datasets">
                <Button variant="outline" className="w-full justify-start">
                  Upload Dataset
                </Button>
              </Link>
              <Link to="/app/models">
                <Button variant="outline" className="w-full justify-start">
                  View Models
                </Button>
              </Link>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-primary text-primary-foreground">
            <h3 className="text-lg font-semibold mb-2">💡 Pro Tip</h3>
            <p className="mb-4 opacity-90">
              Use smart templates to analyze your data with one click. Save hours of manual work!
            </p>
            <Link to="/app/templates">
              <Button variant="secondary">Explore Templates</Button>
            </Link>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
