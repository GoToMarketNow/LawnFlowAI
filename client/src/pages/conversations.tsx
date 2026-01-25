import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Phone,
  MessageSquare,
  Globe,
  Search,
  ChevronRight,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import type { Conversation } from "@shared/schema";

const statusColors: Record<string, string> = {
  active: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  qualified: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
  scheduled: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800",
  completed: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700",
  lost: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
};

const sourceIcons: Record<string, React.ReactNode> = {
  missed_call: <Phone className="h-4 w-4" />,
  inbound_sms: <MessageSquare className="h-4 w-4" />,
  web_lead: <Globe className="h-4 w-4" />,
};

const sourceLabels: Record<string, string> = {
  missed_call: "Missed Call",
  inbound_sms: "SMS",
  web_lead: "Web Lead",
};

function ConversationCard({ conversation }: { conversation: Conversation }) {
  const createdAt = new Date(conversation.createdAt);
  const timeAgo = getTimeAgo(createdAt);

  return (
    <Link href={`/conversations/${conversation.id}`}>
      <Card
        className="hover-elevate cursor-pointer transition-all"
        data-testid={`card-conversation-${conversation.id}`}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                {sourceIcons[conversation.source] || <MessageSquare className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate">
                    {conversation.customerName || "Unknown Customer"}
                  </p>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {sourceLabels[conversation.source] || conversation.source}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {conversation.customerPhone}
                </p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {conversation.agentType && (
                    <Badge variant="secondary" className="text-xs">
                      {conversation.agentType} agent
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {timeAgo}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className={statusColors[conversation.status]}>
                {conversation.status}
              </Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function ConversationsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const { data: conversations, isLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  const filteredConversations = conversations?.filter((conv) => {
    const matchesSearch =
      !searchQuery ||
      conv.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.customerPhone.includes(searchQuery);
    const matchesStatus = statusFilter === "all" || conv.status === statusFilter;
    const matchesSource = sourceFilter === "all" || conv.source === sourceFilter;
    return matchesSearch && matchesStatus && matchesSource;
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          Conversations
        </h1>
        <p className="text-sm text-muted-foreground">
          View and manage all customer interactions
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-conversations"
          />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-source-filter">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="missed_call">Missed Call</SelectItem>
              <SelectItem value="inbound_sms">SMS</SelectItem>
              <SelectItem value="web_lead">Web Lead</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-40 mb-2" />
                    <Skeleton className="h-3 w-28 mb-2" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : filteredConversations && filteredConversations.length > 0 ? (
          filteredConversations.map((conversation) => (
            <ConversationCard key={conversation.id} conversation={conversation} />
          ))
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-1">No conversations found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery || statusFilter !== "all" || sourceFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Start by simulating an event to create your first conversation"}
              </p>
              <Link href="/simulator">
                <Button data-testid="button-go-simulator">Go to Simulator</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
