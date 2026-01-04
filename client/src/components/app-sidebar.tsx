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
  Brain,
  MessageSquare,
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
  useSidebar,
} from "@/components/ui/sidebar";
import { useUserRole } from "@/components/role-gate";
import { getFilteredNavigation } from "@/lib/ui/nav";
import { Badge } from "@/components/ui/badge";
import { SystemStatus } from "@/components/system-status";
import { Separator } from "@/components/ui/separator";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Inbox,
  Briefcase,
  FileText,
  Calendar,
  Users,
  Bot,
  Settings,
  Brain,
  MessageSquare,
};

interface AppSidebarProps {
  isOnboardingComplete: boolean;
}

export function AppSidebar({ isOnboardingComplete }: AppSidebarProps) {
  const [location] = useLocation();
  const userRole = useUserRole();
  const { state } = useSidebar();
  
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

  const filteredNavigation = getFilteredNavigation(userRole);

  return (
    <Sidebar aria-label="Primary" collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground shrink-0">
            <Zap className="h-5 w-5" />
          </div>
          {state !== 'collapsed' && (
            <div className="flex flex-col min-w-0">
              <span className="text-base font-semibold text-sidebar-foreground truncate">
                LawnFlow AI
              </span>
              <span className="text-xs text-muted-foreground truncate">
                Agentic Automation
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {filteredNavigation.map((group) => (
          <SidebarGroup key={group.id}>
            {group.label !== "Core" && state !== 'collapsed' && (
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
                        tooltip={item.label}
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

      <SidebarFooter className="border-t border-sidebar-border">
        {state !== 'collapsed' ? (
          <div className="p-3 space-y-3">
            <SystemStatus />
            <Separator />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>MVP v1.0</span>
              <Badge variant="outline" className="text-xs">
                {userRole}
              </Badge>
            </div>
          </div>
        ) : (
          <div className="p-2 flex flex-col items-center gap-2">
            <Badge variant="outline" className="text-xs px-1">
              {userRole.slice(0, 1)}
            </Badge>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
