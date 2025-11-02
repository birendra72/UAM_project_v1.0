import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Users, FileText, Activity, TrendingUp } from "lucide-react";
import { apiClient } from "@/lib/api";


interface SystemHealthData {
  cpu_usage: number;
  memory_usage: number;
  storage_usage: number;
}
interface StatsData {
  user_count: number;
  active_projects: number;
  platform_usage: number;
  revenue: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState([
    { label: "Total Users", value: "0", icon: Users, trend: "+0%" },
    { label: "Active Projects", value: "0", icon: FileText, trend: "+0%" },
    { label: "Platform Usage", value: "0%", icon: Activity, trend: "+0%" },
    { label: "Revenue", value: "$0", icon: TrendingUp, trend: "+0%" },
  ]);

  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<{ level: string; message: string; timestamp: string }[]>([]);
  const [offline, setOffline] = useState(false);

  const [systemHealth, setSystemHealth] = useState({
      cpu_usage: 0,
      memory_usage: 0,
      storage_usage: 0,
      });

  const cpuRef = useRef<HTMLDivElement>(null);
  const memoryRef = useRef<HTMLDivElement>(null);
  const storageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cpuRef.current) {
      cpuRef.current.style.width = `${systemHealth.cpu_usage}%`;
    }
    if (memoryRef.current) {
      memoryRef.current.style.width = `${systemHealth.memory_usage}%`;
    }
    if (storageRef.current) {
      storageRef.current.style.width = `${systemHealth.storage_usage}%`;
    }
  }, [systemHealth]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await apiClient.getAdminStats() as StatsData;
        setStats([
          { label: "Total Users", value: data.user_count.toString(), icon: Users, trend: "+12%" },
          { label: "Active Projects", value: data.active_projects.toString(), icon: FileText, trend: "+8%" },
          { label: "Platform Usage", value: `${data.platform_usage}%`, icon: Activity, trend: "+5%" },
          { label: "Revenue", value: `$${data.revenue.toLocaleString()}`, icon: TrendingUp, trend: "+18%" },
        ]);
        setOffline(false);
      } catch (error) {
        console.error("Failed to fetch stats:", error);
        setOffline(true);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  useEffect(() => {
    const fetchSystemHealth = async () => {
      try {
          const data = await apiClient.getAdminSystemHealth() as SystemHealthData;
          setSystemHealth(data);
          setOffline(false);
        } catch (error) {
          console.error("Failed to fetch system health:", error);
          setOffline(true);
      }
    };
    fetchSystemHealth();
    const interval = setInterval(fetchSystemHealth, 2500); // Fetch every 2.5 seconds

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await apiClient.getAdminLogs();
        setLogs(data);
        setOffline(false);
      } catch (error) {
        console.error("Failed to fetch logs:", error);
        setOffline(true);
      }
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000); // Fetch every 5 seconds

    return () => clearInterval(interval);
  }, []);

  // Helper function to format timestamp to "Xh ago"
  const formatTimeAgo = (timestamp: string) => {
    const time = new Date(timestamp).getTime();
    const now = Date.now();
    const diff = now - time;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) return "Just now";
    return `${hours}h ago`;
  };

  return (
    <AppLayout isAdmin>
      <div className="space-y-6 animate-fade-in">
        {offline && (
          <div className="bg-red-600 text-white p-4 rounded mb-4 text-center">
            You are currently offline. Some data may be outdated.
          </div>
        )}
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Platform overview and analytics</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <Card key={index} className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">{stat.label}</span>
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-bold">{stat.value}</div>
                <span className="text-sm text-accent">{stat.trend}</span>
              </div>
            </Card>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
              <div className="space-y-3 text-sm">
                {logs.length === 0 && !loading && (
                  <div className="text-muted-foreground">No recent activity</div>
                )}
                {logs.map((log, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <div className="font-medium">{log.level}</div>
                      <div className="text-muted-foreground">{log.message}</div>
                    </div>
                    <span className="text-muted-foreground">{formatTimeAgo(log.timestamp)}</span>
                  </div>
                ))}
                {loading && (
                  <div className="text-muted-foreground">Loading...</div>
                )}
              </div>
            </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">System Health</h3>
              <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">CPU Usage</span>
                  <span className="font-semibold">{systemHealth.cpu_usage}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    ref={cpuRef}
                    className="bg-accent h-2 rounded-full cpu-usage"
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Memory Usage</span>
                  <span className="font-semibold">{systemHealth.memory_usage}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    ref={memoryRef}
                    className="bg-primary h-2 rounded-full memory-usage"
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Storage</span>
                  <span className="font-semibold">{systemHealth.storage_usage}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    ref={storageRef}
                    className="bg-accent h-2 rounded-full storage-usage"
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
