import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { TrendingUp, Users, FileText, Clock } from "lucide-react";
import { apiClient } from "@/lib/api";

interface StatsData {
  user_count: number;
  active_projects: number;
  platform_usage: number;
  revenue: number;
  daily_active_users: number;
  projects_created: number;
  avg_session_duration: number;
  platform_growth: number;
}

export default function AdminAnalytics() {
  const [metrics, setMetrics] = useState([
    { label: "Daily Active Users", value: "0", change: "+0%", icon: Users },
    { label: "Projects Created", value: "0", change: "+0%", icon: FileText },
    { label: "Avg. Session Duration", value: "0m", change: "+0%", icon: Clock },
    { label: "Platform Growth", value: "+0%", change: "+0%", icon: TrendingUp },
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await apiClient.getAdminStats() as StatsData;
        setMetrics([
          { label: "Daily Active Users", value: data.daily_active_users.toString(), change: "+12.5%", icon: Users },
          { label: "Projects Created", value: data.projects_created.toString(), change: "+8.2%", icon: FileText },
          { label: "Avg. Session Duration", value: `${data.avg_session_duration}m`, change: "+5.1%", icon: Clock },
          { label: "Platform Growth", value: `+${data.platform_growth}%`, change: "+3.8%", icon: TrendingUp },
        ]);
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <AppLayout isAdmin>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold">Platform Analytics</h1>
          <p className="text-muted-foreground">Insights into platform usage and growth</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric, index) => (
            <Card key={index} className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{metric.label}</span>
                <metric.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-bold">{metric.value}</div>
                <span className="text-sm text-accent">{metric.change}</span>
              </div>
            </Card>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">User Growth</h3>
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              User growth chart would be displayed here
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Feature Adoption</h3>
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              Feature adoption chart would be displayed here
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Revenue Trends</h3>
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            Revenue trend chart would be displayed here
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
