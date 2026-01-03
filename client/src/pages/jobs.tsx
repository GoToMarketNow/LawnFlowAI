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
  Search,
  MoreHorizontal,
  Play,
  Eye,
  Users,
  AlertTriangle,
  TrendingUp,
  Navigation,
  ThumbsUp,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth-context";
import type { Job } from "@shared/schema";

type JobStatus = "pending" | "scheduled" | "in_progress" | "completed" | "cancelled";

interface Crew {
  id: number;
  name: string;
  skillsJson: string[];
  equipmentJson: string[];
  dailyCapacityMinutes: number;
}

interface Simulation {
  id: number;
  crewId: number;
  crewName?: string;
  proposedDate: string;
  skillMatchPct: number;
  equipmentMatchPct: number;
  travelDistanceMiles: number;
  marginScore: number;
  riskScore: number;
  compositeScore: number;
}

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
  needs_assignment: {
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-500/10",
    icon: <Users className="h-3 w-3" />,
    label: "Needs Assignment",
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
              {job.customerPhone || "No phone"}
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
                  <DropdownMenuItem onClick={() => onAction?.(job, 'assign')}>
                    <Users className="h-4 w-4 mr-2" /> Assign Crew
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
            <span className="font-medium">{job.serviceType || "Service"}</span>
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

function StatCard({ label, value, icon: Icon }: { 
  label: string; 
  value: number; 
  icon: typeof Clock;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
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

function CrewRecommendationCard({ 
  simulation, 
  crew,
  isTop,
  onSelect 
}: { 
  simulation: Simulation; 
  crew?: Crew;
  isTop: boolean;
  onSelect: () => void;
}) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getRiskLabel = (risk: number) => {
    if (risk <= 20) return { label: "Low Risk", color: "text-green-600 dark:text-green-400" };
    if (risk <= 50) return { label: "Medium Risk", color: "text-amber-600 dark:text-amber-400" };
    return { label: "High Risk", color: "text-red-600 dark:text-red-400" };
  };

  const riskInfo = getRiskLabel(simulation.riskScore);

  return (
    <Card 
      className={`hover-elevate cursor-pointer ${isTop ? "border-primary/50 bg-primary/5" : ""}`}
      onClick={onSelect}
      data-testid={`crew-recommendation-${simulation.crewId}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            {isTop && (
              <Badge variant="default" className="text-xs">
                Recommended
              </Badge>
            )}
            <span className="font-medium">{crew?.name || `Crew ${simulation.crewId}`}</span>
          </div>
          <div className={`text-lg font-bold ${getScoreColor(simulation.compositeScore)}`}>
            {simulation.compositeScore}%
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Navigation className="h-4 w-4 text-muted-foreground" />
            <span>{simulation.travelDistanceMiles.toFixed(1)} mi</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span>Margin: {simulation.marginScore}%</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className={`h-4 w-4 ${riskInfo.color}`} />
            <span className={riskInfo.color}>{riskInfo.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            <span>Skills: {simulation.skillMatchPct}%</span>
          </div>
        </div>

        <div className="mt-3">
          <Progress 
            value={simulation.compositeScore} 
            className="h-1.5"
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default function JobsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedSimulation, setSelectedSimulation] = useState<Simulation | null>(null);

  const { data: jobs, isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: crews = [] } = useQuery<Crew[]>({
    queryKey: ["/api/ops/crews"],
  });

  const { data: simulations = [], isLoading: simulationsLoading, refetch: refetchSimulations } = useQuery<Simulation[]>({
    queryKey: ["/api/ops/simulations", selectedJob?.id],
    queryFn: async () => {
      if (!selectedJob?.id) return [];
      const res = await fetch(`/api/ops/simulations?jobRequestId=${selectedJob.id}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedJob?.id && assignDialogOpen,
  });

  const runSimulationMutation = useMutation({
    mutationFn: async (jobRequestId: number) => {
      const res = await apiRequest("POST", "/api/optimizer/simulate", { 
        jobRequestId,
        returnTopN: 3,
      });
      return res;
    },
    onSuccess: () => {
      refetchSimulations();
      toast({ title: "Crew recommendations generated" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to generate recommendations", description: err.message, variant: "destructive" });
    },
  });

  const createDecisionMutation = useMutation({
    mutationFn: async ({ jobRequestId, simulationId }: { jobRequestId: number; simulationId: number }) => {
      return await apiRequest("POST", "/api/optimizer/decide", { jobRequestId, simulationId });
    },
    onSuccess: (data: any) => {
      toast({ title: "Decision created", description: "Pending approval" });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox"] });
      setAssignDialogOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Failed to create decision", description: err.message, variant: "destructive" });
    },
  });

  const approveDecisionMutation = useMutation({
    mutationFn: async (decisionId: number) => {
      return await apiRequest("POST", "/api/optimizer/approve", { decisionId });
    },
    onSuccess: () => {
      toast({ title: "Assignment approved", description: "Job has been assigned to the crew" });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ops/schedule"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbox"] });
      setAssignDialogOpen(false);
      setDetailDrawerOpen(false);
    },
    onError: (err: any) => {
      if (err.message?.includes("not authorized")) {
        toast({ title: "Not authorized", description: "Only owners/admins can approve assignments", variant: "destructive" });
      } else {
        toast({ title: "Failed to approve", description: err.message, variant: "destructive" });
      }
    },
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
        setSelectedJob(job);
        setDetailDrawerOpen(true);
        break;
      case 'assign':
        setSelectedJob(job);
        setAssignDialogOpen(true);
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

  const handleSelectSimulation = (sim: Simulation) => {
    setSelectedSimulation(sim);
  };

  const handleApproveAssignment = () => {
    if (!selectedJob || !selectedSimulation) return;
    createDecisionMutation.mutate({
      jobRequestId: selectedJob.id,
      simulationId: selectedSimulation.id,
    });
  };

  const getCrewById = (crewId: number) => crews.find(c => c.id === crewId);

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

  const canApprove = user?.role === "OWNER" || user?.role === "ADMIN";

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
                    <div className="flex justify-between mb-3 gap-2">
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

      <Sheet open={detailDrawerOpen} onOpenChange={setDetailDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedJob && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Job Details
                </SheetTitle>
                <SheetDescription>
                  Job #{selectedJob.id}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Customer</h4>
                  <Card>
                    <CardContent className="p-4 space-y-2">
                      <div className="font-medium">{selectedJob.customerName}</div>
                      {selectedJob.customerPhone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          {selectedJob.customerPhone}
                        </div>
                      )}
                      {selectedJob.customerAddress && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          {selectedJob.customerAddress}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Service Details</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground">Type</div>
                      <div className="font-medium">{selectedJob.serviceType || "General"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Status</div>
                      <Badge variant="outline" className={`${statusConfig[selectedJob.status]?.color} ${statusConfig[selectedJob.status]?.bgColor} border-0`}>
                        {statusConfig[selectedJob.status]?.label || selectedJob.status}
                      </Badge>
                    </div>
                    {selectedJob.estimatedPrice && (
                      <div>
                        <div className="text-xs text-muted-foreground">Price</div>
                        <div className="font-medium text-green-600 dark:text-green-400">
                          ${(selectedJob.estimatedPrice / 100).toFixed(2)}
                        </div>
                      </div>
                    )}
                    {selectedJob.scheduledDate && (
                      <div>
                        <div className="text-xs text-muted-foreground">Scheduled</div>
                        <div className="font-medium">
                          {new Date(selectedJob.scheduledDate).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {selectedJob.notes && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium">Notes</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {selectedJob.notes}
                      </p>
                    </div>
                  </>
                )}

                <Separator />

                <div className="flex gap-2">
                  {selectedJob.status === 'pending' && (
                    <Button 
                      onClick={() => {
                        setDetailDrawerOpen(false);
                        setAssignDialogOpen(true);
                      }}
                      data-testid="button-assign-crew"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Assign Crew
                    </Button>
                  )}
                  {selectedJob.status === 'scheduled' && (
                    <Button 
                      onClick={() => handleAction(selectedJob, 'start')}
                      data-testid="button-start-job"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Start Job
                    </Button>
                  )}
                  {selectedJob.status === 'in_progress' && (
                    <Button 
                      onClick={() => handleAction(selectedJob, 'complete')}
                      data-testid="button-complete-job"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Complete
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Assign Crew
            </DialogTitle>
            <DialogDescription>
              {selectedJob ? `Select a crew for ${selectedJob.customerName}` : "Loading..."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {simulationsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : simulations.length === 0 ? (
              <div className="text-center py-6">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                  No crew recommendations available yet.
                </p>
                <Button
                  onClick={() => selectedJob && runSimulationMutation.mutate(selectedJob.id)}
                  disabled={runSimulationMutation.isPending}
                  data-testid="button-generate-recommendations"
                >
                  {runSimulationMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <TrendingUp className="h-4 w-4 mr-2" />
                  )}
                  Generate Recommendations
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-3">
                  {simulations.slice(0, 3).map((sim, idx) => (
                    <CrewRecommendationCard
                      key={sim.id}
                      simulation={sim}
                      crew={getCrewById(sim.crewId)}
                      isTop={idx === 0}
                      onSelect={() => handleSelectSimulation(sim)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {selectedSimulation && (
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>
                  Selected: <strong>{getCrewById(selectedSimulation.crewId)?.name || `Crew ${selectedSimulation.crewId}`}</strong>
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApproveAssignment}
              disabled={!selectedSimulation || createDecisionMutation.isPending}
              data-testid="button-approve-assign"
            >
              {createDecisionMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ThumbsUp className="h-4 w-4 mr-2" />
              )}
              {canApprove ? "Approve & Assign" : "Request Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
