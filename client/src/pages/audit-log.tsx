import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  MessageSquare,
  ClipboardList,
  CheckCircle,
  Clock,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { useState } from "react";
import type { AuditLog } from "@shared/schema";

const entityIcons: Record<string, React.ReactNode> = {
  conversation: <MessageSquare className="h-4 w-4" />,
  job: <ClipboardList className="h-4 w-4" />,
  action: <CheckCircle className="h-4 w-4" />,
  event: <Clock className="h-4 w-4" />,
};

const actionColors: Record<string, string> = {
  created: "bg-green-500/10 text-green-600 dark:text-green-400",
  updated: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  approved: "bg-green-500/10 text-green-600 dark:text-green-400",
  rejected: "bg-red-500/10 text-red-600 dark:text-red-400",
  processed: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  message_sent: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

function formatDetails(details: unknown): string {
  if (!details) return "-";
  if (typeof details === "string") return details;
  try {
    const obj = details as Record<string, unknown>;
    return Object.entries(obj)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
  } catch {
    return JSON.stringify(details);
  }
}

export default function AuditLogPage() {
  const [entityFilter, setEntityFilter] = useState<string>("all");

  const { data: logs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/audit-logs"],
  });

  const filteredLogs = logs?.filter(
    (log) => entityFilter === "all" || log.entityType === entityFilter
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          Audit Log
        </h1>
        <p className="text-sm text-muted-foreground">
          Track all system actions and changes
        </p>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="w-[160px]" data-testid="select-entity-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="conversation">Conversations</SelectItem>
              <SelectItem value="job">Jobs</SelectItem>
              <SelectItem value="action">Actions</SelectItem>
              <SelectItem value="event">Events</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Badge variant="secondary">{filteredLogs?.length || 0} entries</Badge>
      </div>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Activity Log
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          ) : filteredLogs && filteredLogs.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Type</TableHead>
                  <TableHead className="w-[80px]">ID</TableHead>
                  <TableHead className="w-[120px]">Action</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="w-[180px]">Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded bg-muted flex items-center justify-center">
                          {entityIcons[log.entityType] || <FileText className="h-4 w-4" />}
                        </div>
                        <span className="text-xs capitalize">{log.entityType}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        #{log.entityId}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={actionColors[log.action] || ""}
                      >
                        {log.action.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                      {formatDetails(log.details)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-12 text-center">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No audit logs yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Actions will be logged as you use the system
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
