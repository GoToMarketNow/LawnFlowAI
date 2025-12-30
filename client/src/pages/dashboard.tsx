import { useQuery } from "@tanstack/react-query";
import {
  Phone,
  MessageSquare,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Conversation, PendingAction, Job } from "@shared/schema";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; positive: boolean };
  loading?: boolean;
}

function MetricCard({ title, value, subtitle, icon, trend, loading }: MetricCardProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-6 rounded" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-20 mb-1" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold" data-testid={`metric-${title.toLowerCase().replace(/\s/g, "-")}`}>
          {value}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {trend && (
            <span
              className={`flex items-center text-xs font-medium ${
                trend.positive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
              }`}
            >
              {trend.positive ? (
                <TrendingUp className="h-3 w-3 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 mr-1" />
              )}
              {trend.value}%
            </span>
          )}
          {subtitle && (
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RecentConversationItem({ conversation }: { conversation: Conversation }) {
  const statusColors: Record<string, string> = {
    active: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    qualified: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
    scheduled: "bg-green-500/10 text-green-600 dark:text-green-400",
    completed: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
    lost: "bg-red-500/10 text-red-600 dark:text-red-400",
  };

  const sourceIcons: Record<string, React.ReactNode> = {
    missed_call: <Phone className="h-4 w-4" />,
    inbound_sms: <MessageSquare className="h-4 w-4" />,
    web_lead: <Calendar className="h-4 w-4" />,
  };

  return (
    <div
      className="flex items-center justify-between py-3 border-b border-border last:border-0"
      data-testid={`conversation-item-${conversation.id}`}
    >
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
          {sourceIcons[conversation.source] || <MessageSquare className="h-4 w-4" />}
        </div>
        <div>
          <p className="text-sm font-medium">
            {conversation.customerName || conversation.customerPhone}
          </p>
          <p className="text-xs text-muted-foreground">
            {conversation.source.replace("_", " ")} • {conversation.agentType || "intake"}
          </p>
        </div>
      </div>
      <Badge variant="secondary" className={statusColors[conversation.status]}>
        {conversation.status}
      </Badge>
    </div>
  );
}

function PendingActionItem({ action }: { action: PendingAction }) {
  return (
    <div
      className="flex items-center justify-between py-3 border-b border-border last:border-0"
      data-testid={`action-item-${action.id}`}
    >
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-yellow-500/10 flex items-center justify-center">
          <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        </div>
        <div>
          <p className="text-sm font-medium">{action.description}</p>
          <p className="text-xs text-muted-foreground">
            {action.actionType.replace("_", " ")}
          </p>
        </div>
      </div>
      <Badge variant="outline" className="text-yellow-600 border-yellow-300 dark:border-yellow-600">
        Pending
      </Badge>
    </div>
  );
}

export default function Dashboard() {
  const { data: conversations, isLoading: loadingConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  const { data: pendingActions, isLoading: loadingActions } = useQuery<PendingAction[]>({
    queryKey: ["/api/pending-actions"],
  });

  const { data: jobs, isLoading: loadingJobs } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const isLoading = loadingConversations || loadingActions || loadingJobs;

  // Calculate metrics
  const totalConversations = conversations?.length || 0;
  const activeConversations = conversations?.filter((c) => c.status === "active").length || 0;
  const scheduledJobs = jobs?.filter((j) => j.status === "scheduled").length || 0;
  const pendingCount = pendingActions?.filter((a) => a.status === "pending").length || 0;
  
  // Calculate revenue from completed jobs
  const totalRevenue = jobs
    ?.filter((j) => j.status === "completed")
    .reduce((sum, job) => sum + (job.estimatedPrice || 0), 0) || 0;

  const recentConversations = conversations?.slice(0, 5) || [];
  const recentPendingActions = pendingActions?.filter((a) => a.status === "pending").slice(0, 3) || [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of your landscaping business automation
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Leads"
          value={totalConversations}
          subtitle="All time conversations"
          icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
          trend={{ value: 12, positive: true }}
          loading={isLoading}
        />
        <MetricCard
          title="Active Conversations"
          value={activeConversations}
          subtitle="Currently in progress"
          icon={<Phone className="h-4 w-4 text-muted-foreground" />}
          loading={isLoading}
        />
        <MetricCard
          title="Pending Actions"
          value={pendingCount}
          subtitle="Awaiting approval"
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          loading={isLoading}
        />
        <MetricCard
          title="Scheduled Jobs"
          value={scheduledJobs}
          subtitle="Ready to execute"
          icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
          trend={{ value: 8, positive: true }}
          loading={isLoading}
        />
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg font-medium">Recent Conversations</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {totalConversations} total
            </Badge>
          </CardHeader>
          <CardContent>
            {loadingConversations ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-5 w-16" />
                  </div>
                ))}
              </div>
            ) : recentConversations.length > 0 ? (
              <div>
                {recentConversations.map((conversation) => (
                  <RecentConversationItem
                    key={conversation.id}
                    conversation={conversation}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No conversations yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Use the Event Simulator to create test leads
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg font-medium">Actions Requiring Approval</CardTitle>
            <Badge 
              variant="secondary" 
              className={pendingCount > 0 ? "bg-yellow-500/10 text-yellow-600" : ""}
            >
              {pendingCount} pending
            </Badge>
          </CardHeader>
          <CardContent>
            {loadingActions ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-40 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-5 w-16" />
                  </div>
                ))}
              </div>
            ) : recentPendingActions.length > 0 ? (
              <div>
                {recentPendingActions.map((action) => (
                  <PendingActionItem key={action.id} action={action} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle2 className="h-10 w-10 mx-auto text-green-500/50 mb-2" />
                <p className="text-sm text-muted-foreground">All caught up!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  No actions pending your approval
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">ROI Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <DollarSign className="h-8 w-8 mx-auto text-green-600 dark:text-green-400 mb-2" />
              <p className="text-2xl font-bold">${(totalRevenue / 100).toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Total Revenue</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <TrendingUp className="h-8 w-8 mx-auto text-blue-600 dark:text-blue-400 mb-2" />
              <p className="text-2xl font-bold">
                {totalConversations > 0
                  ? Math.round((scheduledJobs / totalConversations) * 100)
                  : 0}
                %
              </p>
              <p className="text-xs text-muted-foreground">Conversion Rate</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <Clock className="h-8 w-8 mx-auto text-purple-600 dark:text-purple-400 mb-2" />
              <p className="text-2xl font-bold">
                {jobs?.filter((j) => j.status === "completed").length || 0}
              </p>
              <p className="text-xs text-muted-foreground">Completed Jobs</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
