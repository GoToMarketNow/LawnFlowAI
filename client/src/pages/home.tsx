import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  Users, 
  FileText, 
  Calendar, 
  Truck, 
  ArrowRight,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface KPIData {
  leadsToday: { new: number; pending: number; escalated: number };
  quotesOut: { awaitingApproval: number; sent: number; accepted: number };
  jobsToday: { scheduled: number; atRisk: number; unassigned: number };
  crewStatus: { available: number; onSite: number; delayed: number };
}

function KPITile({ 
  title, 
  icon: Icon, 
  primary, 
  secondary, 
  tertiary, 
  href,
  variant = "default"
}: { 
  title: string; 
  icon: React.ElementType; 
  primary: { label: string; value: number };
  secondary?: { label: string; value: number };
  tertiary?: { label: string; value: number };
  href: string;
  variant?: "default" | "warning" | "success";
}) {
  const hasAlert = primary.value > 0 && variant === "warning";
  
  return (
    <Card className={hasAlert ? "border-amber-500/50" : ""}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="text-2xl font-bold" data-testid={`kpi-${title.toLowerCase().replace(/\s+/g, '-')}`}>
              {primary.value}
            </div>
            <p className="text-xs text-muted-foreground">{primary.label}</p>
            {secondary && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">{secondary.label}:</span>
                <span className="font-medium">{secondary.value}</span>
              </div>
            )}
            {tertiary && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">{tertiary.label}:</span>
                <span className={tertiary.value > 0 ? "font-medium text-amber-600 dark:text-amber-400" : "font-medium"}>
                  {tertiary.value}
                </span>
              </div>
            )}
          </div>
          <Link href={href}>
            <Button variant="ghost" size="icon" data-testid={`kpi-link-${title.toLowerCase().replace(/\s+/g, '-')}`}>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionRequiredQueue() {
  const { data: pendingActions, isLoading } = useQuery<any[]>({
    queryKey: ["/api/pending-actions"],
    staleTime: 30000,
  });

  const actions = pendingActions?.filter(a => a.status === 'pending').slice(0, 5) || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          Action Required
        </CardTitle>
        <Link href="/approvals">
          <Button variant="ghost" size="sm" data-testid="link-view-all-actions">
            View All
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />
            ))}
          </div>
        ) : actions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">All caught up</p>
          </div>
        ) : (
          <div className="space-y-2">
            {actions.map((action, idx) => (
              <div 
                key={action.id || idx}
                className="flex items-center justify-between gap-4 p-2 rounded-md hover-elevate"
                data-testid={`action-item-${idx}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0">
                    {action.priority === 'high' ? (
                      <Badge variant="destructive" className="text-xs">High</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Med</Badge>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{action.title || 'Pending Action'}</p>
                    <p className="text-xs text-muted-foreground truncate">{action.type || 'Approval'}</p>
                  </div>
                </div>
                <Link href={action.deepLink || '/approvals'}>
                  <Button variant="ghost" size="sm" data-testid={`action-resolve-${idx}`}>
                    Resolve
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AgentActivityFeed() {
  const { data: events, isLoading } = useQuery<any[]>({
    queryKey: ["/api/events"],
    staleTime: 30000,
  });

  const recentEvents = events?.slice(0, 5) || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Agent Activity
        </CardTitle>
        <Link href="/work">
          <Button variant="ghost" size="sm" data-testid="link-view-all-activity">
            View All
            <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />
            ))}
          </div>
        ) : recentEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentEvents.map((event, idx) => (
              <div 
                key={event.id || idx}
                className="flex items-start gap-3 p-2 rounded-md"
                data-testid={`activity-item-${idx}`}
              >
                <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{event.summary || event.type || 'Agent action'}</p>
                  <p className="text-xs text-muted-foreground">
                    {event.createdAt ? new Date(event.createdAt).toLocaleTimeString() : 'Just now'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function HomePage() {
  const { data: kpiData } = useQuery<KPIData>({
    queryKey: ["/api/ops/kpis"],
    staleTime: 60000,
  });

  const kpis = kpiData || {
    leadsToday: { new: 0, pending: 0, escalated: 0 },
    quotesOut: { awaitingApproval: 0, sent: 0, accepted: 0 },
    jobsToday: { scheduled: 0, atRisk: 0, unassigned: 0 },
    crewStatus: { available: 0, onSite: 0, delayed: 0 },
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="page-title-home">Command Center</h1>
          <p className="text-sm text-muted-foreground">
            Today's operations at a glance
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPITile
          title="Leads Today"
          icon={Users}
          primary={{ label: "New leads", value: kpis.leadsToday.new }}
          secondary={{ label: "Pending", value: kpis.leadsToday.pending }}
          tertiary={{ label: "Escalated", value: kpis.leadsToday.escalated }}
          href="/work?type=lead"
          variant={kpis.leadsToday.escalated > 0 ? "warning" : "default"}
        />
        <KPITile
          title="Quotes Out"
          icon={FileText}
          primary={{ label: "Awaiting approval", value: kpis.quotesOut.awaitingApproval }}
          secondary={{ label: "Sent", value: kpis.quotesOut.sent }}
          tertiary={{ label: "Accepted", value: kpis.quotesOut.accepted }}
          href="/approvals?type=quote"
          variant={kpis.quotesOut.awaitingApproval > 0 ? "warning" : "default"}
        />
        <KPITile
          title="Jobs Today"
          icon={Calendar}
          primary={{ label: "Scheduled", value: kpis.jobsToday.scheduled }}
          secondary={{ label: "At risk", value: kpis.jobsToday.atRisk }}
          tertiary={{ label: "Unassigned", value: kpis.jobsToday.unassigned }}
          href="/schedule"
          variant={kpis.jobsToday.unassigned > 0 ? "warning" : "default"}
        />
        <KPITile
          title="Crew Status"
          icon={Truck}
          primary={{ label: "Available", value: kpis.crewStatus.available }}
          secondary={{ label: "On site", value: kpis.crewStatus.onSite }}
          tertiary={{ label: "Delayed", value: kpis.crewStatus.delayed }}
          href="/operations/crews"
          variant={kpis.crewStatus.delayed > 0 ? "warning" : "default"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ActionRequiredQueue />
        <AgentActivityFeed />
      </div>
    </div>
  );
}
