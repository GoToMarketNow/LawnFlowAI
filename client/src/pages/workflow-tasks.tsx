import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Search,
  Filter,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ArrowUpCircle,
  UserPlus,
  ChevronRight,
  RefreshCw,
  FileText,
  DollarSign,
  Calendar,
  MessageSquare,
  Users,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";

interface HumanTask {
  id: number;
  taskId: string;
  workflowRunId: number | null;
  accountId: string;
  businessId: number | null;
  taskType: string;
  category: string;
  assignedRole: string;
  assignedUserId: number | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  resolution: string | null;
  dueBy: string | null;
  escalatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TaskStats {
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
  overdue: number;
}

const priorityColors: Record<string, string> = {
  urgent: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
  high: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  normal: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  low: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-200",
  in_progress: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200",
  completed: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-200",
  cancelled: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-200",
  expired: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200",
};

const categoryIcons: Record<string, React.ReactNode> = {
  billing: <DollarSign className="h-4 w-4" />,
  payment: <DollarSign className="h-4 w-4" />,
  scheduling: <Calendar className="h-4 w-4" />,
  quote: <FileText className="h-4 w-4" />,
  support: <MessageSquare className="h-4 w-4" />,
  crew: <Users className="h-4 w-4" />,
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

function isOverdue(dueBy: string | null): boolean {
  if (!dueBy) return false;
  return new Date(dueBy) < new Date();
}

export default function WorkflowTasksPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  // Selected task for resolution dialog
  const [selectedTask, setSelectedTask] = useState<HumanTask | null>(null);
  const [resolution, setResolution] = useState<string>("");
  const [notes, setNotes] = useState("");

  // Fetch tasks
  const { data: tasksData, isLoading: tasksLoading, refetch } = useQuery({
    queryKey: ["/api/tasks", statusFilter, categoryFilter, priorityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      params.set("limit", "100");

      const response = await fetch(`/api/tasks?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch tasks");
      return response.json();
    },
  });

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ["/api/tasks/stats/summary"],
    queryFn: async () => {
      const response = await fetch("/api/tasks/stats/summary");
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
  });

  // Resolve task mutation
  const resolveMutation = useMutation({
    mutationFn: async ({
      taskId,
      resolution,
      notes,
    }: {
      taskId: string;
      resolution: string;
      notes: string;
    }) => {
      const response = await apiRequest("POST", `/api/tasks/${taskId}/resolve`, {
        resolution,
        notes,
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/stats/summary"] });
      setSelectedTask(null);
      setResolution("");
      setNotes("");
    },
  });

  // Escalate task mutation
  const escalateMutation = useMutation({
    mutationFn: async ({ taskId, targetRole }: { taskId: string; targetRole: string }) => {
      const response = await apiRequest("POST", `/api/tasks/${taskId}/escalate`, {
        targetRole,
        reason: "Escalated from task queue",
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  const tasks: HumanTask[] = tasksData?.tasks || [];
  const stats: TaskStats = statsData || { byStatus: {}, byCategory: {}, byPriority: {}, overdue: 0 };

  // Filter tasks by search
  const filteredTasks = tasks.filter((task) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      task.title.toLowerCase().includes(query) ||
      task.taskId.toLowerCase().includes(query) ||
      task.category.toLowerCase().includes(query)
    );
  });

  const pendingCount = stats.byStatus?.pending || 0;
  const inProgressCount = stats.byStatus?.in_progress || 0;
  const overdueCount = stats.overdue || 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workflow Tasks</h1>
          <p className="text-muted-foreground">
            Human-in-the-loop approvals and decisions for Temporal workflows
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              In Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inProgressCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overdue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{overdueCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              By Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(stats.byCategory || {}).map(([cat, count]) => (
                <Badge key={cat} variant="outline" className="text-xs">
                  {cat}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="billing">Billing</SelectItem>
                <SelectItem value="payment">Payment</SelectItem>
                <SelectItem value="scheduling">Scheduling</SelectItem>
                <SelectItem value="quote">Quote</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="crew">Crew</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[150px]">
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
          </div>
        </CardContent>
      </Card>

      {/* Tasks Table */}
      <Card>
        <CardContent className="p-0">
          {tasksLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No tasks found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((task) => (
                  <TableRow
                    key={task.taskId}
                    className={isOverdue(task.dueBy) && task.status === "pending" ? "bg-red-50 dark:bg-red-950/20" : ""}
                  >
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{task.title}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {task.taskId.slice(0, 8)}...
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        {categoryIcons[task.category]}
                        {task.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={priorityColors[task.priority]}>
                        {task.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[task.status]}>
                        {task.status.replace("_", " ")}
                      </Badge>
                      {isOverdue(task.dueBy) && task.status === "pending" && (
                        <Badge variant="destructive" className="ml-2">
                          Overdue
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{task.assignedRole}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {getTimeAgo(new Date(task.createdAt))}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {task.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => {
                                setSelectedTask(task);
                                setResolution("approved");
                              }}
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedTask(task);
                                setResolution("rejected");
                              }}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                escalateMutation.mutate({
                                  taskId: task.taskId,
                                  targetRole: "owner",
                                });
                              }}
                            >
                              <ArrowUpCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {task.status === "completed" && (
                          <Badge variant="outline" className="text-green-600">
                            {task.resolution}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Resolution Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {resolution === "approved" ? "Approve Task" : "Reject Task"}
            </DialogTitle>
            <DialogDescription>
              {selectedTask?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Resolution Notes</label>
              <Textarea
                placeholder="Add any notes about this decision..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
            {selectedTask?.description && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm">{selectedTask.description}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTask(null)}>
              Cancel
            </Button>
            <Button
              variant={resolution === "approved" ? "default" : "destructive"}
              onClick={() => {
                if (selectedTask) {
                  resolveMutation.mutate({
                    taskId: selectedTask.taskId,
                    resolution,
                    notes,
                  });
                }
              }}
              disabled={resolveMutation.isPending}
            >
              {resolveMutation.isPending ? "Processing..." : resolution === "approved" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
