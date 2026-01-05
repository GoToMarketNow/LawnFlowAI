import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Radio,
  Search,
  Play,
  Pause,
  Mail,
  MessageSquare,
  Bell,
  Smartphone,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  Users,
  Megaphone,
  Calendar,
  Zap,
  Filter,
  Eye,
  RefreshCw,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { RoleGate } from "@/components/role-gate";

interface CommsAutomation {
  id: number;
  name: string;
  description: string | null;
  audienceType: string;
  automationType: string;
  triggerType: string;
  triggerEventName: string | null;
  scheduleJson: { cron?: string; delayMinutes?: number } | null;
  state: string;
  channelsJson: string[];
  languageMode: string;
  templateSetId: number | null;
  filtersJson: object | null;
  metrics: { sent7d: number; delivered7d: number; failed7d: number };
  lastRunAt: string | null;
  createdAt: string;
}

interface CommsTemplateSet {
  id: number;
  code: string;
  name: string;
  language: string;
  channel: string;
  subjectLine: string | null;
  bodyDefault: string;
  bodyShort: string | null;
  bodyFollowup: string | null;
  tokensJson: string[];
  createdAt: string;
}

interface CommsDeliveryLog {
  id: number;
  automationId: number | null;
  audienceId: number;
  audienceType: string;
  channel: string;
  externalId: string | null;
  status: string;
  errorMessage: string | null;
  renderedBody: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

const automationTypeLabels: Record<string, string> = {
  LEAD_QUALIFICATION: "Lead Qualification",
  QUOTE_FOLLOWUP: "Quote Follow-up",
  APPOINTMENT_REMINDER: "Appointment Reminder",
  REVIEW_REQUEST: "Review Request",
  RETENTION_NUDGE: "Retention Nudge",
  CREW_DAILY_BRIEFING: "Crew Daily Briefing",
  CREW_SCHEDULE_CHANGE: "Crew Schedule Change",
  CREW_NEW_JOB_ADDED: "Crew New Job Added",
  CREW_SCOPE_CHANGE: "Crew Scope Change",
  CUSTOM: "Custom",
};

const audienceTypeLabels: Record<string, string> = {
  CUSTOMER: "Customers",
  LEAD: "Leads",
  CREW: "Crew Members",
};

const triggerTypeIcons: Record<string, typeof Zap> = {
  EVENT: Zap,
  SCHEDULED: Calendar,
  MANUAL: Megaphone,
};

const channelIcons: Record<string, typeof MessageSquare> = {
  SMS: Smartphone,
  EMAIL: Mail,
  IN_APP: Bell,
  PUSH: Megaphone,
};

const statusColors: Record<string, string> = {
  QUEUED: "secondary",
  SENT: "default",
  DELIVERED: "default",
  FAILED: "destructive",
  ACKED: "default",
};

function AutomationCard({
  automation,
  onToggle,
  onView,
}: {
  automation: CommsAutomation;
  onToggle: (id: number, newState: string) => void;
  onView: (automation: CommsAutomation) => void;
}) {
  const TriggerIcon = triggerTypeIcons[automation.triggerType] || Zap;
  const isActive = automation.state === "ACTIVE";
  const isPaused = automation.state === "PAUSED";

  return (
    <Card 
      className="hover-elevate cursor-pointer" 
      onClick={() => onView(automation)}
      data-testid={`card-automation-${automation.id}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base truncate">{automation.name}</CardTitle>
            <CardDescription className="text-xs mt-1 line-clamp-2">
              {automation.description || "No description"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={isActive ? "default" : isPaused ? "secondary" : "outline"}>
              {automation.state}
            </Badge>
            <Switch
              checked={isActive}
              onClick={(e) => {
                e.stopPropagation();
                onToggle(automation.id, isActive ? "PAUSED" : "ACTIVE");
              }}
              data-testid={`switch-automation-${automation.id}`}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">
            <TriggerIcon className="h-3 w-3 mr-1" />
            {automation.triggerType}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {audienceTypeLabels[automation.audienceType] || automation.audienceType}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {automationTypeLabels[automation.automationType] || automation.automationType}
          </Badge>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {automation.channelsJson.map((channel) => {
            const Icon = channelIcons[channel] || MessageSquare;
            return (
              <Badge key={channel} variant="secondary" className="text-xs">
                <Icon className="h-3 w-3 mr-1" />
                {channel}
              </Badge>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            7d: {automation.metrics?.sent7d || 0} sent, {automation.metrics?.delivered7d || 0} delivered
          </span>
          {automation.lastRunAt && (
            <span>Last: {format(new Date(automation.lastRunAt), "MMM d, HH:mm")}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function DeliveryLogRow({ log }: { log: CommsDeliveryLog }) {
  const ChannelIcon = channelIcons[log.channel] || MessageSquare;
  const statusVariant = statusColors[log.status] || "secondary";

  return (
    <div 
      className="flex items-center gap-4 p-3 border-b last:border-b-0"
      data-testid={`row-delivery-${log.id}`}
    >
      <div className="p-2 rounded-md bg-muted shrink-0">
        <ChannelIcon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">
            {audienceTypeLabels[log.audienceType] || log.audienceType} #{log.audienceId}
          </span>
          <Badge variant={statusVariant as "default" | "secondary" | "destructive" | "outline"} className="text-xs">
            {log.status}
          </Badge>
        </div>
        {log.renderedBody && (
          <p className="text-xs text-muted-foreground line-clamp-1">{log.renderedBody}</p>
        )}
        {log.errorMessage && (
          <p className="text-xs text-destructive">{log.errorMessage}</p>
        )}
      </div>
      <div className="text-xs text-muted-foreground shrink-0">
        {log.sentAt ? format(new Date(log.sentAt), "MMM d, HH:mm") : format(new Date(log.createdAt), "MMM d, HH:mm")}
      </div>
    </div>
  );
}

function AutomationDetailDialog({
  automation,
  templateSets,
  open,
  onOpenChange,
}: {
  automation: CommsAutomation | null;
  templateSets: CommsTemplateSet[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!automation) return null;

  const linkedTemplates = templateSets.filter(
    (t) => t.id === automation.templateSetId
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {automation.name}
            <Badge variant={automation.state === "ACTIVE" ? "default" : "secondary"}>
              {automation.state}
            </Badge>
          </DialogTitle>
          <DialogDescription>{automation.description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Audience</p>
              <p className="text-sm font-medium">{audienceTypeLabels[automation.audienceType]}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Type</p>
              <p className="text-sm font-medium">{automationTypeLabels[automation.automationType]}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Trigger</p>
              <p className="text-sm font-medium">
                {automation.triggerType}
                {automation.triggerEventName && ` (${automation.triggerEventName})`}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Language Mode</p>
              <p className="text-sm font-medium">{automation.languageMode}</p>
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">Channels</p>
            <div className="flex gap-2 flex-wrap">
              {automation.channelsJson.map((channel) => {
                const Icon = channelIcons[channel] || MessageSquare;
                return (
                  <Badge key={channel} variant="secondary">
                    <Icon className="h-3 w-3 mr-1" />
                    {channel}
                  </Badge>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">7-Day Metrics</p>
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-semibold">{automation.metrics?.sent7d || 0}</p>
                  <p className="text-xs text-muted-foreground">Sent</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-semibold">{automation.metrics?.delivered7d || 0}</p>
                  <p className="text-xs text-muted-foreground">Delivered</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-semibold">{automation.metrics?.failed7d || 0}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {linkedTemplates.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Linked Templates</p>
              <div className="space-y-2">
                {linkedTemplates.map((template) => (
                  <Card key={template.id}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-sm font-medium">{template.name}</span>
                        <div className="flex gap-1">
                          <Badge variant="outline" className="text-xs">{template.language}</Badge>
                          <Badge variant="outline" className="text-xs">{template.channel}</Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground bg-muted p-2 rounded font-mono line-clamp-3">
                        {template.bodyDefault}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function SettingsCommsStudioPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [audienceFilter, setAudienceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedAutomation, setSelectedAutomation] = useState<CommsAutomation | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: automations, isLoading: loadingAutomations } = useQuery<CommsAutomation[]>({
    queryKey: ["/api/comms/automations"],
    staleTime: 30000,
  });

  const { data: templateSets, isLoading: loadingTemplates } = useQuery<CommsTemplateSet[]>({
    queryKey: ["/api/comms/template-sets"],
    staleTime: 60000,
  });

  const { data: deliveryLogs, isLoading: loadingLogs, refetch: refetchLogs } = useQuery<CommsDeliveryLog[]>({
    queryKey: ["/api/comms/delivery-logs", { limit: 50 }],
    staleTime: 15000,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, state }: { id: number; state: string }) => {
      return apiRequest("PATCH", `/api/comms/automations/${id}`, { state });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/comms/automations"] });
      toast({
        title: "Automation updated",
        description: "The automation state has been changed.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update automation.",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (id: number, newState: string) => {
    toggleMutation.mutate({ id, state: newState });
  };

  const handleViewAutomation = (automation: CommsAutomation) => {
    setSelectedAutomation(automation);
    setDetailOpen(true);
  };

  const filteredAutomations = (automations || []).filter((a) => {
    if (searchQuery && !a.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (audienceFilter !== "all" && a.audienceType !== audienceFilter) {
      return false;
    }
    return true;
  });

  const filteredLogs = (deliveryLogs || []).filter((log) => {
    if (statusFilter !== "all" && log.status !== statusFilter) {
      return false;
    }
    return true;
  });

  return (
    <RoleGate 
      allowedRoles={["OWNER", "ADMIN"]} 
      fallback={
        <div className="p-6 max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-12 text-center">
              <Radio className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Access Restricted</h3>
              <p className="text-sm text-muted-foreground">
                Comms Studio is only available to owners and administrators.
              </p>
            </CardContent>
          </Card>
        </div>
      }
    >
      <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Radio className="h-6 w-6" />
            Comms Studio
          </h1>
          <p className="text-muted-foreground">
            Manage automated communications for customers, leads, and crew
          </p>
        </div>
        <a href="/settings/active-comms">
          <Button variant="default" data-testid="button-active-comms">
            <MessageSquare className="h-4 w-4 mr-2" />
            Active Comms
          </Button>
        </a>
      </div>

      <Tabs defaultValue="studio" className="space-y-6">
        <TabsList>
          <TabsTrigger value="studio" data-testid="tab-studio">
            <Megaphone className="h-4 w-4 mr-2" />
            Studio
          </TabsTrigger>
          <TabsTrigger value="inbox" data-testid="tab-inbox">
            <Send className="h-4 w-4 mr-2" />
            Delivery Inbox
          </TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-templates">
            <MessageSquare className="h-4 w-4 mr-2" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="studio" className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search automations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-automations"
              />
            </div>
            <Select value={audienceFilter} onValueChange={setAudienceFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-audience-filter">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Audience" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Audiences</SelectItem>
                <SelectItem value="CUSTOMER">Customers</SelectItem>
                <SelectItem value="LEAD">Leads</SelectItem>
                <SelectItem value="CREW">Crew</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loadingAutomations ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2 mt-2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3 mt-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredAutomations.length === 0 ? (
            <EmptyState
              icon={Radio}
              title="No automations found"
              description={searchQuery ? "Try adjusting your search query" : "Create your first automation to get started"}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAutomations.map((automation) => (
                <AutomationCard
                  key={automation.id}
                  automation={automation}
                  onToggle={handleToggle}
                  onView={handleViewAutomation}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="inbox" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="QUEUED">Queued</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="DELIVERED">Delivered</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchLogs()}
              data-testid="button-refresh-logs"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Deliveries</CardTitle>
              <CardDescription>
                Last 50 messages sent through automations
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loadingLogs ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-10 w-10 rounded" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-2/3 mt-2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="p-8 text-center">
                  <Send className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No delivery logs yet</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  {filteredLogs.map((log) => (
                    <DeliveryLogRow key={log.id} log={log} />
                  ))}
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          {loadingTemplates ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-5 w-3/4" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !templateSets || templateSets.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No templates found"
              description="Template sets will appear here when created"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templateSets.map((template) => (
                <Card key={template.id} data-testid={`card-template-${template.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <CardDescription className="text-xs mt-1">
                          Code: {template.code}
                        </CardDescription>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Badge variant="outline" className="text-xs">{template.language}</Badge>
                        <Badge variant="outline" className="text-xs">{template.channel}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {template.subjectLine && (
                      <p className="text-xs text-muted-foreground mb-2">
                        Subject: {template.subjectLine}
                      </p>
                    )}
                    <p className="text-xs bg-muted p-2 rounded font-mono line-clamp-4">
                      {template.bodyDefault}
                    </p>
                    {template.tokensJson && template.tokensJson.length > 0 && (
                      <div className="flex gap-1 flex-wrap mt-2">
                        {template.tokensJson.slice(0, 5).map((token) => (
                          <Badge key={token} variant="secondary" className="text-xs">
                            {token}
                          </Badge>
                        ))}
                        {template.tokensJson.length > 5 && (
                          <Badge variant="secondary" className="text-xs">
                            +{template.tokensJson.length - 5} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        </Tabs>

        <AutomationDetailDialog
          automation={selectedAutomation}
          templateSets={templateSets || []}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        />
      </div>
    </RoleGate>
  );
}
