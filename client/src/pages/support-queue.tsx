import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Search,
  Filter,
  Clock,
  AlertCircle,
  CheckCircle2,
  MessageSquare,
  User,
  Phone,
  ChevronRight,
  Eye,
  UserPlus,
  Send,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getQueryFn, apiRequest } from "@/lib/queryClient";

interface QueueThread {
  id: number;
  customerName: string;
  customerPhone: string;
  intent: string;
  priority: "urgent" | "high" | "normal" | "low";
  coverageStatus: "covered" | "partial" | "uncovered" | "unknown";
  slaStatus: "ok" | "soon" | "critical" | "overdue";
  timeToSLA: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  claimedBy: number | null;
  claimedByName: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface QueueStats {
  totalInQueue: number;
  overdueSLA: number;
  uncovered: number;
  avgResponseTimeMinutes: number;
}

const priorityColors: Record<string, string> = {
  urgent: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
  high: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  normal: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  low: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700",
};

const coverageColors: Record<string, string> = {
  covered: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800",
  partial: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
  uncovered: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
  unknown: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700",
};

const slaIcons: Record<string, { icon: React.ReactNode; color: string }> = {
  overdue: { icon: "🔴", color: "text-red-600 dark:text-red-400" },
  critical: { icon: "🟠", color: "text-orange-600 dark:text-orange-400" },
  soon: { icon: "🟡", color: "text-yellow-600 dark:text-yellow-400" },
  ok: { icon: "🟢", color: "text-green-600 dark:text-green-400" },
};

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export default function SupportQueuePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [coverageFilter, setCoverageFilter] = useState<string>("all");
  const [slaFilter, setSlaFilter] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data: queue, isLoading } = useQuery<QueueThread[]>({
    queryKey: ["/api/support/queue", priorityFilter, coverageFilter, slaFilter],
    queryFn: getQueryFn({
      on200: (data) => data,
    }),
  });

  const { data: stats } = useQuery<QueueStats>({
    queryKey: ["/api/support/stats"],
    queryFn: getQueryFn({
      on200: (data) => data,
    }),
  });

  const claimMutation = useMutation({
    mutationFn: (threadId: number) =>
      apiRequest("POST", `/api/support/queue/${threadId}/claim`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/queue"] });
    },
  });

  const handleClaim = (threadId: number) => {
    claimMutation.mutate(threadId);
  };

  const filteredQueue = queue?.filter((thread) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        thread.customerName.toLowerCase().includes(query) ||
        thread.customerPhone.includes(query) ||
        thread.intent.toLowerCase().includes(query)
      );
    }
    return true;
  }) || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Support Queue</h1>
          <p className="text-muted-foreground mt-1">
            Manage customer support requests with SLA tracking
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/support/gaps">
            <AlertCircle className="h-4 w-4 mr-2" />
            Coverage Gaps
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total in Queue</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {stats ? (
              <>
                <div className="text-2xl font-bold">{stats.totalInQueue}</div>
                <p className="text-xs text-muted-foreground">Active threads</p>
              </>
            ) : (
              <Skeleton className="h-8 w-16" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue SLA</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            {stats ? (
              <>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {stats.overdueSLA}
                </div>
                <p className="text-xs text-muted-foreground">Need immediate response</p>
              </>
            ) : (
              <Skeleton className="h-8 w-16" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uncovered</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            {stats ? (
              <>
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {stats.uncovered}
                </div>
                <p className="text-xs text-muted-foreground">No knowledge available</p>
              </>
            ) : (
              <Skeleton className="h-8 w-16" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {stats ? (
              <>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.avgResponseTimeMinutes}m
                </div>
                <p className="text-xs text-muted-foreground">First response time</p>
              </>
            ) : (
              <Skeleton className="h-8 w-16" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer name, phone, or intent..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Filters:</span>
          </div>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={coverageFilter} onValueChange={setCoverageFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Coverage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Coverage</SelectItem>
              <SelectItem value="covered">Covered</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="uncovered">Uncovered</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>

          <Select value={slaFilter} onValueChange={setSlaFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="SLA Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All SLA</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="soon">Due Soon</SelectItem>
              <SelectItem value="ok">OK</SelectItem>
            </SelectContent>
          </Select>

          {filteredQueue && (
            <span className="text-sm text-muted-foreground ml-auto">
              {filteredQueue.length} thread{filteredQueue.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Queue Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredQueue.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Queue is empty!</h3>
              <p className="text-muted-foreground">
                {searchQuery
                  ? "No threads match your search."
                  : "All customer threads have been handled. Great work!"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SLA</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Intent</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Coverage</TableHead>
                  <TableHead>Time to SLA</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQueue.map((thread) => (
                  <TableRow key={thread.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="text-lg">{slaIcons[thread.slaStatus].icon}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <div className="font-medium">{thread.customerName}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {thread.customerPhone}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[200px]">
                        <div className="text-sm truncate">{thread.intent}</div>
                        <div className="text-xs text-muted-foreground">
                          {thread.messageCount} message{thread.messageCount !== 1 ? "s" : ""} •{" "}
                          {getTimeAgo(new Date(thread.updatedAt))}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={priorityColors[thread.priority]}>
                        {thread.priority.charAt(0).toUpperCase() + thread.priority.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={coverageColors[thread.coverageStatus]}>
                        {thread.coverageStatus.charAt(0).toUpperCase() + thread.coverageStatus.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={slaIcons[thread.slaStatus].color}>
                        {thread.timeToSLA}
                      </span>
                    </TableCell>
                    <TableCell>
                      {thread.claimedBy ? (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <User className="h-3 w-3" />
                          {thread.claimedByName}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Unclaimed</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!thread.claimedBy && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleClaim(thread.id)}
                            disabled={claimMutation.isPending}
                          >
                            <UserPlus className="h-3.5 w-3.5 mr-1" />
                            Claim
                          </Button>
                        )}
                        <Button variant="default" size="sm" asChild>
                          <Link href={`/support/thread/${thread.id}`}>
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            View
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
