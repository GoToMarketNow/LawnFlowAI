import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { 
  Phone, 
  MessageSquare, 
  Globe, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Users,
  UserPlus,
  Filter,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";

type UnifiedItem = {
  id: string;
  type: "event" | "conversation" | "sms_session";
  channel: "phone" | "sms" | "web";
  customerType: "prospect" | "customer";
  status: string;
  customerName: string | null;
  customerPhone: string | null;
  summary: string;
  createdAt: string | null;
  updatedAt: string | null;
  metadata: Record<string, any>;
};

type UnifiedFeedResponse = {
  items: UnifiedItem[];
  stats: {
    total: number;
    byChannel: { phone: number; sms: number; web: number };
    byCustomerType: { prospect: number; customer: number };
    byStatus: { active: number; completed: number; handoff: number };
  };
};

const channelConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  phone: {
    icon: <Phone className="h-4 w-4" />,
    label: "Phone",
    color: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
  },
  sms: {
    icon: <MessageSquare className="h-4 w-4" />,
    label: "SMS",
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  },
  web: {
    icon: <Globe className="h-4 w-4" />,
    label: "Web",
    color: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800",
  },
};

const customerTypeConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  prospect: {
    icon: <UserPlus className="h-4 w-4" />,
    label: "Prospect",
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  },
  customer: {
    icon: <Users className="h-4 w-4" />,
    label: "Customer",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
  },
};

const statusConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  pending: {
    icon: <Clock className="h-3 w-3" />,
    color: "text-yellow-600 dark:text-yellow-400 border-yellow-300 dark:border-yellow-600",
  },
  processing: {
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    color: "text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-600",
  },
  active: {
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    color: "text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-600",
  },
  completed: {
    icon: <CheckCircle2 className="h-3 w-3" />,
    color: "text-green-600 dark:text-green-400 border-green-300 dark:border-green-600",
  },
  scheduled: {
    icon: <CheckCircle2 className="h-3 w-3" />,
    color: "text-green-600 dark:text-green-400 border-green-300 dark:border-green-600",
  },
  qualified: {
    icon: <CheckCircle2 className="h-3 w-3" />,
    color: "text-cyan-600 dark:text-cyan-400 border-cyan-300 dark:border-cyan-600",
  },
  handoff: {
    icon: <AlertCircle className="h-3 w-3" />,
    color: "text-yellow-600 dark:text-yellow-400 border-yellow-300 dark:border-yellow-600",
  },
  failed: {
    icon: <XCircle className="h-3 w-3" />,
    color: "text-red-600 dark:text-red-400 border-red-300 dark:border-red-600",
  },
  lost: {
    icon: <XCircle className="h-3 w-3" />,
    color: "text-red-600 dark:text-red-400 border-red-300 dark:border-red-600",
  },
};

function UnifiedItemCard({ 
  item, 
  onSelect 
}: { 
  item: UnifiedItem; 
  onSelect: (item: UnifiedItem) => void;
}) {
  const channel = channelConfig[item.channel] || channelConfig.phone;
  const customerType = customerTypeConfig[item.customerType] || customerTypeConfig.prospect;
  const status = statusConfig[item.status] || statusConfig.pending;

  return (
    <div
      className="flex items-start gap-4 p-4 border-b border-border last:border-0 hover-elevate cursor-pointer"
      data-testid={`unified-item-${item.id}`}
      onClick={() => onSelect(item)}
    >
      <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${channel.color}`}>
        {channel.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">
            {item.customerName || item.customerPhone || "Unknown"}
          </span>
          <Badge variant="outline" className={`text-xs ${channel.color}`}>
            {channel.label}
          </Badge>
          <Badge variant="outline" className={`text-xs ${customerType.color}`}>
            {customerType.label}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1 truncate">
          {item.summary}
        </p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Badge variant="outline" className={`text-xs ${status.color}`}>
            <span className="flex items-center gap-1">
              {status.icon}
              {item.status}
            </span>
          </Badge>
          <span className="text-xs text-muted-foreground">
            {item.createdAt && formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
          </span>
          {item.type === "sms_session" && item.metadata.state && (
            <Badge variant="secondary" className="text-xs">
              State: {item.metadata.state}
            </Badge>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </div>
  );
}

function ItemDetailModal({ 
  item, 
  onClose 
}: { 
  item: UnifiedItem | null; 
  onClose: () => void;
}) {
  if (!item) return null;

  const channel = channelConfig[item.channel] || channelConfig.phone;
  const customerType = customerTypeConfig[item.customerType] || customerTypeConfig.prospect;

  return (
    <Dialog open={!!item} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {channel.icon}
            {item.customerName || item.customerPhone || "Unknown"}
          </DialogTitle>
          <DialogDescription>
            {item.type === "sms_session" ? "SMS Lead Session" : 
             item.type === "conversation" ? "Conversation" : "Event"}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-4 pr-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Channel</p>
                <Badge variant="outline" className={channel.color}>
                  {channel.label}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Customer Type</p>
                <Badge variant="outline" className={customerType.color}>
                  {customerType.label}
                </Badge>
              </div>
            </div>

            {item.customerPhone && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="text-sm font-medium">{item.customerPhone}</p>
              </div>
            )}

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Summary</p>
              <p className="text-sm">{item.summary}</p>
            </div>

            {item.type === "sms_session" && item.metadata.collected && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Collected Information</p>
                <div className="bg-muted/50 rounded-md p-3">
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(item.metadata.collected).map(([key, value]) => (
                      <div key={key}>
                        <dt className="text-muted-foreground text-xs">{key}</dt>
                        <dd className="font-medium">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            )}

            {item.type === "sms_session" && item.metadata.derived?.address_one_line && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Enriched Data</p>
                <div className="bg-muted/50 rounded-md p-3 space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Address</p>
                    <p className="text-sm font-medium">{item.metadata.derived.address_one_line}</p>
                  </div>
                  {item.metadata.derived.arcgis?.estimated_lot_acres && (
                    <div>
                      <p className="text-xs text-muted-foreground">Lot Size</p>
                      <p className="text-sm font-medium">
                        {item.metadata.derived.arcgis.estimated_lot_acres.toFixed(2)} acres
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {item.createdAt && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm">{new Date(item.createdAt).toLocaleString()}</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function EventSkeleton() {
  return (
    <div className="flex items-start gap-4 p-4 border-b border-border">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-4 w-48 mt-2" />
        <Skeleton className="h-3 w-32 mt-2" />
      </div>
    </div>
  );
}

export default function EventsFeed() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  
  const params = new URLSearchParams(search);
  const [channelFilter, setChannelFilter] = useState(params.get("channel") || "all");
  const [customerTypeFilter, setCustomerTypeFilter] = useState(params.get("type") || "all");
  const [statusFilter, setStatusFilter] = useState(params.get("status") || "all");
  const [selectedItem, setSelectedItem] = useState<UnifiedItem | null>(null);

  const queryParams = new URLSearchParams();
  if (channelFilter !== "all") queryParams.set("channel", channelFilter);
  if (customerTypeFilter !== "all") queryParams.set("customerType", customerTypeFilter);
  if (statusFilter !== "all") queryParams.set("status", statusFilter);

  const { data, isLoading, error, refetch } = useQuery<UnifiedFeedResponse>({
    queryKey: ["/api/unified-feed", channelFilter, customerTypeFilter, statusFilter],
    refetchInterval: 5000,
  });

  const updateFilters = (type: "channel" | "type" | "status", value: string) => {
    const newParams = new URLSearchParams(search);
    if (value === "all") {
      newParams.delete(type);
    } else {
      newParams.set(type, value);
    }
    const newSearch = newParams.toString();
    setLocation(`/events${newSearch ? `?${newSearch}` : ""}`);
    
    if (type === "channel") setChannelFilter(value);
    if (type === "type") setCustomerTypeFilter(value);
    if (type === "status") setStatusFilter(value);
  };

  const stats = data?.stats || {
    total: 0,
    byChannel: { phone: 0, sms: 0, web: 0 },
    byCustomerType: { prospect: 0, customer: 0 },
    byStatus: { active: 0, completed: 0, handoff: 0 },
  };

  const hasActiveFilters = channelFilter !== "all" || customerTypeFilter !== "all" || statusFilter !== "all";

  return (
    <div className="p-6 space-y-6" data-testid="page-events-feed">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Events Feed</h1>
          <p className="text-sm text-muted-foreground">
            Unified view of all customer communications - calls, SMS, and web leads
          </p>
        </div>
        <Button 
          onClick={() => refetch()} 
          variant="outline" 
          data-testid="button-refresh"
        >
          <Loader2 className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold" data-testid="metric-total">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer hover-elevate ${channelFilter === "phone" ? "ring-2 ring-primary" : ""}`}
          onClick={() => updateFilters("channel", channelFilter === "phone" ? "all" : "phone")}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-2xl font-bold text-red-600" data-testid="metric-phone">{stats.byChannel.phone}</div>
                <p className="text-xs text-muted-foreground">Phone</p>
              </div>
              <Phone className="h-5 w-5 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer hover-elevate ${channelFilter === "sms" ? "ring-2 ring-primary" : ""}`}
          onClick={() => updateFilters("channel", channelFilter === "sms" ? "all" : "sms")}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-2xl font-bold text-blue-600" data-testid="metric-sms">{stats.byChannel.sms}</div>
                <p className="text-xs text-muted-foreground">SMS</p>
              </div>
              <MessageSquare className="h-5 w-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer hover-elevate ${channelFilter === "web" ? "ring-2 ring-primary" : ""}`}
          onClick={() => updateFilters("channel", channelFilter === "web" ? "all" : "web")}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-2xl font-bold text-green-600" data-testid="metric-web">{stats.byChannel.web}</div>
                <p className="text-xs text-muted-foreground">Web</p>
              </div>
              <Globe className="h-5 w-5 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card 
          className={`cursor-pointer hover-elevate ${customerTypeFilter === "prospect" ? "ring-2 ring-primary" : ""}`}
          onClick={() => updateFilters("type", customerTypeFilter === "prospect" ? "all" : "prospect")}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-2xl font-bold text-purple-600" data-testid="metric-prospects">{stats.byCustomerType.prospect}</div>
                <p className="text-xs text-muted-foreground">Prospects</p>
              </div>
              <UserPlus className="h-5 w-5 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="text-lg font-medium flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Communications Stream
              {hasActiveFilters && (
                <Badge variant="secondary" className="text-xs">
                  Filtered
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={channelFilter} onValueChange={(v) => updateFilters("channel", v)}>
                <SelectTrigger className="w-28" data-testid="select-channel">
                  <SelectValue placeholder="Channel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Channels</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="web">Web</SelectItem>
                </SelectContent>
              </Select>
              <Select value={customerTypeFilter} onValueChange={(v) => updateFilters("type", v)}>
                <SelectTrigger className="w-32" data-testid="select-customer-type">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="prospect">Prospects</SelectItem>
                  <SelectItem value="customer">Customers</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => updateFilters("status", v)}>
                <SelectTrigger className="w-28" data-testid="select-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="handoff">Handoff</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setChannelFilter("all");
                    setCustomerTypeFilter("all");
                    setStatusFilter("all");
                    setLocation("/events");
                  }}
                  data-testid="button-clear-filters"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div>
              {[1, 2, 3, 4, 5].map((i) => (
                <EventSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <XCircle className="h-10 w-10 mx-auto text-red-500/50 mb-2" />
              <p className="text-sm text-muted-foreground">Failed to load events</p>
            </div>
          ) : data?.items && data.items.length > 0 ? (
            <div>
              {data.items.map((item) => (
                <UnifiedItemCard 
                  key={item.id} 
                  item={item} 
                  onSelect={setSelectedItem}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Clock className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                {hasActiveFilters ? "No events match your filters" : "No events yet"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {hasActiveFilters 
                  ? "Try adjusting your filter criteria"
                  : "Use the Simulator to generate test events"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <ItemDetailModal 
        item={selectedItem} 
        onClose={() => setSelectedItem(null)} 
      />
    </div>
  );
}
