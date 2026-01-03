import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  User,
} from "lucide-react";
import { useState } from "react";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { jobStatuses, type JobStatus } from "@/lib/ui/tokens";

interface ScheduledJob {
  id: number;
  customerName: string;
  address: string;
  serviceType: string;
  scheduledTime: string;
  estimatedDuration: number;
  crewName?: string;
  status: string;
}

function getWeekDays(date: Date): Date[] {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

function DaySkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-20 mb-2" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

export default function SchedulePage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"week" | "day">("week");
  
  const weekDays = getWeekDays(selectedDate);

  const { data: jobsData, isLoading } = useQuery<any[]>({
    queryKey: ["/api/jobs"],
  });

  const scheduledJobs: ScheduledJob[] = (Array.isArray(jobsData) ? jobsData : [])
    .filter((job: any) => job.scheduledDate)
    .map((job: any) => ({
      id: job.id,
      customerName: job.customerName || "Unknown Customer",
      address: job.address || job.propertyAddress || "",
      serviceType: job.services?.[0] || "Service",
      scheduledTime: job.scheduledDate,
      estimatedDuration: job.estimatedDuration || 60,
      crewName: job.crewName,
      status: job.status || "scheduled",
    }));

  const getJobsForDate = (date: Date) => {
    return scheduledJobs.filter((job) => {
      const jobDate = new Date(job.scheduledTime);
      return isSameDay(jobDate, date);
    });
  };

  const navigateWeek = (direction: "prev" | "next") => {
    setSelectedDate((current) => addDays(current, direction === "next" ? 7 : -7));
  };

  const isToday = (date: Date) => isSameDay(date, new Date());

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Schedule</h1>
          <p className="text-sm text-muted-foreground">
            {format(weekDays[0], "MMM d")} - {format(weekDays[6], "MMM d, yyyy")}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateWeek("prev")}
            data-testid="button-prev-week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => setSelectedDate(new Date())}
            data-testid="button-today"
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateWeek("next")}
            data-testid="button-next-week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-7 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <DaySkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-4">
          {weekDays.map((day) => {
            const dayJobs = getJobsForDate(day);
            const isCurrentDay = isToday(day);
            
            return (
              <div key={day.toISOString()} className="min-h-[300px]">
                <div
                  className={`text-sm font-medium mb-2 p-2 rounded-md text-center ${
                    isCurrentDay
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  <div>{format(day, "EEE")}</div>
                  <div className="text-lg">{format(day, "d")}</div>
                </div>
                
                <div className="space-y-2">
                  {dayJobs.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-4">
                      No jobs
                    </div>
                  ) : (
                    dayJobs.map((job) => {
                      const statusConfig = jobStatuses[job.status as JobStatus] || jobStatuses.scheduled;
                      return (
                        <Card
                          key={job.id}
                          className="hover-elevate cursor-pointer"
                          data-testid={`schedule-job-${job.id}`}
                        >
                          <CardContent className="p-2">
                            <div className="text-xs font-medium truncate mb-1">
                              {job.customerName}
                            </div>
                            <div className="text-xs text-muted-foreground truncate mb-1">
                              {job.serviceType}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {format(new Date(job.scheduledTime), "h:mm a")}
                            </div>
                            {job.crewName && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <User className="h-3 w-3" />
                                {job.crewName}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {scheduledJobs.length === 0 && !isLoading && (
        <Card className="mt-6">
          <CardContent className="p-12 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No scheduled jobs</h3>
            <p className="text-sm text-muted-foreground">
              Jobs will appear here once they are scheduled with customers.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
