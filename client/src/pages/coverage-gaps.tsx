import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  TrendingUp,
  AlertTriangle,
  Plus,
  Filter,
  Search,
  MessageSquare,
  CheckCircle2,
  ArrowUpRight,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getQueryFn, apiRequest } from "@/lib/queryClient";

interface CoverageGap {
  intent: string;
  frequency: number;
  exampleQuestions: string[];
  suggestedKnowledgeType: "policy" | "service" | "payment" | "operations";
  suggestedTitle: string;
  priority: "high" | "medium" | "low";
  firstSeen: string;
  lastSeen: string;
}

interface GapStats {
  totalGaps: number;
  highFrequencyGaps: number;
  recentlyEmerged: number;
  totalUncoveredQueries: number;
}

interface TrendData {
  date: string;
  coverageRate: number;
  uncoveredQueries: number;
}

const priorityColors: Record<string, string> = {
  high: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800",
  medium: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
  low: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
};

const knowledgeTypeColors: Record<string, string> = {
  policy: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  service: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  payment: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800",
  operations: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800",
};

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function GapRow({ gap }: { gap: CoverageGap }) {
  const queryClient = useQueryClient();

  const createKnowledgeMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/knowledge/items", {
        itemType: gap.suggestedKnowledgeType,
        title: gap.suggestedTitle,
        status: "draft",
        content: {
          summary: `Knowledge article to address: ${gap.intent}`,
          examples: gap.exampleQuestions,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/coverage-gaps"] });
    },
  });

  const handleCreateKnowledge = () => {
    if (confirm(`Create a new ${gap.suggestedKnowledgeType} knowledge item for "${gap.suggestedTitle}"?`)) {
      createKnowledgeMutation.mutate();
    }
  };

  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell>
        <div className="space-y-1">
          <div className="font-medium">{gap.intent}</div>
          <Badge variant="outline" className={priorityColors[gap.priority]}>
            {gap.priority.charAt(0).toUpperCase() + gap.priority.slice(1)} Priority
          </Badge>
        </div>
      </TableCell>
      <TableCell>
        <div className="text-center">
          <div className="text-lg font-bold">{gap.frequency}</div>
          <div className="text-xs text-muted-foreground">queries</div>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1 max-w-md">
          {gap.exampleQuestions.slice(0, 2).map((question, idx) => (
            <div key={idx} className="flex items-start gap-1.5">
              <MessageSquare className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
              <span className="text-sm text-muted-foreground line-clamp-1">{question}</span>
            </div>
          ))}
          {gap.exampleQuestions.length > 2 && (
            <span className="text-xs text-muted-foreground">
              +{gap.exampleQuestions.length - 2} more
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <Badge variant="outline" className={knowledgeTypeColors[gap.suggestedKnowledgeType]}>
            {gap.suggestedKnowledgeType.charAt(0).toUpperCase() + gap.suggestedKnowledgeType.slice(1)}
          </Badge>
          <div className="text-xs text-muted-foreground line-clamp-1">{gap.suggestedTitle}</div>
        </div>
      </TableCell>
      <TableCell>
        <div className="text-sm text-muted-foreground">
          <div>First: {getTimeAgo(gap.firstSeen)}</div>
          <div>Last: {getTimeAgo(gap.lastSeen)}</div>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="default"
          size="sm"
          onClick={handleCreateKnowledge}
          disabled={createKnowledgeMutation.isPending}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Create Knowledge
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function CoverageGapsPage() {
  const [timeRange, setTimeRange] = useState<string>("30d");
  const [minFrequency, setMinFrequency] = useState<string>("5");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const { data: gaps, isLoading } = useQuery<CoverageGap[]>({
    queryKey: ["/api/support/coverage-gaps", timeRange, minFrequency],
    queryFn: getQueryFn({
      on200: (data) => data,
    }),
  });

  const { data: stats } = useQuery<GapStats>({
    queryKey: ["/api/support/coverage-gaps/stats", timeRange],
    queryFn: getQueryFn({
      on200: (data) => data,
    }),
  });

  const { data: trends } = useQuery<TrendData[]>({
    queryKey: ["/api/support/coverage-gaps/trends", timeRange],
    queryFn: getQueryFn({
      on200: (data) => data,
    }),
  });

  const filteredGaps = gaps?.filter((gap) => {
    if (priorityFilter === "all") return true;
    return gap.priority === priorityFilter;
  }) || [];

  const avgCoverageRate = trends
    ? (trends.reduce((sum, t) => sum + t.coverageRate, 0) / trends.length).toFixed(1)
    : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Coverage Gaps</h1>
          <p className="text-muted-foreground mt-1">
            Identify uncovered customer intents and create knowledge articles
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/support/queue">
              <MessageSquare className="h-4 w-4 mr-2" />
              Support Queue
            </Link>
          </Button>
          <Button asChild>
            <Link href="/knowledge/builder">
              <Plus className="h-4 w-4 mr-2" />
              Knowledge Builder
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gaps</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            {stats ? (
              <>
                <div className="text-2xl font-bold">{stats.totalGaps}</div>
                <p className="text-xs text-muted-foreground">Uncovered intents</p>
              </>
            ) : (
              <Skeleton className="h-8 w-16" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Frequency</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            {stats ? (
              <>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {stats.highFrequencyGaps}
                </div>
                <p className="text-xs text-muted-foreground">&gt;10 queries/week</p>
              </>
            ) : (
              <Skeleton className="h-8 w-16" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recently Emerged</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {stats ? (
              <>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.recentlyEmerged}
                </div>
                <p className="text-xs text-muted-foreground">Last 7 days</p>
              </>
            ) : (
              <Skeleton className="h-8 w-16" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Coverage Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {trends ? (
              <>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {avgCoverageRate}%
                </div>
                <p className="text-xs text-muted-foreground">Avg last {timeRange}</p>
              </>
            ) : (
              <Skeleton className="h-8 w-16" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Help Alert */}
      {stats && stats.highFrequencyGaps > 0 && (
        <Alert className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20">
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertDescription className="text-yellow-800 dark:text-yellow-300">
            You have {stats.highFrequencyGaps} high-frequency gap{stats.highFrequencyGaps !== 1 ? "s" : ""}
            . Creating knowledge articles for these intents will significantly improve AI coverage and reduce support burden.
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filters:</span>
        </div>

        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>

        <Select value={minFrequency} onValueChange={setMinFrequency}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Min frequency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">All frequencies</SelectItem>
            <SelectItem value="5">5+ queries</SelectItem>
            <SelectItem value="10">10+ queries</SelectItem>
            <SelectItem value="20">20+ queries</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        {filteredGaps && (
          <span className="text-sm text-muted-foreground ml-auto">
            {filteredGaps.length} gap{filteredGaps.length !== 1 ? "s" : ""} • {stats?.totalUncoveredQueries || 0} total queries
          </span>
        )}
      </div>

      {/* Coverage Trend Chart */}
      {trends && trends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Coverage Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {trends.slice(0, 7).map((trend, idx) => {
                const date = new Date(trend.date);
                const coverageRate = trend.coverageRate;
                const barWidth = coverageRate;
                const barColor =
                  coverageRate >= 80
                    ? "bg-green-500"
                    : coverageRate >= 60
                    ? "bg-yellow-500"
                    : "bg-red-500";

                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="text-xs text-muted-foreground w-20">
                      {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                    <div className="flex-1 bg-muted rounded-full h-6 relative overflow-hidden">
                      <div
                        className={`${barColor} h-full rounded-full transition-all duration-300`}
                        style={{ width: `${barWidth}%` }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-medium mix-blend-difference text-white">
                          {coverageRate.toFixed(1)}% coverage
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground w-20 text-right">
                      {trend.uncoveredQueries} uncovered
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gaps Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredGaps.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No coverage gaps!</h3>
              <p className="text-muted-foreground mb-4">
                Your knowledge base covers all customer intents within the selected time range.
              </p>
              <Button asChild variant="outline">
                <Link href="/knowledge">View Knowledge Base</Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Intent</TableHead>
                  <TableHead className="text-center">Frequency</TableHead>
                  <TableHead>Example Questions</TableHead>
                  <TableHead>Suggested Action</TableHead>
                  <TableHead>Timeline</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGaps.map((gap, idx) => (
                  <GapRow key={idx} gap={gap} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
