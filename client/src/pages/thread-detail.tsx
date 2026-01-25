import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import {
  Send,
  Paperclip,
  MessageSquare,
  User,
  Phone,
  Clock,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  Search,
  BookOpen,
  Zap,
  ArrowUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getQueryFn, apiRequest } from "@/lib/queryClient";

interface ThreadMessage {
  id: number;
  role: "customer" | "assistant" | "staff";
  content: string;
  senderUserId: number | null;
  senderName: string | null;
  isInternal: boolean;
  createdAt: string;
}

interface ThreadDetail {
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
  createdAt: string;
  messages: ThreadMessage[];
}

interface KnowledgeSuggestion {
  id: number;
  title: string;
  itemType: string;
  snippet: string;
  relevanceScore: number;
}

interface MacroTemplate {
  id: number;
  title: string;
  content: string;
  category: string;
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

const slaIcons: Record<string, string> = {
  overdue: "🔴",
  critical: "🟠",
  soon: "🟡",
  ok: "🟢",
};

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function MessageBubble({ message }: { message: ThreadMessage }) {
  const isCustomer = message.role === "customer";
  const isStaff = message.role === "staff";
  const isAssistant = message.role === "assistant";

  return (
    <div className={`flex ${isCustomer ? "justify-start" : "justify-end"} mb-4`}>
      <div className={`max-w-[70%] ${isCustomer ? "" : "text-right"}`}>
        <div className="flex items-center gap-2 mb-1">
          {isCustomer && <User className="h-3 w-3 text-muted-foreground" />}
          <span className="text-xs text-muted-foreground">
            {isCustomer ? "Customer" : isStaff ? message.senderName || "Staff" : "AI Assistant"}
            {" • "}
            {formatTime(message.createdAt)}
          </span>
          {message.isInternal && (
            <Badge variant="outline" className="text-xs px-1 py-0 h-4">
              Internal
            </Badge>
          )}
        </div>
        <div
          className={`rounded-lg px-4 py-2 ${
            isCustomer
              ? "bg-muted text-foreground"
              : isStaff
              ? "bg-primary text-primary-foreground"
              : "bg-purple-500/10 text-purple-900 dark:text-purple-100 border border-purple-200 dark:border-purple-800"
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    </div>
  );
}

function KnowledgeSuggestionCard({ suggestion }: { suggestion: KnowledgeSuggestion }) {
  return (
    <Card className="hover:border-primary transition-colors cursor-pointer">
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <BookOpen className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <Link href={`/knowledge/${suggestion.id}`}>
              <h4 className="text-sm font-medium hover:text-primary line-clamp-1">
                {suggestion.title}
              </h4>
            </Link>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {suggestion.snippet}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                {suggestion.itemType}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {Math.round(suggestion.relevanceScore * 100)}% match
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ThreadDetailPage() {
  const [, params] = useRoute("/support/thread/:id");
  const threadId = params?.id ? parseInt(params.id) : null;
  const [replyContent, setReplyContent] = useState("");
  const [knowledgeSearch, setKnowledgeSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: thread, isLoading } = useQuery<ThreadDetail>({
    queryKey: [`/api/support/queue/${threadId}`],
    queryFn: getQueryFn({
      on200: (data) => data,
    }),
    enabled: !!threadId,
  });

  const { data: suggestions } = useQuery<KnowledgeSuggestion[]>({
    queryKey: [`/api/knowledge/search`, thread?.intent],
    queryFn: getQueryFn({
      on200: (data) => data,
    }),
    enabled: !!thread?.intent,
  });

  const { data: macros } = useQuery<MacroTemplate[]>({
    queryKey: ["/api/knowledge/items?type=macro"],
    queryFn: getQueryFn({
      on200: (data) => data,
    }),
  });

  const sendMessageMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest("POST", `/api/assistant/conversations/${threadId}/messages`, {
        content,
        role: "staff",
      }),
    onSuccess: () => {
      setReplyContent("");
      queryClient.invalidateQueries({ queryKey: [`/api/support/queue/${threadId}`] });
    },
  });

  const firstResponseMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/support/queue/${threadId}/first-response`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/support/queue/${threadId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/support/queue"] });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/support/queue/${threadId}/resolve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/support/queue/${threadId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/support/queue"] });
    },
  });

  const changePriorityMutation = useMutation({
    mutationFn: (priority: string) =>
      apiRequest("PATCH", `/api/support/queue/${threadId}/priority`, { priority }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/support/queue/${threadId}`] });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages]);

  const handleSendMessage = () => {
    if (replyContent.trim() && threadId) {
      sendMessageMutation.mutate(replyContent);
    }
  };

  const handleInsertMacro = (macroContent: string) => {
    setReplyContent((prev) => (prev ? `${prev}\n\n${macroContent}` : macroContent));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-12 w-64 mb-6" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Thread not found</h3>
            <Button asChild className="mt-4">
              <Link href="/support/queue">Back to Queue</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/support/queue">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Queue
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{thread.customerName}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {thread.customerPhone}
          </p>
        </div>
        {!thread.resolvedAt && (
          <Button
            variant="outline"
            onClick={() => resolveMutation.mutate()}
            disabled={resolveMutation.isPending}
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Mark Resolved
          </Button>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Thread */}
        <div className="lg:col-span-2 space-y-4">
          {/* Messages */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Conversation</span>
                <div className="flex items-center gap-2">
                  {!thread.firstResponseAt && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => firstResponseMutation.mutate()}
                      disabled={firstResponseMutation.isPending}
                    >
                      Mark First Response
                    </Button>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                {thread.messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
                <div ref={messagesEndRef} />
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Reply Box */}
          {!thread.resolvedAt && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Send Reply</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <MessageSquare className="h-3.5 w-3.5 mr-1" />
                        Insert Macro
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      {macros?.slice(0, 5).map((macro) => (
                        <DropdownMenuItem
                          key={macro.id}
                          onClick={() => handleInsertMacro(macro.content)}
                        >
                          <div>
                            <div className="font-medium text-sm">{macro.title}</div>
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {macro.content}
                            </div>
                          </div>
                        </DropdownMenuItem>
                      ))}
                      {!macros?.length && (
                        <DropdownMenuItem disabled>No macros available</DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Type your message... (Cmd/Ctrl+Enter to send)"
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="min-h-[120px] mb-3"
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled>
                      <Paperclip className="h-3.5 w-3.5 mr-1" />
                      Attach
                    </Button>
                  </div>
                  <Button
                    onClick={handleSendMessage}
                    disabled={!replyContent.trim() || sendMessageMutation.isPending}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send Message
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Thread Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Thread Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground">Intent</label>
                <p className="text-sm font-medium">{thread.intent}</p>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Priority</label>
                <div className="mt-1">
                  <Select
                    value={thread.priority}
                    onValueChange={(value) => changePriorityMutation.mutate(value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Coverage</label>
                <div className="mt-1">
                  <Badge variant="outline" className={coverageColors[thread.coverageStatus]}>
                    {thread.coverageStatus.charAt(0).toUpperCase() + thread.coverageStatus.slice(1)}
                  </Badge>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">SLA Status</label>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-lg">{slaIcons[thread.slaStatus]}</span>
                  <span className="text-sm font-medium">{thread.timeToSLA}</span>
                </div>
              </div>

              {thread.claimedByName && (
                <div>
                  <label className="text-xs text-muted-foreground">Assigned To</label>
                  <div className="flex items-center gap-1 mt-1">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm">{thread.claimedByName}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs text-muted-foreground">Created</label>
                <p className="text-sm">{formatTime(thread.createdAt)}</p>
              </div>

              {thread.firstResponseAt && (
                <div>
                  <label className="text-xs text-muted-foreground">First Response</label>
                  <p className="text-sm">{formatTime(thread.firstResponseAt)}</p>
                </div>
              )}

              {thread.resolvedAt && (
                <div>
                  <label className="text-xs text-muted-foreground">Resolved</label>
                  <p className="text-sm">{formatTime(thread.resolvedAt)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Knowledge Suggestions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                Knowledge Suggestions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {suggestions && suggestions.length > 0 ? (
                suggestions.slice(0, 3).map((suggestion) => (
                  <KnowledgeSuggestionCard key={suggestion.id} suggestion={suggestion} />
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No knowledge articles found for this intent
                </p>
              )}
              <Button variant="outline" size="sm" className="w-full mt-2" asChild>
                <Link href={`/knowledge?search=${thread.intent}`}>
                  <Search className="h-3.5 w-3.5 mr-1" />
                  Search Knowledge
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
