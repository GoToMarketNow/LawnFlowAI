import { useQuery } from "@tanstack/react-query";
import {
  Phone,
  MessageSquare,
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  Users,
  Briefcase,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Conversation, PendingAction } from "@shared/schema";

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

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  loading?: boolean;
}

function MetricCard({ title, value, subtitle, icon, loading }: MetricCardProps) {
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
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
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
      className="flex items-center justify-between gap-3 py-3 border-b border-border last:border-0"
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
            {conversation.source.replace("_", " ")} 
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
      className="flex items-center justify-between gap-3 py-3 border-b border-border last:border-0"
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
  const { data: metrics, isLoading: loadingMetrics } = useQuery<Metrics>({
    queryKey: ["/api/metrics"],
    refetchInterval: 10000,
  });

  const { data: conversations, isLoading: loadingConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  const { data: pendingActions, isLoading: loadingActions } = useQuery<PendingAction[]>({
    queryKey: ["/api/pending-actions"],
  });

  const isLoading = loadingMetrics;

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
          title="Leads Recovered"
          value={metrics?.leadsRecovered || 0}
          subtitle="From missed calls"
          icon={<Users className="h-4 w-4 text-green-600" />}
          loading={isLoading}
        />
        <MetricCard
          title="Jobs Booked"
          value={metrics?.jobsBooked || 0}
          subtitle="Scheduled + completed"
          icon={<Briefcase className="h-4 w-4 text-blue-600" />}
          loading={isLoading}
        />
        <MetricCard
          title="Hours Saved"
          value={`${metrics?.hoursSaved || 0}h`}
          subtitle="Automated responses"
          icon={<Clock className="h-4 w-4 text-purple-600" />}
          loading={isLoading}
        />
        <MetricCard
          title="Pending Actions"
          value={metrics?.pendingApprovals || 0}
          subtitle="Awaiting approval"
          icon={<CheckCircle2 className="h-4 w-4 text-yellow-600" />}
          loading={isLoading}
        />
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg font-medium">Recent Conversations</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {metrics?.totalConversations || 0} total
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
              className={(metrics?.pendingApprovals || 0) > 0 ? "bg-yellow-500/10 text-yellow-600" : ""}
            >
              {metrics?.pendingApprovals || 0} pending
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
              <CheckCircle2 className="h-8 w-8 mx-auto text-purple-600 dark:text-purple-400 mb-2" />
              <p className="text-2xl font-bold" data-testid="metric-completed-jobs">
                {metrics?.completedJobs || 0}
              </p>
              <p className="text-xs text-muted-foreground">Completed Jobs</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
