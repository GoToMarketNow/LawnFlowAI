import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  CheckCircle,
  XCircle,
  Eye,
  Clock,
  AlertCircle,
  FileText,
  BookOpen,
  Settings,
  CreditCard,
  Camera,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getQueryFn, apiRequest } from "@/lib/queryClient";

interface PendingApproval {
  id: number;
  knowledgeItemId: number;
  versionId: number;
  itemType: string;
  title: string;
  category: string;
  status: string;
  requestedBy: number;
  requestedAt: string;
  changeNotes?: string;
}

const itemTypeIcons: Record<string, React.ReactNode> = {
  policy: <BookOpen className="h-4 w-4" />,
  service: <Settings className="h-4 w-4" />,
  payment: <CreditCard className="h-4 w-4" />,
  operations: <FileText className="h-4 w-4" />,
  proof_of_work: <Camera className="h-4 w-4" />,
  macro: <MessageSquare className="h-4 w-4" />,
};

function ApprovalCard({ approval }: { approval: PendingApproval }) {
  const queryClient = useQueryClient();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const approveMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/knowledge/items/${approval.knowledgeItemId}/approve`, {
        versionId: approval.versionId,
        decision: "approved",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/approvals/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/items"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/knowledge/items/${approval.knowledgeItemId}/approve`, {
        versionId: approval.versionId,
        decision: "rejected",
        rejectionReason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/approvals/pending"] });
      setShowRejectForm(false);
      setRejectionReason("");
    },
  });

  const handleApprove = () => {
    if (confirm(`Approve and publish "${approval.title}"?`)) {
      approveMutation.mutate();
    }
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      alert("Please provide a reason for rejection");
      return;
    }
    if (confirm(`Reject "${approval.title}"?`)) {
      rejectMutation.mutate();
    }
  };

  const requestedAt = new Date(approval.requestedAt);
  const timeAgo = getTimeAgo(requestedAt);

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
            {itemTypeIcons[approval.itemType] || <FileText className="h-5 w-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1">
                <h3 className="text-base font-semibold mb-1">{approval.title}</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {approval.category}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {approval.itemType}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Requested {timeAgo}
                  </span>
                </div>
              </div>
            </div>

            {approval.changeNotes && (
              <div className="bg-muted/50 rounded-lg p-3 mb-4">
                <p className="text-xs font-medium text-muted-foreground mb-1">Change Notes:</p>
                <p className="text-sm">{approval.changeNotes}</p>
              </div>
            )}

            {!showRejectForm ? (
              <div className="flex gap-2">
                <Button size="sm" asChild variant="outline">
                  <Link href={`/knowledge/${approval.knowledgeItemId}`}>
                    <Eye className="h-4 w-4 mr-2" />
                    Review
                  </Link>
                </Button>
                <Button
                  size="sm"
                  onClick={handleApprove}
                  disabled={approveMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve & Publish
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setShowRejectForm(true)}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label htmlFor={`reject-reason-${approval.id}`} className="text-xs">
                    Rejection Reason
                  </Label>
                  <Textarea
                    id={`reject-reason-${approval.id}`}
                    placeholder="Explain why this is being rejected..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                    className="text-sm"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleReject}
                    disabled={rejectMutation.isPending}
                  >
                    Confirm Rejection
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowRejectForm(false);
                      setRejectionReason("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

export default function KnowledgeApprovalsPage() {
  const { data: approvals, isLoading } = useQuery<PendingApproval[]>({
    queryKey: ["/api/knowledge/approvals/pending"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const draftApprovals = approvals?.filter((a) => a.status === "draft") || [];
  const reviewApprovals = approvals?.filter((a) => a.status === "review") || [];

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Knowledge Approval Queue</h1>
        <p className="text-muted-foreground">
          Review and approve knowledge base items before they go live
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{approvals?.length || 0}</div>
            <div className="text-sm text-muted-foreground">Pending Approval</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">{reviewApprovals.length}</div>
            <div className="text-sm text-muted-foreground">In Review</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-gray-600">{draftApprovals.length}</div>
            <div className="text-sm text-muted-foreground">Drafts</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="review" className="space-y-6">
        <TabsList>
          <TabsTrigger value="review">
            In Review ({reviewApprovals.length})
          </TabsTrigger>
          <TabsTrigger value="drafts">
            Drafts ({draftApprovals.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            All ({approvals?.length || 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="review" className="space-y-4">
          {isLoading ? (
            <>
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="flex gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-[250px]" />
                        <Skeleton className="h-3 w-[200px]" />
                        <Skeleton className="h-8 w-[300px]" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          ) : reviewApprovals.length > 0 ? (
            reviewApprovals.map((approval) => (
              <ApprovalCard key={approval.id} approval={approval} />
            ))
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
                <p className="text-muted-foreground">
                  No items awaiting review. Check back later or view drafts.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="drafts" className="space-y-4">
          {isLoading ? (
            <>
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="flex gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-[250px]" />
                        <Skeleton className="h-3 w-[200px]" />
                        <Skeleton className="h-8 w-[300px]" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          ) : draftApprovals.length > 0 ? (
            draftApprovals.map((approval) => (
              <ApprovalCard key={approval.id} approval={approval} />
            ))
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No drafts</h3>
                <p className="text-muted-foreground">
                  No draft items found. Create new items or use the auto-generator.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          {isLoading ? (
            <>
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="flex gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-[250px]" />
                        <Skeleton className="h-3 w-[200px]" />
                        <Skeleton className="h-8 w-[300px]" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          ) : approvals && approvals.length > 0 ? (
            approvals.map((approval) => (
              <ApprovalCard key={approval.id} approval={approval} />
            ))
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No pending approvals</h3>
                <p className="text-muted-foreground">
                  All knowledge items are either published or retired.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Help Alert */}
      <Alert className="mt-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <p className="font-medium mb-1">Approval Tips:</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Review content for accuracy and completeness</li>
            <li>Check that policies align with your business practices</li>
            <li>Verify service descriptions match what you actually offer</li>
            <li>Approved items become immediately visible to the AI assistant</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}
