import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Calendar, 
  Users, 
  AlertTriangle, 
  Zap,
  Clock,
  MapPin,
  Phone,
  CheckCircle,
  XCircle,
  MessageSquare,
  ChevronRight,
  Loader2,
  Inbox as InboxIcon,
  Filter,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface InboxItem {
  id: string;
  type: 'quote' | 'schedule' | 'crew_assign' | 'low_confidence' | 'integration' | 'approval';
  category: 'orchestration' | 'approval' | 'error';
  title: string;
  description: string;
  stage?: string;
  status: string;
  priority: 'urgent' | 'warning' | 'normal';
  createdAt: string;
  dueAt?: string;
  entityType?: string;
  entityId?: number;
  runId?: string;
  actionType?: string;
  ctaLabel: string;
  ctaAction: string;
  customerName?: string;
  customerAddress?: string;
  customerPhone?: string;
  confidence?: string;
  services?: string[];
  lotSize?: number;
  quoteRange?: { min: number; max: number };
  scheduleWindows?: string[];
  crewRecommendations?: Array<{ id: number; name: string; score?: number }>;
  aiSummary?: string;
  contextJson?: any;
}

interface InboxItemDetail {
  id: string;
  type: string;
  run?: any;
  jobRequest?: any;
  action?: any;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  services?: string[];
  lotSize?: number;
  confidence?: string;
  stage?: string;
  contextJson?: any;
  auditTrail: Array<{
    id: number;
    stage: string;
    startedAt: string;
    completedAt?: string;
    decision?: any;
  }>;
}

const typeIcons: Record<string, typeof FileText> = {
  quote: FileText,
  schedule: Calendar,
  crew_assign: Users,
  low_confidence: AlertTriangle,
  integration: Zap,
  approval: CheckCircle,
};

const typeLabels: Record<string, string> = {
  quote: "Quote",
  schedule: "Schedule",
  crew_assign: "Crew Assign",
  low_confidence: "Low Confidence",
  integration: "Integration",
  approval: "Approval",
};

const priorityColors: Record<string, string> = {
  urgent: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  normal: "bg-muted text-muted-foreground",
};

function TaskCardSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b">
      <Skeleton className="h-9 w-9 rounded-md" />
      <div className="flex-1">
        <Skeleton className="h-4 w-32 mb-2" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-3 w-48" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24" />
      </div>
    </div>
  );
}

export default function InboxPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isOwnerOrAdmin = user?.role === "owner" || user?.role === "admin";

  const [selectedTab, setSelectedTab] = useState<string>("assigned");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("all");
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [requestInfoMessage, setRequestInfoMessage] = useState("");

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.set("limit", "50");
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (urgencyFilter !== "all") params.set("urgency", urgencyFilter);
    if (selectedTab === "assigned") params.set("assignedToMe", "true");
    return params.toString();
  };

  const { data: items = [], isLoading, error, refetch } = useQuery<InboxItem[]>({
    queryKey: ["/api/ops/inbox", typeFilter, urgencyFilter, selectedTab],
    queryFn: async () => {
      const res = await fetch(`/api/ops/inbox?${buildQueryParams()}`);
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: itemDetail, isLoading: isLoadingDetail } = useQuery<InboxItemDetail>({
    queryKey: ["/api/ops/inbox", selectedItem?.id],
    queryFn: async () => {
      const res = await fetch(`/api/ops/inbox/${selectedItem?.id}`);
      return res.json();
    },
    enabled: !!selectedItem,
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ itemId, action, payload }: { itemId: string; action: string; payload?: any }) => {
      const res = await apiRequest("POST", "/api/ops/inbox/resolve", { itemId, action, payload });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Success",
        description: data.message || "Action completed",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ops/inbox"] });
      setDrawerOpen(false);
      setSelectedItem(null);
      setRequestInfoMessage("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleItemClick = (item: InboxItem) => {
    setSelectedItem(item);
    setDrawerOpen(true);
  };

  const handleApprove = (item: InboxItem) => {
    resolveMutation.mutate({ itemId: item.id, action: "approve" });
  };

  const handleReject = (item: InboxItem) => {
    resolveMutation.mutate({ itemId: item.id, action: "reject" });
  };

  const handleRequestInfo = (item: InboxItem) => {
    if (!requestInfoMessage.trim()) {
      toast({
        title: "Message required",
        description: "Please enter a message to send to the customer",
        variant: "destructive",
      });
      return;
    }
    resolveMutation.mutate({ 
      itemId: item.id, 
      action: "request_info",
      payload: { message: requestInfoMessage },
    });
  };

  const handleRetry = (item: InboxItem) => {
    resolveMutation.mutate({ itemId: item.id, action: "retry" });
  };

  const formatTimeWaiting = (createdAt: string) => {
    return formatDistanceToNow(new Date(createdAt), { addSuffix: true });
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const renderConfidenceBadge = (confidence?: string) => {
    if (!confidence) return null;
    const colors: Record<string, string> = {
      high: "bg-green-500/10 text-green-600 dark:text-green-400",
      medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      low: "bg-red-500/10 text-red-600 dark:text-red-400",
    };
    return (
      <Badge variant="outline" className={colors[confidence] || ""}>
        {confidence} confidence
      </Badge>
    );
  };

  const urgentCount = items.filter(i => i.priority === "urgent").length;
  const warningCount = items.filter(i => i.priority === "warning").length;

  const InboxItemCard = ({ item }: { item: InboxItem }) => {
    const Icon = typeIcons[item.type] || FileText;

    return (
      <div
        className="flex items-center gap-4 p-4 border-b hover-elevate cursor-pointer"
        onClick={() => handleItemClick(item)}
        data-testid={`inbox-item-${item.id}`}
      >
        <div className={`p-2 rounded-md ${priorityColors[item.priority]}`}>
          <Icon className="h-5 w-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {typeLabels[item.type] || item.type}
            </Badge>
            {item.priority === "urgent" && (
              <Badge variant="destructive" className="text-xs">Urgent</Badge>
            )}
            {item.priority === "warning" && (
              <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400">Soon</Badge>
            )}
          </div>

          <h4 className="font-medium mt-1 truncate">{item.title}</h4>

          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            {item.customerName && (
              <span className="truncate">{item.customerName}</span>
            )}
            {item.customerAddress && (
              <span className="flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3" />
                {item.customerAddress.split(",")[0]}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 mt-1">
            {renderConfidenceBadge(item.confidence)}
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTimeWaiting(item.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleApprove(item);
            }}
            disabled={resolveMutation.isPending}
            data-testid={`button-approve-${item.id}`}
          >
            {item.ctaLabel}
          </Button>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    );
  };

  const DetailDrawer = () => {
    if (!selectedItem) return null;

    const Icon = typeIcons[selectedItem.type] || FileText;

    return (
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-md ${priorityColors[selectedItem.priority]}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle>{selectedItem.title}</SheetTitle>
                <SheetDescription>
                  {typeLabels[selectedItem.type]} - {formatTimeWaiting(selectedItem.createdAt)}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {selectedItem.aiSummary && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Why You're Needed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{selectedItem.aiSummary}</p>
                </CardContent>
              </Card>
            )}

            <div className="space-y-3">
              <h4 className="text-sm font-medium">Key Context</h4>
              
              {selectedItem.customerName && (
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Customer:</span>
                  <span>{selectedItem.customerName}</span>
                </div>
              )}

              {selectedItem.customerPhone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Phone:</span>
                  <span>{selectedItem.customerPhone}</span>
                </div>
              )}

              {selectedItem.customerAddress && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Address:</span>
                  <span>{selectedItem.customerAddress}</span>
                </div>
              )}

              {selectedItem.services && selectedItem.services.length > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span className="font-medium">Services:</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedItem.services.map((s, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedItem.lotSize && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Lot Size:</span>
                  <span>{selectedItem.lotSize.toLocaleString()} sq ft</span>
                </div>
              )}

              {selectedItem.quoteRange && (
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Quote Range:</span>
                  <span>
                    {formatCurrency(selectedItem.quoteRange.min)} - {formatCurrency(selectedItem.quoteRange.max)}
                  </span>
                </div>
              )}

              {selectedItem.scheduleWindows && selectedItem.scheduleWindows.length > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span className="font-medium">Schedule Windows:</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedItem.scheduleWindows.map((w, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {w}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedItem.crewRecommendations && selectedItem.crewRecommendations.length > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span className="font-medium">Crew Options:</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedItem.crewRecommendations.map((c, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {c.name} {c.score ? `(${c.score}%)` : ""}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {renderConfidenceBadge(selectedItem.confidence)}
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="text-sm font-medium">Actions</h4>
              
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => handleApprove(selectedItem)}
                  disabled={resolveMutation.isPending}
                  data-testid="button-drawer-approve"
                >
                  {resolveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve
                </Button>

                {selectedItem.category !== "error" && (
                  <Button
                    variant="outline"
                    onClick={() => handleReject(selectedItem)}
                    disabled={resolveMutation.isPending}
                    data-testid="button-drawer-reject"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                )}

                {selectedItem.category === "error" && (
                  <Button
                    variant="outline"
                    onClick={() => handleRetry(selectedItem)}
                    disabled={resolveMutation.isPending}
                    data-testid="button-drawer-retry"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                )}
              </div>

              {selectedItem.category === "orchestration" && selectedItem.customerPhone && (
                <div className="space-y-2">
                  <h5 className="text-sm font-medium">Request More Info</h5>
                  <Textarea
                    placeholder="Enter message to send to customer..."
                    value={requestInfoMessage}
                    onChange={(e) => setRequestInfoMessage(e.target.value)}
                    className="text-sm"
                    data-testid="textarea-request-info"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleRequestInfo(selectedItem)}
                    disabled={resolveMutation.isPending || !requestInfoMessage.trim()}
                    data-testid="button-send-request-info"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Send Message
                  </Button>
                </div>
              )}
            </div>

            {itemDetail?.auditTrail && itemDetail.auditTrail.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Audit Trail</h4>
                  <ScrollArea className="h-48">
                    <div className="space-y-3">
                      {itemDetail.auditTrail.map((step, i) => (
                        <div key={step.id} className="flex gap-3 text-sm">
                          <div className="flex flex-col items-center">
                            <div className={`w-2 h-2 rounded-full ${step.completedAt ? "bg-green-500" : "bg-amber-500"}`} />
                            {i < itemDetail.auditTrail.length - 1 && (
                              <div className="w-px h-full bg-border" />
                            )}
                          </div>
                          <div className="flex-1 pb-3">
                            <div className="font-medium">{step.stage.replace(/_/g, " ")}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatTimeWaiting(step.startedAt)}
                              {step.completedAt && ` - Completed`}
                            </div>
                            {step.decision?.notes && (
                              <p className="text-xs text-muted-foreground mt-1">{step.decision.notes}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div>
          <TaskCardSkeleton />
          <TaskCardSkeleton />
          <TaskCardSkeleton />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mb-4" />
          <h3 className="font-medium">Failed to load inbox</h3>
          <p className="text-sm text-muted-foreground">
            Please try refreshing the page.
          </p>
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
          <h3 className="font-medium">All caught up!</h3>
          <p className="text-sm text-muted-foreground">
            No pending items. The AI agents are handling everything.
          </p>
        </div>
      );
    }

    return (
      <div>
        {items.map((item) => (
          <InboxItemCard key={item.id} item={item} />
        ))}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="border-b p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <InboxIcon className="h-6 w-6" />
              Inbox
            </h1>
            <p className="text-sm text-muted-foreground">
              {items.length} pending {items.length === 1 ? "item" : "items"}
              {urgentCount > 0 && (
                <span className="text-red-600 dark:text-red-400 ml-2">
                  ({urgentCount} urgent)
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              data-testid="button-refresh-inbox"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="p-4 border-b flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters:</span>
          </div>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40" data-testid="select-type-filter">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="quote">Quote</SelectItem>
              <SelectItem value="schedule">Schedule</SelectItem>
              <SelectItem value="crew_assign">Crew Assign</SelectItem>
              <SelectItem value="low_confidence">Low Confidence</SelectItem>
              <SelectItem value="integration">Integration</SelectItem>
            </SelectContent>
          </Select>

          <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
            <SelectTrigger className="w-40" data-testid="select-urgency-filter">
              <SelectValue placeholder="Urgency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Urgency</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="flex-1 flex flex-col">
          <div className="px-4 pt-2">
            <TabsList>
              <TabsTrigger value="assigned" data-testid="tab-assigned">
                Assigned to Me
              </TabsTrigger>
              {isOwnerOrAdmin && (
                <TabsTrigger value="all" data-testid="tab-all">
                  All
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <TabsContent value="assigned" className="flex-1 overflow-hidden mt-0">
            <ScrollArea className="h-full">
              {renderContent()}
            </ScrollArea>
          </TabsContent>

          {isOwnerOrAdmin && (
            <TabsContent value="all" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                {renderContent()}
              </ScrollArea>
            </TabsContent>
          )}
        </Tabs>
      </div>

      <DetailDrawer />
    </div>
  );
}
