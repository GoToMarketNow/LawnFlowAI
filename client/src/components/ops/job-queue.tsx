import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ClipboardList, 
  MapPin, 
  Clock, 
  Users,
  Play,
  ChevronRight,
} from "lucide-react";
import type { JobRequest } from "@shared/schema";

interface JobQueueProps {
  jobs: JobRequest[];
  isLoading: boolean;
  selectedJobId: number | null;
  onSelectJob: (job: JobRequest) => void;
  onRunSimulation: (jobId: number) => void;
  isSimulating: boolean;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Jobs" },
  { value: "new", label: "New" },
  { value: "simulated", label: "Simulated" },
  { value: "recommended", label: "Recommended" },
  { value: "assigned", label: "Assigned" },
];

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  triaged: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  simulated: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  recommended: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  assigned: "bg-green-500/10 text-green-700 dark:text-green-400",
  needs_review: "bg-red-500/10 text-red-700 dark:text-red-400",
};

function JobCard({ 
  job, 
  isSelected, 
  onSelect, 
  onRunSimulation,
  isSimulating,
}: { 
  job: JobRequest; 
  isSelected: boolean;
  onSelect: () => void;
  onRunSimulation: () => void;
  isSimulating: boolean;
}) {
  const services = Array.isArray(job.servicesJson) 
    ? (job.servicesJson as string[]).slice(0, 2)
    : [];
  
  return (
    <div
      className={`p-3 rounded-md border cursor-pointer transition-colors ${
        isSelected 
          ? "border-primary bg-primary/5" 
          : "border-border hover-elevate"
      }`}
      onClick={onSelect}
      data-testid={`card-job-${job.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">
              {job.customerName || `Job #${job.id}`}
            </span>
            <Badge 
              variant="secondary" 
              className={`text-xs ${STATUS_COLORS[job.status] || ""}`}
            >
              {job.status}
            </Badge>
          </div>
          
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span className="truncate">{job.address || "No address"}</span>
          </div>
          
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            {job.laborHighMinutes && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {job.laborHighMinutes} min
              </span>
            )}
            {job.crewSizeMin && job.crewSizeMin > 1 && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {job.crewSizeMin}+ crew
              </span>
            )}
          </div>
          
          {services.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {services.map((service, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {service}
                </Badge>
              ))}
            </div>
          )}
        </div>
        
        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${
          isSelected ? "rotate-90" : ""
        }`} />
      </div>
      
      {isSelected && (job.status === "new" || job.status === "triaged") && (
        <div className="mt-3 pt-3 border-t">
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onRunSimulation();
            }}
            disabled={isSimulating}
            data-testid={`button-simulate-${job.id}`}
          >
            <Play className="h-3 w-3 mr-1" />
            {isSimulating ? "Simulating..." : "Run Simulation"}
          </Button>
        </div>
      )}
    </div>
  );
}

export function JobQueue({
  jobs,
  isLoading,
  selectedJobId,
  onSelectJob,
  onRunSimulation,
  isSimulating,
  statusFilter,
  onStatusFilterChange,
}: JobQueueProps) {
  const filteredJobs = statusFilter === "all" 
    ? jobs 
    : jobs.filter(j => j.status === statusFilter);
  
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          Jobs Queue
          <Badge variant="secondary" className="ml-1">
            {filteredJobs.length}
          </Badge>
        </CardTitle>
        
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-[130px]" data-testid="select-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      
      <CardContent className="flex-1 p-2 overflow-hidden">
        <ScrollArea className="h-full pr-2">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <ClipboardList className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No jobs found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredJobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  isSelected={selectedJobId === job.id}
                  onSelect={() => onSelectJob(job)}
                  onRunSimulation={() => onRunSimulation(job.id)}
                  isSimulating={isSimulating}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
