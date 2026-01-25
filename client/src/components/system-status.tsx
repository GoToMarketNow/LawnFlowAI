import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { Activity, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  activeAgents: number;
  totalAgents: number;
  lastCheck: string;
}

export function SystemStatus() {
  const { data: health, isLoading } = useQuery<SystemHealth>({
    queryKey: ["/api/system/health"],
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const status = health?.status || 'healthy';
  const activeAgents = health?.activeAgents || 0;
  const totalAgents = health?.totalAgents || 0;

  const statusConfig = {
    healthy: { 
      icon: CheckCircle2, 
      color: 'text-green-500', 
      bgColor: 'bg-green-500',
      label: 'All systems operational' 
    },
    degraded: { 
      icon: AlertCircle, 
      color: 'text-yellow-500', 
      bgColor: 'bg-yellow-500',
      label: 'Some systems degraded' 
    },
    down: { 
      icon: AlertCircle, 
      color: 'text-red-500', 
      bgColor: 'bg-red-500',
      label: 'System issues detected' 
    },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Checking...</span>
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div 
          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover-elevate cursor-default"
          data-testid="system-status-indicator"
        >
          <div className="flex items-center gap-1.5">
            <span className={`relative flex h-2 w-2`}>
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.bgColor} opacity-75`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${config.bgColor}`} />
            </span>
            <span className="text-xs text-muted-foreground">System</span>
          </div>
          <Badge variant="outline" className="text-xs h-5 px-1.5">
            {activeAgents}/{totalAgents}
          </Badge>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" align="start">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${config.color}`} />
            <span className="font-medium">{config.label}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {activeAgents} of {totalAgents} agents active
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function SystemStatusCompact() {
  const { data: health } = useQuery<SystemHealth>({
    queryKey: ["/api/system/health"],
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const status = health?.status || 'healthy';

  const bgColor = {
    healthy: 'bg-green-500',
    degraded: 'bg-yellow-500',
    down: 'bg-red-500',
  }[status];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 cursor-default">
          <span className={`relative flex h-2 w-2`}>
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${bgColor} opacity-75`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${bgColor}`} />
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">
        <span className="text-xs">
          {status === 'healthy' ? 'All systems operational' : 
           status === 'degraded' ? 'Some systems degraded' : 
           'System issues detected'}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
