import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare,
  AlertTriangle,
  Clock,
  Users,
  User,
  Truck,
  ArrowRight,
  Radio,
  CheckCircle,
  Activity,
  Frown,
} from "lucide-react";
import { RoleGate } from "@/components/role-gate";
import { Link } from "wouter";

interface OpsCommsThread {
  id: number;
  audienceType: string;
  audienceName: string;
  urgencyScore: number;
  status: string;
  slaDeadline: string | null;
  sentimentScore: number | null;
  hasNegativeSentiment: boolean;
  pendingActionCount: number;
}

interface CommsStats {
  totalActive: number;
  criticalCount: number;
  highCount: number;
  slaBreaching: number;
  negativeSentiment: number;
  pendingActions: number;
  byAudience: {
    LEAD: number;
    CUSTOMER: number;
    CREW: number;
  };
}

function computeStats(threads: OpsCommsThread[]): CommsStats {
  const now = new Date();
  return {
    totalActive: threads.filter(t => t.status === "ACTIVE").length,
    criticalCount: threads.filter(t => t.urgencyScore >= 70).length,
    highCount: threads.filter(t => t.urgencyScore >= 50 && t.urgencyScore < 70).length,
    slaBreaching: threads.filter(t => t.slaDeadline && new Date(t.slaDeadline) < now).length,
    negativeSentiment: threads.filter(t => t.hasNegativeSentiment || (t.sentimentScore !== null && t.sentimentScore < 30)).length,
    pendingActions: threads.reduce((sum, t) => sum + t.pendingActionCount, 0),
    byAudience: {
      LEAD: threads.filter(t => t.audienceType === "LEAD").length,
      CUSTOMER: threads.filter(t => t.audienceType === "CUSTOMER").length,
      CREW: threads.filter(t => t.audienceType === "CREW").length,
    },
  };
}

function StatCard({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  variant = "default" 
}: { 
  title: string; 
  value: number; 
  description: string; 
  icon: typeof MessageSquare;
  variant?: "default" | "warning" | "critical";
}) {
  const variantClasses = {
    default: "",
    warning: "border-orange-500/50",
    critical: "border-destructive/50",
  };
  
  return (
    <Card className={variantClasses[variant]}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export default function OperationsCommsPage() {
  const threadsQuery = useQuery<OpsCommsThread[]>({
    queryKey: ["/api/ops/comms/threads"],
    queryFn: async () => {
      const res = await fetch("/api/ops/comms/threads?sortBy=urgency&sortOrder=desc", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch threads");
      return res.json();
    },
  });

  const stats = threadsQuery.data ? computeStats(threadsQuery.data) : null;
  const topUrgent = threadsQuery.data?.slice(0, 5) || [];

  return (
    <RoleGate allowedRoles={["OWNER", "ADMIN"]}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <MessageSquare className="h-6 w-6" />
              Operations Comms
            </h1>
            <p className="text-muted-foreground">
              Communications intelligence and triage center
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/settings/comms-studio">
              <Button variant="outline" data-testid="link-comms-studio">
                <Radio className="h-4 w-4 mr-2" />
                Comms Studio
              </Button>
            </Link>
            <Link href="/operations/comms/active">
              <Button data-testid="link-active-triage">
                <Activity className="h-4 w-4 mr-2" />
                Active Triage
              </Button>
            </Link>
          </div>
        </div>

        {threadsQuery.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : stats ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard
                title="Critical"
                value={stats.criticalCount}
                description="Urgency score 70+"
                icon={AlertTriangle}
                variant={stats.criticalCount > 0 ? "critical" : "default"}
              />
              <StatCard
                title="High Priority"
                value={stats.highCount}
                description="Urgency score 50-69"
                icon={Clock}
                variant={stats.highCount > 0 ? "warning" : "default"}
              />
              <StatCard
                title="SLA Breaching"
                value={stats.slaBreaching}
                description="Past deadline"
                icon={Clock}
                variant={stats.slaBreaching > 0 ? "critical" : "default"}
              />
              <StatCard
                title="Negative Sentiment"
                value={stats.negativeSentiment}
                description="Unhappy customers/leads"
                icon={Frown}
                variant={stats.negativeSentiment > 0 ? "warning" : "default"}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <div>
                    <CardTitle>Top Urgent Threads</CardTitle>
                    <CardDescription>Highest priority communications requiring attention</CardDescription>
                  </div>
                  <Link href="/operations/comms/active">
                    <Button variant="ghost" size="sm">
                      View All
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  </Link>
                </CardHeader>
                <CardContent>
                  {topUrgent.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                      <p className="font-medium">All clear</p>
                      <p className="text-sm">No urgent threads requiring attention</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {topUrgent.map((thread) => {
                        const audienceIcons = { LEAD: User, CUSTOMER: Users, CREW: Truck };
                        const Icon = audienceIcons[thread.audienceType as keyof typeof audienceIcons] || User;
                        const isCritical = thread.urgencyScore >= 70;
                        const isHigh = thread.urgencyScore >= 50;
                        
                        return (
                          <Link key={thread.id} href="/operations/comms/active">
                            <div 
                              className="flex items-center justify-between gap-3 p-3 rounded-md hover-elevate cursor-pointer border"
                              data-testid={`urgent-thread-${thread.id}`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{thread.audienceName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {thread.pendingActionCount} pending action{thread.pendingActionCount !== 1 ? "s" : ""}
                                  </p>
                                </div>
                              </div>
                              <Badge className={isCritical ? "bg-destructive text-destructive-foreground" : isHigh ? "bg-orange-500 text-white" : ""}>
                                {thread.urgencyScore}
                              </Badge>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>By Audience</CardTitle>
                  <CardDescription>Thread distribution across audience types</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-blue-500" />
                      <span>Leads</span>
                    </div>
                    <Badge variant="secondary">{stats.byAudience.LEAD}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-green-500" />
                      <span>Customers</span>
                    </div>
                    <Badge variant="secondary">{stats.byAudience.CUSTOMER}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-orange-500" />
                      <span>Crew</span>
                    </div>
                    <Badge variant="secondary">{stats.byAudience.CREW}</Badge>
                  </div>
                  
                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Total Active</span>
                      <span className="font-bold text-lg">{stats.totalActive}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Pending Actions</span>
                      <span>{stats.pendingActions}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </RoleGate>
  );
}
