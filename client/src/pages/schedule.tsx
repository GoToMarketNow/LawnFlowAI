import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  Users,
  Truck,
  RefreshCw,
  AlertCircle,
  LayoutGrid,
  List,
} from "lucide-react";
import { format, addDays, startOfWeek, isSameDay, parseISO, addWeeks, subWeeks } from "date-fns";
import { jobStatuses, type JobStatus } from "@/lib/ui/tokens";

interface Crew {
  id: number;
  name: string;
  dailyCapacityMinutes: number;
  skillsJson: string[];
  isActive: boolean;
}

interface ScheduleItem {
  id: number;
  crewId: number | null;
  startAt: string;
  endAt: string;
  address: string | null;
  description: string | null;
  status: string;
  jobRequestId: number | null;
}

interface ScheduledJob {
  id: number;
  customerName: string;
  customerAddress: string;
  serviceType: string;
  scheduledDate: string;
  estimatedDuration: number;
  crewId?: number;
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
      <Skeleton className="h-12 w-full mb-2" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

type ViewMode = "week" | "day-plan";

export default function SchedulePage() {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [selectedCrew, setSelectedCrew] = useState<string>("all");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [dayDrawerOpen, setDayDrawerOpen] = useState(false);
  const [dayPlanDate, setDayPlanDate] = useState<Date>(new Date());
  
  const weekDays = getWeekDays(weekStart);

  const { data: crews = [], isLoading: crewsLoading } = useQuery<Crew[]>({
    queryKey: ["/api/ops/crews"],
  });

  const { data: scheduleItems = [], isLoading: scheduleLoading, refetch } = useQuery<ScheduleItem[]>({
    queryKey: ["/api/ops/schedule", selectedCrew],
    queryFn: async () => {
      const url = selectedCrew !== "all" 
        ? `/api/ops/schedule?crewId=${selectedCrew}` 
        : "/api/ops/schedule";
      const res = await fetch(url);
      return res.json();
    },
  });

  const { data: jobsData = [] } = useQuery<any[]>({
    queryKey: ["/api/jobs"],
  });

  const scheduledJobs: ScheduledJob[] = (Array.isArray(jobsData) ? jobsData : [])
    .filter((job: any) => job.scheduledDate)
    .map((job: any) => ({
      id: job.id,
      customerName: job.customerName || "Unknown Customer",
      customerAddress: job.customerAddress || job.address || "",
      serviceType: job.serviceType || "Service",
      scheduledDate: job.scheduledDate,
      estimatedDuration: job.estimatedDuration || 60,
      crewId: job.crewId,
      crewName: job.crewName,
      status: job.status || "scheduled",
    }));

  const getCrewById = (crewId: number | null | undefined) => {
    if (!crewId) return null;
    return crews.find(c => c.id === crewId);
  };

  const getItemsForDay = (day: Date) => {
    const jobsOnDay = scheduledJobs.filter((job) => {
      const jobDate = new Date(job.scheduledDate);
      const matchesCrew = selectedCrew === "all" || job.crewId?.toString() === selectedCrew;
      return isSameDay(jobDate, day) && matchesCrew;
    });

    const scheduleOnDay = scheduleItems.filter(item => {
      const itemDate = parseISO(item.startAt);
      return isSameDay(itemDate, day);
    });

    return { jobs: jobsOnDay, scheduleItems: scheduleOnDay };
  };

  const calculateDayCapacity = (day: Date) => {
    const { jobs, scheduleItems: items } = getItemsForDay(day);
    
    let totalMinutes = 0;
    jobs.forEach(job => {
      totalMinutes += job.estimatedDuration || 60;
    });
    items.forEach(item => {
      const start = parseISO(item.startAt);
      const end = parseISO(item.endAt);
      totalMinutes += (end.getTime() - start.getTime()) / (1000 * 60);
    });
    
    const activeCrews = selectedCrew === "all" 
      ? crews.filter(c => c.isActive)
      : crews.filter(c => c.id.toString() === selectedCrew && c.isActive);
    
    const totalCapacity = activeCrews.reduce((sum, c) => sum + (c.dailyCapacityMinutes || 420), 0);
    
    return {
      used: Math.round(totalMinutes),
      total: totalCapacity || 420,
      percentage: totalCapacity > 0 ? Math.min(100, Math.round((totalMinutes / totalCapacity) * 100)) : 0,
    };
  };

  const openDayDetail = (day: Date) => {
    setSelectedDay(day);
    setDayDrawerOpen(true);
  };

  const isToday = (date: Date) => isSameDay(date, new Date());

  const DayColumn = ({ day }: { day: Date }) => {
    const { jobs, scheduleItems: items } = getItemsForDay(day);
    const allItems = [...jobs.map(j => ({ type: 'job' as const, data: j })), ...items.map(i => ({ type: 'schedule' as const, data: i }))];
    const isCurrentDay = isToday(day);
    const capacity = calculateDayCapacity(day);

    return (
      <div 
        className={`flex-1 min-w-0 border-r last:border-r-0 hover-elevate cursor-pointer flex flex-col ${isCurrentDay ? "bg-primary/5" : ""}`}
        onClick={() => openDayDetail(day)}
        data-testid={`schedule-day-${format(day, "yyyy-MM-dd")}`}
      >
        <div className={`p-2 border-b text-center ${isCurrentDay ? "bg-primary/10" : "bg-muted/30"}`}>
          <div className="text-xs text-muted-foreground">{format(day, "EEE")}</div>
          <div className={`text-lg font-medium ${isCurrentDay ? "text-primary" : ""}`}>
            {format(day, "d")}
          </div>
        </div>
        
        <div className="p-2 flex-1 min-h-[180px]">
          {allItems.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              No jobs
            </div>
          ) : (
            <div className="space-y-1">
              {allItems.slice(0, 4).map((item, idx) => (
                <div 
                  key={idx} 
                  className="text-xs p-1.5 rounded bg-primary/10 truncate"
                >
                  <div className="font-medium truncate">
                    {item.type === 'job' 
                      ? format(new Date(item.data.scheduledDate), "h:mm a")
                      : format(parseISO((item.data as ScheduleItem).startAt), "h:mm a")
                    }
                  </div>
                  <div className="text-muted-foreground truncate">
                    {item.type === 'job' 
                      ? (item.data as ScheduledJob).customerName
                      : (item.data as ScheduleItem).description || "Scheduled"
                    }
                  </div>
                </div>
              ))}
              {allItems.length > 4 && (
                <div className="text-xs text-muted-foreground text-center">
                  +{allItems.length - 4} more
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-2 border-t bg-muted/20">
          <div className="text-xs text-muted-foreground mb-1">Capacity</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${
                  capacity.percentage > 90 ? "bg-red-500" : 
                  capacity.percentage > 70 ? "bg-amber-500" : "bg-green-500"
                }`}
                style={{ width: `${capacity.percentage}%` }}
              />
            </div>
            <span className="text-xs font-medium w-8 text-right">{capacity.percentage}%</span>
          </div>
        </div>
      </div>
    );
  };

  const getJobsForDate = (date: Date) => {
    return scheduledJobs.filter((job) => {
      const jobDate = new Date(job.scheduledDate);
      return isSameDay(jobDate, date);
    });
  };

  const DayPlanView = () => {
    const activeCrews = crews.filter(c => c.isActive);
    const jobsToday = getJobsForDate(dayPlanDate);
    const hourSlots = Array.from({ length: 12 }, (_, i) => i + 6);

    const getCrewJobs = (crewId: number) => {
      return jobsToday
        .filter(j => j.crewId === crewId)
        .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
    };

    const getUnassignedJobs = () => {
      return jobsToday.filter(j => !j.crewId);
    };

    const getJobPosition = (job: ScheduledJob) => {
      const jobDate = new Date(job.scheduledDate);
      const hour = jobDate.getHours();
      const minutes = jobDate.getMinutes();
      const startHour = 6;
      const endHour = 18;
      const totalSlots = endHour - startHour;
      
      const rawLeft = ((hour - startHour) + minutes / 60) * (100 / totalSlots);
      const left = Math.max(0, Math.min(100, rawLeft));
      
      const rawWidth = Math.max(8, (job.estimatedDuration / 60) * (100 / totalSlots));
      const maxWidth = 100 - left;
      const width = Math.max(0, Math.min(maxWidth, rawWidth));
      
      const isOutsideHours = hour < startHour || hour >= endHour;
      
      return { 
        left: `${left}%`, 
        width: width > 0 ? `${width}%` : '8%',
        isOutsideHours 
      };
    };

    const getJobStatus = (status: string): { color: string; label: string } => {
      const statusConfig = jobStatuses[status as JobStatus] || jobStatuses.scheduled;
      return { color: statusConfig.color, label: statusConfig.label };
    };

    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-3 border-b bg-muted/30">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDayPlanDate(addDays(dayPlanDate, -1))}
            data-testid="button-prev-day"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          <div className="font-medium">
            {format(dayPlanDate, "EEEE, MMMM d, yyyy")}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setDayPlanDate(addDays(dayPlanDate, 1))}
            data-testid="button-next-day"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            <div className="flex border-b pb-2">
              <div className="w-32 shrink-0" />
              <div className="flex-1 flex">
                {hourSlots.map(hour => (
                  <div key={hour} className="flex-1 text-xs text-muted-foreground text-center border-l first:border-l-0">
                    {hour > 12 ? `${hour - 12}pm` : hour === 12 ? '12pm' : `${hour}am`}
                  </div>
                ))}
              </div>
            </div>

            {activeCrews.map(crew => {
              const crewJobs = getCrewJobs(crew.id);
              const totalMinutes = crewJobs.reduce((sum, j) => sum + (j.estimatedDuration || 60), 0);
              const utilization = Math.round((totalMinutes / (crew.dailyCapacityMinutes || 420)) * 100);
              
              return (
                <div key={crew.id} className="flex items-stretch border rounded-md overflow-hidden" data-testid={`dayplan-crew-${crew.id}`}>
                  <div className="w-32 shrink-0 p-3 bg-muted/30 border-r">
                    <div className="font-medium text-sm truncate">{crew.name}</div>
                    <div className="flex items-center gap-1 mt-1">
                      <Badge 
                        variant={utilization > 90 ? "destructive" : utilization > 70 ? "secondary" : "outline"} 
                        className="text-xs"
                      >
                        {utilization}%
                      </Badge>
                      <span className="text-xs text-muted-foreground">{crewJobs.length} jobs</span>
                    </div>
                  </div>
                  <div className="flex-1 relative h-16 bg-muted/10">
                    <div className="absolute inset-0 flex">
                      {hourSlots.map((_, i) => (
                        <div key={i} className="flex-1 border-l first:border-l-0 border-dashed border-muted" />
                      ))}
                    </div>
                    {crewJobs.map((job, idx) => {
                      const pos = getJobPosition(job);
                      const status = getJobStatus(job.status);
                      return (
                        <div
                          key={job.id}
                          className="absolute top-1 h-14 rounded px-2 py-1 text-xs overflow-hidden cursor-pointer hover-elevate"
                          style={{ 
                            left: pos.left, 
                            width: pos.width,
                            backgroundColor: `hsl(var(--primary) / 0.15)`,
                            borderLeft: `3px solid hsl(var(--primary))`
                          }}
                          title={`${job.customerName} - ${format(new Date(job.scheduledDate), "h:mm a")} (${job.estimatedDuration}min)`}
                          data-testid={`dayplan-job-${job.id}`}
                        >
                          <div className="font-medium truncate">{job.customerName}</div>
                          <div className="text-muted-foreground truncate">
                            {format(new Date(job.scheduledDate), "h:mm a")} - {job.serviceType}
                          </div>
                        </div>
                      );
                    })}
                    {crewJobs.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                        No jobs scheduled
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {getUnassignedJobs().length > 0 && (
              <div className="border rounded-md overflow-hidden">
                <div className="p-3 bg-amber-500/10 border-b flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <span className="font-medium text-sm">Unassigned Jobs ({getUnassignedJobs().length})</span>
                </div>
                <div className="p-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {getUnassignedJobs().map(job => (
                    <Card key={job.id} className="hover-elevate" data-testid={`dayplan-unassigned-${job.id}`}>
                      <CardContent className="p-3">
                        <div className="font-medium text-sm truncate">{job.customerName}</div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(new Date(job.scheduledDate), "h:mm a")}
                          <span>({job.estimatedDuration}min)</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{job.customerAddress || "No address"}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {activeCrews.length === 0 && (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium">No active crews</h3>
                <p className="text-sm text-muted-foreground">
                  Add crews in Settings to start scheduling.
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    );
  };

  const DayDetailDrawer = () => {
    if (!selectedDay) return null;
    const { jobs, scheduleItems: items } = getItemsForDay(selectedDay);
    const capacity = calculateDayCapacity(selectedDay);
    const allItems = [...jobs, ...items.map(i => ({
      id: i.id,
      customerName: i.description || "Scheduled Item",
      customerAddress: i.address || "",
      serviceType: "",
      scheduledDate: i.startAt,
      estimatedDuration: Math.round((parseISO(i.endAt).getTime() - parseISO(i.startAt).getTime()) / (1000 * 60)),
      crewId: i.crewId,
      status: i.status,
    }))];

    return (
      <Sheet open={dayDrawerOpen} onOpenChange={setDayDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {format(selectedDay, "EEEE, MMMM d, yyyy")}
            </SheetTitle>
            <SheetDescription>
              {allItems.length} item{allItems.length !== 1 ? "s" : ""} scheduled
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Capacity Utilization
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Progress 
                  value={capacity.percentage} 
                  className={`h-2 ${
                    capacity.percentage > 90 ? "[&>div]:bg-red-500" : 
                    capacity.percentage > 70 ? "[&>div]:bg-amber-500" : "[&>div]:bg-green-500"
                  }`}
                />
                <div className="flex justify-between mt-2 text-sm">
                  <span className="text-muted-foreground">
                    {capacity.used} min used
                  </span>
                  <span className="font-medium">{capacity.percentage}%</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {capacity.total} min total capacity
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Assignments
              </h4>
              {allItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No jobs scheduled for this day.</p>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-3 pr-4">
                    {allItems.map((item, idx) => {
                      const crew = getCrewById(item.crewId);
                      return (
                        <Card key={idx} data-testid={`schedule-item-${item.id}`}>
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{item.customerName}</div>
                                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(item.scheduledDate), "h:mm a")}
                                  <span>({item.estimatedDuration} min)</span>
                                </div>
                                {item.customerAddress && (
                                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                                    <MapPin className="h-3 w-3" />
                                    <span className="truncate">{item.customerAddress}</span>
                                  </div>
                                )}
                              </div>
                              <Badge variant="secondary" className="text-xs shrink-0">
                                {item.status}
                              </Badge>
                            </div>
                            {crew && (
                              <div className="flex items-center gap-2 mt-2 pt-2 border-t text-xs">
                                <Users className="h-3 w-3 text-muted-foreground" />
                                <span>{crew.name}</span>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Route Overview
              </h4>
              {allItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No route for this day.</p>
              ) : (
                <div className="space-y-2">
                  {allItems
                    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
                    .map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-sm">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium shrink-0">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-medium">{item.customerName}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {item.customerAddress || "Location not specified"}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground shrink-0">
                          {format(new Date(item.scheduledDate), "h:mm a")}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  };

  const isLoading = crewsLoading || scheduleLoading;

  return (
    <div className="h-full flex flex-col">
      <div className="border-b p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              Schedule
            </h1>
            <p className="text-sm text-muted-foreground">
              Week of {format(weekStart, "MMM d, yyyy")}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <TabsList>
                <TabsTrigger value="week" data-testid="button-view-week">
                  <LayoutGrid className="h-4 w-4 mr-1" />
                  Week
                </TabsTrigger>
                <TabsTrigger value="day-plan" data-testid="button-view-dayplan">
                  <List className="h-4 w-4 mr-1" />
                  Day Plan
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {viewMode === "week" && (
              <Select value={selectedCrew} onValueChange={setSelectedCrew}>
                <SelectTrigger className="w-40" data-testid="select-crew-filter">
                  <SelectValue placeholder="All Crews" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Crews</SelectItem>
                  {crews.filter(c => c.isActive).map(crew => (
                    <SelectItem key={crew.id} value={crew.id.toString()}>
                      {crew.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              data-testid="button-refresh-schedule"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {viewMode === "week" && (
        <div className="flex items-center justify-between p-3 border-b bg-muted/30">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekStart(subWeeks(weekStart, 1))}
            data-testid="button-prev-week"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            data-testid="button-today"
          >
            Today
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekStart(addWeeks(weekStart, 1))}
            data-testid="button-next-week"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {viewMode === "day-plan" ? (
        <DayPlanView />
      ) : isLoading ? (
        <div className="flex-1 grid grid-cols-7 gap-0 border-t overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="border-r last:border-r-0 p-2">
              <DaySkeleton />
            </div>
          ))}
        </div>
      ) : crews.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-medium">No crews configured</h3>
          <p className="text-sm text-muted-foreground">
            Add crews in Settings to start scheduling.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex border-t overflow-x-auto">
          {weekDays.map(day => (
            <DayColumn key={day.toISOString()} day={day} />
          ))}
        </div>
      )}

      <DayDetailDrawer />
    </div>
  );
}
