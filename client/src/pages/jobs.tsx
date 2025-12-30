import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Job } from "@shared/schema";

const statusConfig: Record<
  string,
  { color: string; icon: React.ReactNode; label: string }
> = {
  pending: {
    color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
    icon: <Clock className="h-3 w-3" />,
    label: "Pending",
  },
  scheduled: {
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    icon: <Calendar className="h-3 w-3" />,
    label: "Scheduled",
  },
  in_progress: {
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
    icon: <Loader2 className="h-3 w-3" />,
    label: "In Progress",
  },
  completed: {
    color: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800",
    icon: <CheckCircle2 className="h-3 w-3" />,
    label: "Completed",
  },
  cancelled: {
    color: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700",
    icon: <XCircle className="h-3 w-3" />,
    label: "Cancelled",
  },
};

function JobCard({ job }: { job: Job }) {
  const status = statusConfig[job.status] || statusConfig.pending;

  return (
    <Card data-testid={`card-job-${job.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h3 className="text-sm font-medium">{job.customerName}</h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Phone className="h-3 w-3" />
              {job.customerPhone}
            </p>
          </div>
          <Badge variant="outline" className={status.color}>
            {status.icon}
            <span className="ml-1">{status.label}</span>
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{job.serviceType}</span>
          </div>

          {job.customerAddress && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{job.customerAddress}</span>
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

          {job.notes && (
            <p className="text-xs text-muted-foreground mt-2 p-2 bg-muted/50 rounded">
              {job.notes}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function JobsPage() {
  const { data: jobs, isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const pendingJobs = jobs?.filter((j) => j.status === "pending") || [];
  const scheduledJobs = jobs?.filter((j) => j.status === "scheduled") || [];
  const completedJobs = jobs?.filter(
    (j) => j.status === "completed" || j.status === "cancelled"
  ) || [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          Jobs
        </h1>
        <p className="text-sm text-muted-foreground">
          View and manage scheduled landscaping jobs
        </p>
      </div>

      <div className="grid gap-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-medium">Pending</h2>
            <Badge variant="secondary">{pendingJobs.length}</Badge>
          </div>
          {isLoading ? (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2].map((i) => (
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
          ) : pendingJobs.length > 0 ? (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {pendingJobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <Clock className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  No pending jobs
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-medium">Scheduled</h2>
            <Badge variant="secondary">{scheduledJobs.length}</Badge>
          </div>
          {isLoading ? (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-24 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : scheduledJobs.length > 0 ? (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {scheduledJobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <Calendar className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">
                  No scheduled jobs yet
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {completedJobs.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-medium text-muted-foreground">
                Completed / Cancelled
              </h2>
              <Badge variant="outline">{completedJobs.length}</Badge>
            </div>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 opacity-60">
              {completedJobs.slice(0, 6).map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
