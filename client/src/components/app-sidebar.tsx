import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Inbox,
  Briefcase,
  FileText,
  FileEdit,
  Calendar,
  CalendarCheck,
  ClipboardList,
  Users,
  Bot,
  Settings,
  Zap,
  Brain,
  MessageSquare,
  CheckCircle,
  Bell,
  DollarSign,
  CreditCard,
  Plug,
  Activity,
  Download,
  Map,
  Truck,
  AlertTriangle,
  Tag,
  Percent,
  UserPlus,
  Eye,
  Cpu,
  Shield,
  Sliders,
  Package,
  Building,
  Layers,
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
import { getFilteredNavigationV2, shouldUseV2Navigation } from "@/lib/ui/nav-v2";
import { getFilteredNavigationV3, shouldUseV3Navigation } from "@/lib/ui/nav-v3";
import { Badge } from "@/components/ui/badge";
import { SystemStatus } from "@/components/system-status";
import { Separator } from "@/components/ui/separator";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Inbox,
  Briefcase,
  FileText,
  FileEdit,
  Calendar,
  CalendarCheck,
  ClipboardList,
  Users,
  Bot,
  Settings,
  Brain,
  MessageSquare,
  CheckCircle,
  Bell,
  DollarSign,
  CreditCard,
  Plug,
  Activity,
  Download,
  Map,
  Truck,
  AlertTriangle,
  Tag,
  Percent,
  UserPlus,
  Eye,
  Cpu,
  Shield,
  Sliders,
  Package,
  Building,
  Layers,
};

interface AppSidebarProps {
  isOnboardingComplete: boolean;
}

export function AppSidebar({ isOnboardingComplete }: AppSidebarProps) {
  const [location] = useLocation();
  const userRole = useUserRole();
  const { state } = useSidebar();
  const useV3 = shouldUseV3Navigation();
  const useV2 = shouldUseV2Navigation();
  const useEnhanced = useV3 || useV2;
  
  const { data: pendingActions } = useQuery<any[]>({
    queryKey: ["/api/pending-actions"],
    staleTime: 30000,
    refetchInterval: 60000,
  });
  
  const pendingCount = Array.isArray(pendingActions) 
    ? pendingActions.filter(a => a.status === 'pending').length 
    : 0;

  const isActive = (url: string) => {
    if (useEnhanced) {
      if (url === "/home") {
        return location === "/" || location === "/home" || location === "/dashboard";
      }
    } else {
      if (url === "/") {
        return location === "/" || location === "/dashboard";
      }
    }
    return location === url || location.startsWith(url + "/");
  };

  const filteredNavigation = useV3 
    ? getFilteredNavigationV3(userRole) 
    : useV2 
      ? getFilteredNavigationV2(userRole) 
      : getFilteredNavigation(userRole);

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
                {useEnhanced ? 'Command Center' : 'Agentic Automation'}
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
                  const homeId = useEnhanced ? "home" : "dashboard";
                  const isSettingsItem = item.id.startsWith('settings-') || item.id === 'settings-overview';
                  const disabled = !isOnboardingComplete && item.id !== homeId && !isSettingsItem;
                  const showBadge = item.badge === "count" && pendingCount > 0;
                  const showSlaBadge = item.badge === "sla" && pendingCount > 0;
                  
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
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{useV2 ? 'v2.0' : 'MVP v1.0'}</span>
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
