import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { TrendingUp, Users, FileText, Clock } from "lucide-react";
import { apiClient } from "@/lib/api";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from "recharts";

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

  const [userGrowthData, setUserGrowthData] = useState([
    { name: "Jan", users: 100 },
    { name: "Feb", users: 150 },
    { name: "Mar", users: 300 },
    { name: "Apr", users: 450 },
    { name: "May", users: 600 },
    { name: "Jun", users: 800 },
  ]);

  const [featureAdoptionData] = useState([
    { name: "EDA Reports", count: 420 },
    { name: "Model Training", count: 310 },
    { name: "Batch Predict", count: 180 },
    { name: "Data Cleaning", count: 290 },
  ]);

  const [revenueData, setRevenueData] = useState([
    { name: "Jan", revenue: 5000 },
    { name: "Feb", revenue: 8500 },
    { name: "Mar", revenue: 15000 },
    { name: "Apr", revenue: 22000 },
    { name: "May", revenue: 31000 },
    { name: "Jun", revenue: 42500 },
  ]);

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

        setUserGrowthData([
          { name: "Jan", users: Math.round(data.daily_active_users * 0.2) },
          { name: "Feb", users: Math.round(data.daily_active_users * 0.35) },
          { name: "Mar", users: Math.round(data.daily_active_users * 0.5) },
          { name: "Apr", users: Math.round(data.daily_active_users * 0.7) },
          { name: "May", users: Math.round(data.daily_active_users * 0.85) },
          { name: "Jun", users: data.daily_active_users },
        ]);

        setRevenueData([
          { name: "Jan", revenue: Math.round(data.revenue * 0.15) },
          { name: "Feb", revenue: Math.round(data.revenue * 0.3) },
          { name: "Mar", revenue: Math.round(data.revenue * 0.5) },
          { name: "Apr", revenue: Math.round(data.revenue * 0.7) },
          { name: "May", revenue: Math.round(data.revenue * 0.85) },
          { name: "Jun", revenue: data.revenue },
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
      <div className="space-y-6 animate-fade-in text-slate-100 font-body">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
            Platform Analytics
          </h1>
          <p className="text-muted-foreground text-sm">Insights into platform usage and growth</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric, index) => (
            <Card key={index} className="p-6 bg-slate-950/40 border border-slate-900 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">{metric.label}</span>
                <metric.icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-bold text-slate-200">{metric.value}</div>
                <span className="text-xs text-accent font-semibold">{metric.change}</span>
              </div>
            </Card>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6 bg-slate-950/40 border border-slate-900 backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">User Growth (Active Users)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={userGrowthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#020617", borderColor: "#1e293b", borderRadius: "8px" }}
                    labelStyle={{ color: "#94a3b8" }}
                    itemStyle={{ color: "#c084fc" }}
                  />
                  <Area type="monotone" dataKey="users" stroke="#a78bfa" strokeWidth={2} fillOpacity={1} fill="url(#userGrad)" name="Users" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6 bg-slate-950/40 border border-slate-900 backdrop-blur-sm">
            <h3 className="text-lg font-semibold text-slate-200 mb-4">Feature Adoption (Total Runs)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={featureAdoptionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#020617", borderColor: "#1e293b", borderRadius: "8px" }}
                    labelStyle={{ color: "#94a3b8" }}
                    itemStyle={{ color: "#38bdf8" }}
                  />
                  <Bar dataKey="count" fill="#38bdf8" radius={[4, 4, 0, 0]} name="Actions" maxBarSize={45} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <Card className="p-6 bg-slate-950/40 border border-slate-900 backdrop-blur-sm">
          <h3 className="text-lg font-semibold text-slate-200 mb-4">Revenue Trends ($ USD)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#020617", borderColor: "#1e293b", borderRadius: "8px" }}
                  labelStyle={{ color: "#94a3b8" }}
                  itemStyle={{ color: "#34d399" }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#34d399" strokeWidth={2} fillOpacity={1} fill="url(#revGrad)" name="Revenue ($)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
