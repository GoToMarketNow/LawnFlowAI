import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  User,
  Building2,
  MapPin,
  DollarSign,
  Shield,
  Plug,
  Users,
  FileText,
  Zap,
  ChevronRight,
  Package,
} from "lucide-react";
import { RoleGate } from "@/components/role-gate";

interface SettingsSection {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

const settingsSections: SettingsSection[] = [
  {
    id: "profile",
    title: "My Profile",
    description: "Manage your account settings and preferences",
    icon: User,
    href: "/profile",
  },
  {
    id: "business",
    title: "Business Profile",
    description: "Company name, contact info, and branding",
    icon: Building2,
    href: "/profile",
  },
  {
    id: "coverage",
    title: "Service Area",
    description: "Define your coverage zones and do-not-serve areas",
    icon: MapPin,
    href: "/admin/coverage",
  },
  {
    id: "services",
    title: "Service Catalog",
    description: "Manage services, pricing models, and promotions",
    icon: Package,
    href: "/settings/services",
  },
  {
    id: "pricing",
    title: "Pricing",
    description: "Service rates, packages, and discount rules",
    icon: DollarSign,
    href: "/pricing",
  },
  {
    id: "policies",
    title: "Automation Policies",
    description: "Configure AI confidence thresholds and approval rules",
    icon: Shield,
    href: "/ops",
  },
  {
    id: "integrations",
    title: "Integrations",
    description: "Connect Jobber, Twilio, and other services",
    icon: Plug,
    href: "/ops",
  },
  {
    id: "simulator",
    title: "Event Simulator",
    description: "Test AI agents with simulated customer interactions",
    icon: Zap,
    href: "/simulator",
  },
  {
    id: "audit",
    title: "Audit Log",
    description: "View system events and agent activity history",
    icon: FileText,
    href: "/audit",
  },
];

function SettingsCard({ section }: { section: SettingsSection }) {
  const Icon = section.icon;
  
  return (
    <Link href={section.href}>
      <Card 
        className="hover-elevate cursor-pointer h-full" 
        data-testid={`settings-card-${section.id}`}
      >
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-md bg-muted">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium mb-1">{section.title}</h3>
              <p className="text-sm text-muted-foreground">{section.description}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function SettingsPage() {
  return (
    <RoleGate allowedRoles={["OWNER", "ADMIN"]} fallback={
      <div className="p-6 max-w-4xl mx-auto">
        <Card>
          <CardContent className="p-12 text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Access Restricted</h3>
            <p className="text-sm text-muted-foreground">
              Settings are only available to owners and administrators.
            </p>
          </CardContent>
        </Card>
      </div>
    }>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your business configuration and integrations
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {settingsSections.map((section) => (
            <SettingsCard key={section.id} section={section} />
          ))}
        </div>
      </div>
    </RoleGate>
  );
}
