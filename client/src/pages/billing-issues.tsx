import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
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
import { 
  Search, 
  Filter, 
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  FileText,
  MessageSquare,
  CreditCard,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { BillingIssue, BillingIssueType, BillingIssueSeverity } from "@shared/schema";

const typeLabels: Record<string, string> = {
  VARIANCE: "Variance",
  SYNC_ERROR: "Sync Error",
  DISPUTE: "Dispute",
  OVERDUE: "Overdue",
  PAYMENT_FAILED: "Payment Failed",
  CREDIT_REQUEST: "Credit Request",
  REFUND_REQUEST: "Refund Request",
};

const typeIcons: Record<string, React.ElementType> = {
  VARIANCE: AlertCircle,
  SYNC_ERROR: RefreshCw,
  DISPUTE: MessageSquare,
  OVERDUE: Clock,
  PAYMENT_FAILED: CreditCard,
  CREDIT_REQUEST: FileText,
  REFUND_REQUEST: FileText,
};

const severityVariants: Record<string, string> = {
  LOW: "outline",
  MED: "secondary",
  HIGH: "destructive",
};

const statusVariants: Record<string, string> = {
  OPEN: "destructive",
  IN_PROGRESS: "secondary",
  RESOLVED: "outline",
};

function IssueRow({ 
  issue, 
  isSelected, 
  onSelect 
}: { 
  issue: BillingIssue; 
  isSelected: boolean; 
  onSelect: () => void;
}) {
  const Icon = typeIcons[issue.type] || AlertTriangle;
  const isHigh = issue.severity === 'HIGH';

  return (
    <div
      className={`p-3 rounded-md cursor-pointer transition-colors ${
        isSelected 
          ? 'bg-accent' 
          : 'hover-elevate'
      }`}
      onClick={onSelect}
      data-testid={`issue-row-${issue.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <Icon className={`h-4 w-4 ${isHigh ? 'text-destructive' : 'text-muted-foreground'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium truncate">{issue.summary}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={severityVariants[issue.severity] as any} className="text-xs">
              {issue.severity}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {typeLabels[issue.type] || issue.type}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

function IssueDetail({ issue }: { issue: BillingIssue | null }) {
  const resolveMutation = useMutation({
    mutationFn: async (issueId: number) => {
      await apiRequest('PATCH', `/api/billing/issues/${issueId}/resolve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/billing/issues'] });
      queryClient.invalidateQueries({ queryKey: ['/api/billing/overview'] });
    },
  });

  if (!issue) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
        <h3 className="text-lg font-medium mb-2">No issues selected</h3>
        <p className="text-sm text-muted-foreground">
          Select an issue from the list to view details and take action
        </p>
      </div>
    );
  }

  const Icon = typeIcons[issue.type] || AlertTriangle;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-medium">{issue.summary}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant={severityVariants[issue.severity] as any}>
                {issue.severity} Severity
              </Badge>
              <Badge variant={statusVariants[issue.status] as any}>
                {issue.status}
              </Badge>
              <Badge variant="outline">
                {typeLabels[issue.type] || issue.type}
              </Badge>
            </div>
          </div>
        </div>
        {issue.status !== 'RESOLVED' && (
          <Button 
            onClick={() => resolveMutation.mutate(issue.id)}
            disabled={resolveMutation.isPending}
            data-testid="button-resolve-issue"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            {resolveMutation.isPending ? 'Resolving...' : 'Mark Resolved'}
          </Button>
        )}
      </div>

      <Separator />

      <div className="space-y-3">
        {issue.relatedInvoiceId && (
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Related Invoice:</span>
            <span className="font-medium">INV-{issue.relatedInvoiceId}</span>
          </div>
        )}
        {issue.relatedJobId && (
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Related Job:</span>
            <span className="font-medium">JOB-{issue.relatedJobId}</span>
          </div>
        )}
      </div>

      {issue.detailsJson && (
        <>
          <Separator />
          <div>
            <h4 className="text-sm font-medium mb-2">Details</h4>
            <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
              {String(JSON.stringify(issue.detailsJson, null, 2))}
            </pre>
          </div>
        </>
      )}

      <Separator />

      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
        <div className="flex items-center gap-1">
          <Clock className="h-4 w-4" />
          <span>Created {new Date(issue.createdAt).toLocaleDateString()}</span>
        </div>
        {issue.resolvedAt && (
          <div className="flex items-center gap-1">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>Resolved {new Date(issue.resolvedAt).toLocaleDateString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BillingIssuesPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("OPEN");
  const [severityFilter, setSeverityFilter] = useState<string>("all");

  const { data: issues = [], isLoading } = useQuery<BillingIssue[]>({
    queryKey: ['/api/billing/issues', { 
      status: statusFilter !== 'all' ? statusFilter : undefined,
      severity: severityFilter !== 'all' ? severityFilter : undefined,
    }],
  });

  const filteredIssues = issues;

  const selectedIssue = filteredIssues.find(i => i.id === selectedId) || null;

  const openCount = issues.filter(i => i.status === 'OPEN').length;
  const highCount = issues.filter(i => i.severity === 'HIGH' && i.status !== 'RESOLVED').length;

  return (
    <div className="flex h-full">
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {openCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {openCount} Open
              </Badge>
            )}
            {highCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {highCount} High Priority
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="flex-1" data-testid="select-issue-status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="flex-1" data-testid="select-issue-severity-filter">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MED">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground">Loading...</div>
            ) : filteredIssues.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle className="h-10 w-10 text-green-500 mb-3" />
                <p className="text-sm text-muted-foreground">No issues</p>
                <p className="text-xs text-muted-foreground mt-1">
                  All billing is running smoothly
                </p>
              </div>
            ) : (
              filteredIssues.map((issue) => (
                <IssueRow
                  key={issue.id}
                  issue={issue}
                  isSelected={selectedId === issue.id}
                  onSelect={() => setSelectedId(issue.id)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1">
        <ScrollArea className="h-full">
          <IssueDetail issue={selectedIssue} />
        </ScrollArea>
      </div>
    </div>
  );
}
