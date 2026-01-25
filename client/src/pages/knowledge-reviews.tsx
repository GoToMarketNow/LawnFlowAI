import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  Filter,
  BookOpen,
  FileText,
  CreditCard,
  Settings,
  Camera,
  MessageSquare,
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getQueryFn, apiRequest } from "@/lib/queryClient";

interface KnowledgeReview {
  id: number;
  knowledgeItemId: number;
  itemTitle: string;
  itemType: string;
  dueDate: string;
  urgency: "high" | "medium" | "low";
  status: "pending" | "completed" | "overdue";
  lastReviewedAt: string | null;
  lastReviewedBy: number | null;
  reviewReason: string;
}

interface ReviewStats {
  overdue: number;
  dueThisWeek: number;
  dueThisMonth: number;
  total: number;
}

const itemTypeIcons: Record<string, React.ReactNode> = {
  policy: <BookOpen className="h-4 w-4" />,
  service: <Settings className="h-4 w-4" />,
  payment: <CreditCard className="h-4 w-4" />,
  operations: <FileText className="h-4 w-4" />,
  proof_of_work: <Camera className="h-4 w-4" />,
  macro: <MessageSquare className="h-4 w-4" />,
};

const urgencyColors: Record<string, string> = {
  high: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
  medium: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
  low: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
};

const statusColors: Record<string, string> = {
  pending: "bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700",
  overdue: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
  completed: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800",
};

function getTimeUntilDue(dueDate: string): { text: string; isOverdue: boolean; isSoon: boolean } {
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMs < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      text: overdueDays === 0 ? "Overdue today" : `Overdue ${overdueDays}d`,
      isOverdue: true,
      isSoon: false,
    };
  }

  if (diffDays === 0) {
    return { text: "Due today", isOverdue: false, isSoon: true };
  }

  if (diffDays === 1) {
    return { text: "Due tomorrow", isOverdue: false, isSoon: true };
  }

  if (diffDays < 7) {
    return { text: `Due in ${diffDays}d`, isOverdue: false, isSoon: true };
  }

  if (diffDays < 30) {
    return { text: `Due in ${diffDays}d`, isOverdue: false, isSoon: false };
  }

  return { text: `Due in ${Math.floor(diffDays / 30)}mo`, isOverdue: false, isSoon: false };
}

function ReviewCard({ review }: { review: KnowledgeReview }) {
  const queryClient = useQueryClient();

  const completeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/knowledge/reviews/${review.id}/complete`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/reviews/due"] });
    },
  });

  const handleComplete = () => {
    if (confirm(`Mark review as completed for "${review.itemTitle}"?`)) {
      completeMutation.mutate();
    }
  };

  const { text: dueText, isOverdue, isSoon } = getTimeUntilDue(review.dueDate);
  const urgencyLabel = review.urgency.charAt(0).toUpperCase() + review.urgency.slice(1);

  return (
    <Card className="hover-elevate transition-all">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-1.5">
                {itemTypeIcons[review.itemType]}
                <span className="text-xs text-muted-foreground capitalize">
                  {review.itemType.replace(/_/g, " ")}
                </span>
              </div>
              <Badge variant="outline" className={urgencyColors[review.urgency]}>
                {urgencyLabel} Priority
              </Badge>
            </div>

            <Link href={`/knowledge/${review.knowledgeItemId}`}>
              <h3 className="font-semibold text-base hover:text-primary transition-colors cursor-pointer line-clamp-1">
                {review.itemTitle}
              </h3>
            </Link>

            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span className={isOverdue ? "text-red-600 dark:text-red-400 font-medium" : isSoon ? "text-yellow-600 dark:text-yellow-400 font-medium" : ""}>
                  {dueText}
                </span>
              </div>
              <span>•</span>
              <span className="line-clamp-1">{review.reviewReason}</span>
            </div>

            {review.lastReviewedAt && (
              <div className="text-xs text-muted-foreground mt-1">
                Last reviewed {new Date(review.lastReviewedAt).toLocaleDateString()}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleComplete}
              disabled={completeMutation.isPending}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Mark Reviewed
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function KnowledgeReviewsPage() {
  const [urgencyFilter, setUrgencyFilter] = useState<string>("all");

  const { data: reviews, isLoading } = useQuery<KnowledgeReview[]>({
    queryKey: ["/api/knowledge/reviews/due", urgencyFilter],
    queryFn: getQueryFn({
      on200: (data) => data,
    }),
  });

  const { data: stats } = useQuery<ReviewStats>({
    queryKey: ["/api/knowledge/reviews/stats"],
    queryFn: getQueryFn({
      on200: (data) => data,
    }),
  });

  const filteredReviews = reviews?.filter((review) => {
    if (urgencyFilter === "all") return true;
    return review.urgency === urgencyFilter;
  }) || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Knowledge Reviews</h1>
          <p className="text-muted-foreground mt-1">
            Scheduled knowledge base reviews to keep content fresh
          </p>
        </div>
        <Button asChild>
          <Link href="/knowledge">
            <BookOpen className="h-4 w-4 mr-2" />
            View All Knowledge
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            {stats ? (
              <>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {stats.overdue}
                </div>
                <p className="text-xs text-muted-foreground">Need immediate attention</p>
              </>
            ) : (
              <Skeleton className="h-8 w-16" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Due This Week</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            {stats ? (
              <>
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {stats.dueThisWeek}
                </div>
                <p className="text-xs text-muted-foreground">Next 7 days</p>
              </>
            ) : (
              <Skeleton className="h-8 w-16" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Due This Month</CardTitle>
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {stats ? (
              <>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.dueThisMonth}
                </div>
                <p className="text-xs text-muted-foreground">Next 30 days</p>
              </>
            ) : (
              <Skeleton className="h-8 w-16" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pending</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {stats ? (
              <>
                <div className="text-2xl font-bold">{stats.total}</div>
                <p className="text-xs text-muted-foreground">All reviews</p>
              </>
            ) : (
              <Skeleton className="h-8 w-16" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Help Alert */}
      {stats && stats.overdue > 0 && (
        <Alert className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          <AlertDescription className="text-red-800 dark:text-red-300">
            You have {stats.overdue} overdue review{stats.overdue !== 1 ? "s" : ""}. Outdated knowledge can lead to
            incorrect AI responses. Review these items as soon as possible.
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filter by urgency:</span>
        </div>
        <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All urgencies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Urgencies</SelectItem>
            <SelectItem value="high">High Priority</SelectItem>
            <SelectItem value="medium">Medium Priority</SelectItem>
            <SelectItem value="low">Low Priority</SelectItem>
          </SelectContent>
        </Select>
        {filteredReviews && (
          <span className="text-sm text-muted-foreground">
            {filteredReviews.length} review{filteredReviews.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : filteredReviews.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
              <p className="text-muted-foreground mb-4">
                {urgencyFilter === "all"
                  ? "No pending knowledge reviews at this time."
                  : `No ${urgencyFilter} priority reviews pending.`}
              </p>
              <Button asChild variant="outline">
                <Link href="/knowledge">View Knowledge Base</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredReviews.map((review) => <ReviewCard key={review.id} review={review} />)
        )}
      </div>
    </div>
  );
}
