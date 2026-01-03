import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  Users,
  Briefcase,
  Inbox,
  ChevronRight,
  AlertCircle,
  Activity,
  Bot,
  MessageSquare,
  FileText,
  AlertTriangle,
  ThumbsUp,
  Zap,
  Heart,
  Frown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GrowthAdvisorWidget } from "@/components/growth-advisor-widget";
import { MarginAlertTile } from "@/components/margin-alert-tile";
import { slaLevels } from "@/lib/ui/tokens";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

// Types for the new API endpoints
interface InboxItem {
  id: string;
  type: 'orchestration' | 'approval' | 'error';
  title: string;
  description: string;
  stage?: string;
  status: string;
  priority: 'urgent' | 'warning' | 'normal';
  createdAt: string;
  entityType?: string;
  entityId?: number;
  runId?: string;
  actionType?: string;
  ctaLabel: string;
  ctaAction: string;
}

interface TodayStats {
  scheduledJobsToday: number;
  crewUtilization: number;
  pendingQuotes: number;
  unreadMessages: number;
}

interface AgentActivityItem {
  id: number;
  type: 'step' | 'agent_run';
  agentName?: string;
  stage?: string;
  status: string;
  isError: boolean;
  isStuck: boolean;
  durationMs?: number;
  createdAt: string;
  message?: string;
}

interface CustomerHealth {
  npsAverage: number | null;
  lowSentimentCount: number;
  lowSentimentCustomers: Array<{id: number; name?: string; sentiment?: string}>;
  hasData: boolean;
}

interface Metrics {
  leadsRecovered: number;
  jobsBooked: number;
  completedJobs: number;
  hoursSaved: number;
  totalRevenue: number;
  conversionRate: number;
  activeConversations: number;
  pendingApprovals: number;
  totalConversations: number;
  totalLeads: number;
}

// Priority badge styles
const priorityStyles: Record<string, string> = {
  urgent: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
  warning: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
  normal: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30",
};

// Type icons
const typeIcons: Record<string, React.ReactNode> = {
  orchestration: <Zap className="h-4 w-4" />,
  approval: <FileText className="h-4 w-4" />,
  error: <AlertTriangle className="h-4 w-4" />,
};

function InboxItemCard({ item, onAction }: { item: InboxItem; onAction: (item: InboxItem) => void }) {
  const priorityConfig = slaLevels[item.priority] || slaLevels.normal;
  
  return (
    <div
      className="flex items-start gap-3 py-3 border-b border-border last:border-0 hover-elevate rounded-md px-2 -mx-2"
      data-testid={`inbox-item-${item.id}`}
    >
      <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${priorityConfig.bgColor}`}>
        <div className={priorityConfig.color}>
          {typeIcons[item.type] || <Inbox className="h-4 w-4" />}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{item.title}</p>
          <Badge 
            variant="outline" 
            className={`text-[10px] px-1.5 py-0 shrink-0 ${priorityStyles[item.priority]}`}
          >
            {item.priority === "urgent" ? "Urgent" : item.priority === "warning" ? "Soon" : "Normal"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {item.description}
        </p>
        <p className="text-[10px] text-muted-foreground/70 mt-1">
          {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
        </p>
      </div>
      <Button 
        size="sm" 
        variant={item.priority === "urgent" ? "default" : "outline"}
        className="shrink-0"
        onClick={() => onAction(item)}
        data-testid={`button-action-${item.id}`}
      >
        {item.ctaLabel}
      </Button>
    </div>
  );
}

function TodayStatCard({ 
  label, 
  value, 
  icon, 
  suffix,
  href,
}: { 
  label: string; 
  value: number | string; 
  icon: React.ReactNode;
  suffix?: string;
  href?: string;
}) {
  const content = (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover-elevate">
      <div className="h-10 w-10 rounded-md bg-background flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold">
          {value}{suffix}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

function ActivityItem({ item }: { item: AgentActivityItem }) {
  const statusColors: Record<string, string> = {
    completed: "text-green-600 dark:text-green-400",
    running: "text-blue-600 dark:text-blue-400",
    failed: "text-red-600 dark:text-red-400",
    success: "text-green-600 dark:text-green-400",
  };

  return (
    <div 
      className="flex items-center gap-3 py-2 border-b border-border last:border-0"
      data-testid={`activity-${item.type}-${item.id}`}
    >
      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
        item.isError ? "bg-red-500/10" : item.isStuck ? "bg-yellow-500/10" : "bg-muted"
      }`}>
        {item.type === "step" ? (
          <Activity className={`h-4 w-4 ${item.isError ? "text-red-500" : item.isStuck ? "text-yellow-500" : "text-muted-foreground"}`} />
        ) : (
          <Bot className={`h-4 w-4 ${item.isError ? "text-red-500" : item.isStuck ? "text-yellow-500" : "text-muted-foreground"}`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate">
            {item.type === "step" ? item.stage?.replace(/_/g, " ") : item.agentName}
          </p>
          {item.isError && <Badge variant="destructive" className="text-[10px] px-1 py-0">Error</Badge>}
          {item.isStuck && <Badge variant="outline" className="text-[10px] px-1 py-0 border-yellow-500 text-yellow-600">Stuck</Badge>}
        </div>
        <p className={`text-xs ${statusColors[item.status] || "text-muted-foreground"}`}>
          {item.status} {item.durationMs ? `(${Math.round(item.durationMs / 1000)}s)` : ""}
        </p>
      </div>
      <span className="text-[10px] text-muted-foreground shrink-0">
        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
      </span>
    </div>
  );
}

export default function Dashboard() {
  const { toast } = useToast();

  // Fetch all dashboard data
  const { data: inbox, isLoading: loadingInbox } = useQuery<InboxItem[]>({
    queryKey: ["/api/ops/inbox"],
    refetchInterval: 15000,
  });

  const { data: todayStats, isLoading: loadingToday } = useQuery<TodayStats>({
    queryKey: ["/api/dashboard/today"],
    refetchInterval: 30000,
  });

  const { data: agentActivity, isLoading: loadingActivity } = useQuery<AgentActivityItem[]>({
    queryKey: ["/api/dashboard/agent-activity"],
    refetchInterval: 20000,
  });

  const { data: customerHealth, isLoading: loadingHealth } = useQuery<CustomerHealth>({
    queryKey: ["/api/dashboard/customer-health"],
    refetchInterval: 60000,
  });

  const { data: metrics, isLoading: loadingMetrics } = useQuery<Metrics>({
    queryKey: ["/api/metrics"],
    refetchInterval: 30000,
  });

  // Handle inbox item action
  const handleItemAction = async (item: InboxItem) => {
    if (item.type === "orchestration" && item.runId) {
      // Navigate to orchestrator or show detail
      window.location.href = `/agents?run=${item.runId}`;
    } else if (item.type === "approval" && item.entityId) {
      // For pending actions, navigate to inbox with item highlighted
      window.location.href = `/inbox?action=${item.entityId}`;
    } else if (item.type === "error") {
      // Show toast with info
      toast({
        title: "Error Details",
        description: item.description,
      });
    }
  };

  const inboxItems = inbox || [];
  const urgentCount = inboxItems.filter(i => i.priority === "urgent").length;
  const hasUrgent = urgentCount > 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your landscaping business automation
          </p>
        </div>
        {hasUrgent && (
          <Badge 
            variant="destructive" 
            className="animate-pulse gap-1"
            data-testid="badge-urgent-count"
          >
            <AlertCircle className="h-3 w-3" />
            {urgentCount} urgent item{urgentCount > 1 ? "s" : ""} need attention
          </Badge>
        )}
      </div>

      {/* Main Grid: Needs You + Today */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Needs You (Inbox) - Priority section */}
        <Card className={hasUrgent ? "ring-2 ring-red-500/30" : ""}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <div>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Inbox className="h-5 w-5" />
                Needs You
              </CardTitle>
              <CardDescription>Items requiring your attention</CardDescription>
            </div>
            <Link href="/inbox">
              <Button variant="ghost" size="sm" className="gap-1" data-testid="button-view-inbox">
                View All
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loadingInbox ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-40 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-8 w-16" />
                  </div>
                ))}
              </div>
            ) : inboxItems.length > 0 ? (
              <ScrollArea className="max-h-[280px]">
                {inboxItems.slice(0, 5).map((item) => (
                  <InboxItemCard 
                    key={item.id} 
                    item={item} 
                    onAction={handleItemAction}
                  />
                ))}
                {inboxItems.length > 5 && (
                  <Link href="/inbox">
                    <Button variant="outline" className="w-full mt-3" data-testid="button-see-more-inbox">
                      See {inboxItems.length - 5} more items
                    </Button>
                  </Link>
                )}
              </ScrollArea>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="h-10 w-10 mx-auto text-green-500/50 mb-2" />
                <p className="text-sm text-muted-foreground">All caught up!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  No items pending your attention
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Today
            </CardTitle>
            <CardDescription>Your business at a glance</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingToday ? (
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <TodayStatCard
                  label="Scheduled Jobs"
                  value={todayStats?.scheduledJobsToday || 0}
                  icon={<Briefcase className="h-5 w-5 text-blue-600" />}
                  href="/schedule"
                />
                <TodayStatCard
                  label="Crew Utilization"
                  value={todayStats?.crewUtilization || 0}
                  suffix="%"
                  icon={<Users className="h-5 w-5 text-green-600" />}
                />
                <TodayStatCard
                  label="Pending Quotes"
                  value={todayStats?.pendingQuotes || 0}
                  icon={<FileText className="h-5 w-5 text-yellow-600" />}
                  href="/quotes"
                />
                <TodayStatCard
                  label="Unread Messages"
                  value={todayStats?.unreadMessages || 0}
                  icon={<MessageSquare className="h-5 w-5 text-purple-600" />}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Second Row: Agent Activity + Customer Health */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Agent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <div>
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Agent Activity
              </CardTitle>
              <CardDescription>Recent orchestration and agent runs</CardDescription>
            </div>
            <Link href="/agents">
              <Button variant="ghost" size="sm" className="gap-1" data-testid="button-view-agents">
                Details
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loadingActivity ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            ) : (agentActivity && agentActivity.length > 0) ? (
              <ScrollArea className="max-h-[200px]">
                {agentActivity.slice(0, 8).map((item) => (
                  <ActivityItem key={`${item.type}-${item.id}`} item={item} />
                ))}
              </ScrollArea>
            ) : (
              <div className="text-center py-6">
                <Bot className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No recent activity</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Agent runs will appear here
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Health */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Customer Health
            </CardTitle>
            <CardDescription>Satisfaction and sentiment tracking</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingHealth ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full rounded-lg" />
                <Skeleton className="h-16 w-full rounded-lg" />
              </div>
            ) : customerHealth?.hasData ? (
              <div className="space-y-4">
                {/* NPS Score */}
                {customerHealth.npsAverage !== null && (
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                    <div className={`h-14 w-14 rounded-full flex items-center justify-center ${
                      customerHealth.npsAverage >= 50 ? "bg-green-500/10" : 
                      customerHealth.npsAverage >= 0 ? "bg-yellow-500/10" : "bg-red-500/10"
                    }`}>
                      <span className={`text-xl font-bold ${
                        customerHealth.npsAverage >= 50 ? "text-green-600" : 
                        customerHealth.npsAverage >= 0 ? "text-yellow-600" : "text-red-600"
                      }`}>
                        {customerHealth.npsAverage}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">NPS Score</p>
                      <p className="text-xs text-muted-foreground">
                        {customerHealth.npsAverage >= 50 ? "Excellent" : 
                         customerHealth.npsAverage >= 0 ? "Good" : "Needs Improvement"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Low Sentiment */}
                {customerHealth.lowSentimentCount > 0 && (
                  <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Frown className="h-4 w-4 text-red-500" />
                      <p className="text-sm font-medium text-red-600 dark:text-red-400">
                        {customerHealth.lowSentimentCount} customer{customerHealth.lowSentimentCount > 1 ? "s" : ""} need attention
                      </p>
                    </div>
                    <div className="space-y-1">
                      {customerHealth.lowSentimentCustomers.slice(0, 3).map((c) => (
                        <p key={c.id} className="text-xs text-muted-foreground">
                          {c.name || `Customer #${c.id}`} - {c.sentiment}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {customerHealth.npsAverage === null && customerHealth.lowSentimentCount === 0 && (
                  <div className="text-center py-4">
                    <ThumbsUp className="h-8 w-8 mx-auto text-green-500/50 mb-2" />
                    <p className="text-sm text-muted-foreground">All customers are happy!</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <Heart className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No customer data yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Customer feedback will appear here
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ROI Metrics Row */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">ROI Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingMetrics ? (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <DollarSign className="h-8 w-8 mx-auto text-green-600 dark:text-green-400 mb-2" />
                  <p className="text-2xl font-bold" data-testid="metric-total-revenue">
                    ${((metrics?.totalRevenue || 0) / 100).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <TrendingUp className="h-8 w-8 mx-auto text-blue-600 dark:text-blue-400 mb-2" />
                  <p className="text-2xl font-bold" data-testid="metric-conversion-rate">
                    {metrics?.conversionRate || 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">Conversion Rate</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <Clock className="h-8 w-8 mx-auto text-purple-600 dark:text-purple-400 mb-2" />
                  <p className="text-2xl font-bold" data-testid="metric-hours-saved">
                    {metrics?.hoursSaved || 0}h
                  </p>
                  <p className="text-xs text-muted-foreground">Hours Saved</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <MarginAlertTile />
      </div>

      {/* Growth Advisor */}
      <div className="grid gap-6 grid-cols-1">
        <GrowthAdvisorWidget businessId={1} />
      </div>
    </div>
  );
}
