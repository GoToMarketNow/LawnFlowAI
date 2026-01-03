import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  ClipboardList,
  Calendar,
  MapPin,
  Phone,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Filter,
  Search,
  MoreHorizontal,
  Play,
  Pause,
  Eye,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Job } from "@shared/schema";

type JobStatus = "pending" | "scheduled" | "in_progress" | "completed" | "cancelled";

const statusConfig: Record<
  string,
  { color: string; icon: React.ReactNode; label: string; bgColor: string }
> = {
  pending: {
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-500/10",
    icon: <Clock className="h-3 w-3" />,
    label: "Pending",
  },
  scheduled: {
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-500/10",
    icon: <Calendar className="h-3 w-3" />,
    label: "Scheduled",
  },
  in_progress: {
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-500/10",
    icon: <Loader2 className="h-3 w-3" />,
    label: "In Progress",
  },
  completed: {
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-500/10",
    icon: <CheckCircle2 className="h-3 w-3" />,
    label: "Completed",
  },
  cancelled: {
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-500/10",
    icon: <XCircle className="h-3 w-3" />,
    label: "Cancelled",
  },
};

interface JobCardProps {
  job: Job;
  onAction?: (job: Job, action: string) => void;
}

function JobCard({ job, onAction }: JobCardProps) {
  const status = statusConfig[job.status] || statusConfig.pending;

  return (
    <Card className="hover-elevate" data-testid={`card-job-${job.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <h3 className="text-sm font-medium truncate">{job.customerName}</h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Phone className="h-3 w-3" />
              {job.customerPhone}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`${status.color} ${status.bgColor} border-0`}>
              {status.icon}
              <span className="ml-1">{status.label}</span>
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" data-testid={`button-actions-${job.id}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onAction?.(job, 'view')}>
                  <Eye className="h-4 w-4 mr-2" /> View Details
                </DropdownMenuItem>
                {job.status === 'pending' && (
                  <DropdownMenuItem onClick={() => onAction?.(job, 'schedule')}>
                    <Calendar className="h-4 w-4 mr-2" /> Schedule
                  </DropdownMenuItem>
                )}
                {job.status === 'scheduled' && (
                  <DropdownMenuItem onClick={() => onAction?.(job, 'start')}>
                    <Play className="h-4 w-4 mr-2" /> Start Job
                  </DropdownMenuItem>
                )}
                {job.status === 'in_progress' && (
                  <DropdownMenuItem onClick={() => onAction?.(job, 'complete')}>
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Mark Complete
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {job.status !== 'cancelled' && job.status !== 'completed' && (
                  <DropdownMenuItem 
                    onClick={() => onAction?.(job, 'cancel')}
                    className="text-destructive"
                  >
                    <XCircle className="h-4 w-4 mr-2" /> Cancel Job
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{job.serviceType}</span>
          </div>

          {job.customerAddress && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
              <span className="truncate">{job.customerAddress}</span>
            </div>
          )}

          {job.scheduledDate && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                {new Date(job.scheduledDate).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}

          {job.estimatedPrice && (
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="font-medium text-green-600 dark:text-green-400">
                ${(job.estimatedPrice / 100).toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({ label, value, icon: Icon, trend }: { 
  label: string; 
  value: number; 
  icon: typeof Clock;
  trend?: { value: number; positive: boolean };
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-semibold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
          <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.pending;
  const IconComponent = status === 'pending' ? Clock : 
    status === 'scheduled' ? Calendar : 
    status === 'in_progress' ? Loader2 : CheckCircle2;

  return (
    <Card>
      <CardContent className="py-12 text-center">
        <IconComponent className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">
          No {config.label.toLowerCase()} jobs
        </p>
      </CardContent>
    </Card>
  );
}

export default function JobsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");

  const { data: jobs, isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ jobId, status }: { jobId: number; status: string }) => {
      await apiRequest("PATCH", `/api/jobs/${jobId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update job", variant: "destructive" });
    },
  });

  const handleAction = (job: Job, action: string) => {
    switch (action) {
      case 'view':
        toast({ title: "View job details", description: `Job #${job.id}` });
        break;
      case 'schedule':
        toast({ title: "Schedule job", description: "Scheduling coming soon" });
        break;
      case 'start':
        updateStatusMutation.mutate({ jobId: job.id, status: 'in_progress' });
        break;
      case 'complete':
        updateStatusMutation.mutate({ jobId: job.id, status: 'completed' });
        break;
      case 'cancel':
        updateStatusMutation.mutate({ jobId: job.id, status: 'cancelled' });
        break;
    }
  };

  const allJobs = Array.isArray(jobs) ? jobs : [];
  
  const filteredJobs = allJobs.filter(job => {
    const matchesSearch = searchQuery === "" || 
      job.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.customerPhone?.includes(searchQuery) ||
      job.serviceType?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTab = activeTab === "all" || job.status === activeTab;
    
    return matchesSearch && matchesTab;
  });

  const pendingCount = allJobs.filter(j => j.status === "pending").length;
  const scheduledCount = allJobs.filter(j => j.status === "scheduled").length;
  const inProgressCount = allJobs.filter(j => j.status === "in_progress").length;
  const completedCount = allJobs.filter(j => j.status === "completed" || j.status === "cancelled").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Jobs
          </h1>
          <p className="text-sm text-muted-foreground">
            Track and manage all landscaping jobs
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Pending" value={pendingCount} icon={Clock} />
        <StatCard label="Scheduled" value={scheduledCount} icon={Calendar} />
        <StatCard label="In Progress" value={inProgressCount} icon={Loader2} />
        <StatCard label="Completed" value={completedCount} icon={CheckCircle2} />
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">
            All
            <Badge variant="secondary" className="ml-2">{allJobs.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending
            {pendingCount > 0 && <Badge variant="secondary" className="ml-2">{pendingCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="scheduled" data-testid="tab-scheduled">
            Scheduled
            {scheduledCount > 0 && <Badge variant="secondary" className="ml-2">{scheduledCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="in_progress" data-testid="tab-in-progress">
            In Progress
            {inProgressCount > 0 && <Badge variant="secondary" className="ml-2">{inProgressCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
            Completed
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex justify-between mb-3">
                      <div>
                        <Skeleton className="h-4 w-28 mb-1" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-5 w-16" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredJobs.length > 0 ? (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {filteredJobs.map((job) => (
                <JobCard key={job.id} job={job} onAction={handleAction} />
              ))}
            </div>
          ) : (
            <EmptyState status={activeTab === "all" ? "pending" : activeTab} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
