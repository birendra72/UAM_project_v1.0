import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  Database,
  Brain,
  BookTemplate,
  Settings,
  BarChart3,
  Shield,
  Users,
  Activity,
  User,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

const userNavItems = [
  { title: "Dashboard", url: "/app/dashboard", icon: LayoutDashboard },
  { title: "Projects", url: "/app/projects", icon: FolderKanban },
  { title: "Datasets", url: "/app/datasets", icon: Database },
  { title: "Models", url: "/app/models", icon: Brain },
  { title: "Templates", url: "/app/templates", icon: BookTemplate },
  { title: "Settings", url: "/app/settings", icon: Settings },
];

const adminNavItems = [
  { title: "Admin Dashboard", url: "/admin/dashboard", icon: BarChart3 },
  { title: "Users", url: "/admin/users", icon: Users },
  { title: "Templates", url: "/admin/templates", icon: BookTemplate },
  { title: "Analytics", url: "/admin/analytics", icon: Activity },
];

export function AppSidebar({ isAdmin }: { isAdmin?: boolean }) {
  const { state } = useSidebar();
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const navItems = isAdmin ? adminNavItems : userNavItems;
  const collapsed = state === "collapsed";

  return (
    <Sidebar className={collapsed ? "w-14" : "w-60"}>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {role === "Admin" ? "Administration" : "Application"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
       <SidebarFooter className="border-t border-border/50 p-4">
        {!collapsed ? (
          <div className="space-y-2">
            <div className="flex items-center space-x-3 px-2">
              <div className="gradient-secondary p-2 rounded-full">
                <User className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="w-full justify-start hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="w-full p-2 hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
