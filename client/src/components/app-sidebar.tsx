import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Inbox,
  Briefcase,
  FileText,
  Calendar,
  Users,
  Bot,
  Settings,
  Zap,
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
  SidebarHeader,
  SidebarFooter,
  SidebarMenuBadge,
} from "@/components/ui/sidebar";
import { useUserRole } from "@/components/role-gate";
import { navigation, type UserRole } from "@/lib/ui/tokens";
import { Badge } from "@/components/ui/badge";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Inbox,
  Briefcase,
  FileText,
  Calendar,
  Users,
  Bot,
  Settings,
};

interface AppSidebarProps {
  isOnboardingComplete: boolean;
}

export function AppSidebar({ isOnboardingComplete }: AppSidebarProps) {
  const [location] = useLocation();
  const userRole = useUserRole();
  
  const { data: pendingActions } = useQuery<any[]>({
    queryKey: ["/api/pending-actions"],
    staleTime: 30000,
    refetchInterval: 60000,
  });
  
  const pendingCount = Array.isArray(pendingActions) 
    ? pendingActions.filter(a => a.status === 'pending').length 
    : 0;

  const isActive = (url: string) => {
    if (url === "/") {
      return location === "/" || location === "/dashboard";
    }
    return location === url || location.startsWith(url + "/");
  };

  const canAccess = (roles: UserRole[]) => {
    return roles.includes(userRole);
  };

  const filteredNavigation = navigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccess(item.roles)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <Sidebar aria-label="Primary">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Zap className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold text-sidebar-foreground">
              LawnFlow AI
            </span>
            <span className="text-xs text-muted-foreground">
              Agentic Automation
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {filteredNavigation.map((group) => (
          <SidebarGroup key={group.id}>
            {group.label !== "Core" && (
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = iconMap[item.icon] || LayoutDashboard;
                  const disabled = !isOnboardingComplete && item.id !== "dashboard";
                  const showBadge = item.badge === "count" && pendingCount > 0;
                  
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        asChild={!disabled}
                        isActive={isActive(item.href)}
                        disabled={disabled}
                        className={disabled ? "opacity-50 cursor-not-allowed" : ""}
                      >
                        {disabled ? (
                          <span className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span>{item.label}</span>
                          </span>
                        ) : (
                          <Link
                            href={item.href}
                            data-testid={`link-nav-${item.id}`}
                          >
                            <Icon className="h-4 w-4" />
                            <span>{item.label}</span>
                            {showBadge && (
                              <SidebarMenuBadge>
                                <Badge 
                                  variant="destructive" 
                                  className="h-5 min-w-5 flex items-center justify-center text-xs px-1.5"
                                >
                                  {pendingCount > 99 ? "99+" : pendingCount}
                                </Badge>
                              </SidebarMenuBadge>
                            )}
                          </Link>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            MVP v1.0
          </div>
          <Badge variant="outline" className="text-xs">
            {userRole}
          </Badge>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
