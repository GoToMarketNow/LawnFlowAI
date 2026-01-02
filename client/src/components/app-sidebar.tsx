import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  MessageSquare,
  CheckCircle,
  User,
  Zap,
  ClipboardList,
  FileText,
  Radio,
  Settings,
  CreditCard,
  MapPin,
  Bot,
  LayoutGrid,
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
} from "@/components/ui/sidebar";

interface AppSidebarProps {
  isOnboardingComplete: boolean;
}

const primaryNavItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
    requiresOnboarding: false,
  },
  {
    title: "My Profile",
    url: "/profile",
    icon: User,
    requiresOnboarding: false,
  },
];

const operationsItems = [
  {
    title: "Events Feed",
    url: "/events",
    icon: Radio,
    requiresOnboarding: true,
  },
  {
    title: "Conversations",
    url: "/conversations",
    icon: MessageSquare,
    requiresOnboarding: true,
  },
  {
    title: "Pending Actions",
    url: "/actions",
    icon: CheckCircle,
    requiresOnboarding: true,
  },
  {
    title: "Jobs",
    url: "/jobs",
    icon: ClipboardList,
    requiresOnboarding: true,
  },
  {
    title: "Agents",
    url: "/agents",
    icon: Bot,
    requiresOnboarding: true,
  },
  {
    title: "Views",
    url: "/views",
    icon: LayoutGrid,
    requiresOnboarding: true,
  },
];

const settingsItems = [
  {
    title: "Event Simulator",
    url: "/simulator",
    icon: Zap,
    requiresOnboarding: true,
  },
  {
    title: "Audit Log",
    url: "/audit",
    icon: FileText,
    requiresOnboarding: true,
  },
  {
    title: "Coverage Admin",
    url: "/admin/coverage",
    icon: MapPin,
    requiresOnboarding: false,
  },
];

const placeholderItems = [
  {
    title: "Settings",
    url: "#",
    icon: Settings,
    placeholder: true,
  },
  {
    title: "Billing",
    url: "#",
    icon: CreditCard,
    placeholder: true,
  },
];

export function AppSidebar({ isOnboardingComplete }: AppSidebarProps) {
  const [location] = useLocation();

  const isActive = (url: string) => {
    if (url === "/") {
      return location === "/" || location === "/dashboard";
    }
    return location === url || location.startsWith(url + "/");
  };

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
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {primaryNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                  >
                    <Link
                      href={item.url}
                      data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Operations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {operationsItems.map((item) => {
                const disabled = item.requiresOnboarding && !isOnboardingComplete;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      disabled={disabled}
                      className={disabled ? "opacity-50 cursor-not-allowed" : ""}
                    >
                      {disabled ? (
                        <span className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </span>
                      ) : (
                        <Link
                          href={item.url}
                          data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Tools</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => {
                const disabled = item.requiresOnboarding && !isOnboardingComplete;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.url)}
                      disabled={disabled}
                      className={disabled ? "opacity-50 cursor-not-allowed" : ""}
                    >
                      {disabled ? (
                        <span className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </span>
                      ) : (
                        <Link
                          href={item.url}
                          data-testid={`link-nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              {placeholderItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild={false}
                    disabled
                    className="opacity-50 cursor-not-allowed"
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="text-xs text-muted-foreground">
          MVP v1.0
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
