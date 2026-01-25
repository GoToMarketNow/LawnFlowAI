import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "wouter";
import { 
  Search, 
  Filter, 
  Users, 
  FileText, 
  Calendar, 
  Truck,
  MessageSquare,
  ArrowRight,
  Clock,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

type WorkItemType = 'LEAD' | 'QUOTE' | 'SCHEDULE' | 'CREW' | 'COMMS';
type Priority = 'LOW' | 'MED' | 'HIGH';

interface WorkItem {
  id: string;
  type: WorkItemType;
  title: string;
  status: string;
  priority: Priority;
  confidence: number;
  recommendedAction: string;
  dueAt?: string;
  deepLink: string;
  contextJson?: any;
  createdAt: string;
}

const typeIcons: Record<WorkItemType, React.ElementType> = {
  LEAD: Users,
  QUOTE: FileText,
  SCHEDULE: Calendar,
  CREW: Truck,
  COMMS: MessageSquare,
};

const priorityColors: Record<Priority, string> = {
  HIGH: "destructive",
  MED: "secondary",
  LOW: "outline",
};

function WorkItemCard({ 
  item, 
  isSelected, 
  onSelect 
}: { 
  item: WorkItem; 
  isSelected: boolean; 
  onSelect: () => void;
}) {
  const Icon = typeIcons[item.type] || FileText;
  const isOverdue = item.dueAt && new Date(item.dueAt) < new Date();

  return (
    <div
      className={`p-3 rounded-md cursor-pointer transition-colors ${
        isSelected 
          ? 'bg-accent' 
          : 'hover-elevate'
      }`}
      onClick={onSelect}
      data-testid={`work-item-${item.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium truncate">{item.title}</span>
            {isOverdue && (
              <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={priorityColors[item.priority] as any} className="text-xs">
              {item.priority}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {item.type}
            </Badge>
            {item.confidence < 70 && (
              <span className="text-xs text-muted-foreground">
                {item.confidence}% conf
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkItemDetail({ item }: { item: WorkItem | null }) {
  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Select an item</h3>
        <p className="text-sm text-muted-foreground">
          Choose an item from the queue to view details
        </p>
      </div>
    );
  }

  const Icon = typeIcons[item.type] || FileText;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-medium">{item.title}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={priorityColors[item.priority] as any}>
                {item.priority} Priority
              </Badge>
              <Badge variant="outline">{item.type}</Badge>
            </div>
          </div>
        </div>
        <Link href={item.deepLink}>
          <Button data-testid="button-open-full-view">
            Open Full View
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      </div>

      <Separator />

      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-medium mb-1">Recommended Action</h4>
          <p className="text-sm text-muted-foreground">{item.recommendedAction}</p>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Created {new Date(item.createdAt).toLocaleDateString()}</span>
          </div>
          {item.dueAt && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Due {new Date(item.dueAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        <div>
          <h4 className="text-sm font-medium mb-1">Confidence Score</h4>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full"
                style={{ width: `${item.confidence}%` }}
              />
            </div>
            <span className="text-sm font-medium">{item.confidence}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkItemActions({ item }: { item: WorkItem | null }) {
  if (!item) {
    return null;
  }

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-sm font-medium">Quick Actions</h3>
      
      <div className="space-y-2">
        <Button className="w-full justify-start" variant="outline" data-testid="button-approve-action">
          <CheckCircle className="h-4 w-4 mr-2" />
          Approve
        </Button>
        <Link href={item.deepLink}>
          <Button className="w-full justify-start" variant="outline" data-testid="button-edit-action">
            <FileText className="h-4 w-4 mr-2" />
            Edit & Approve
          </Button>
        </Link>
      </div>

      <Separator />

      <div>
        <h4 className="text-sm font-medium mb-2">Agent Summary</h4>
        <p className="text-xs text-muted-foreground">
          AI confidence: {item.confidence}%
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Status: {item.status}
        </p>
      </div>
    </div>
  );
}

export default function WorkQueuePage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  interface WorkQueueResponse {
    items: WorkItem[];
    total: number;
    byPriority: Record<Priority, number>;
  }

  const { data: response, isLoading, error } = useQuery<WorkQueueResponse>({
    queryKey: ["/api/work-queue"],
    staleTime: 30000,
  });

  const items = response?.items || [];
  
  const filteredItems = items.filter(item => {
    if (typeFilter !== "all" && item.type !== typeFilter) return false;
    if (priorityFilter !== "all" && item.priority !== priorityFilter) return false;
    if (searchQuery && !item.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const selectedItem = filteredItems.find(item => item.id === selectedId) || null;

  if (error) {
    return (
      <div className="p-6">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-lg font-medium mb-2">Failed to load work queue</h2>
          <p className="text-sm text-muted-foreground">Please try again later</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-semibold" data-testid="page-title-work">Work Queue</h1>
            <p className="text-sm text-muted-foreground">
              {filteredItems.length} items need attention
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-work"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-type-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="LEAD">Leads</SelectItem>
              <SelectItem value="QUOTE">Quotes</SelectItem>
              <SelectItem value="SCHEDULE">Schedule</SelectItem>
              <SelectItem value="CREW">Crew</SelectItem>
              <SelectItem value="COMMS">Comms</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-priority-filter">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="MED">Medium</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 border-r flex flex-col">
          <ScrollArea className="flex-1">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <CheckCircle className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No items match your filters</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredItems.map(item => (
                  <WorkItemCard
                    key={item.id}
                    item={item}
                    isSelected={item.id === selectedId}
                    onSelect={() => setSelectedId(item.id)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="flex-1 flex">
          <div className="flex-1 border-r">
            <WorkItemDetail item={selectedItem} />
          </div>
          <div className="w-64">
            <WorkItemActions item={selectedItem} />
          </div>
        </div>
      </div>
    </div>
  );
}
