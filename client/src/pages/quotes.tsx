import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  FileText,
  Plus,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  User,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { quoteStatuses, type QuoteStatus } from "@/lib/ui/tokens";

interface Quote {
  id: number;
  customerName: string;
  customerPhone?: string;
  amount: number;
  status: string;
  services: string[];
  createdAt: string;
  sentAt?: string;
  expiresAt?: string;
}

function QuoteCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-md" />
          <div className="flex-1">
            <Skeleton className="h-4 w-32 mb-2" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-8 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

function QuoteCard({ quote, onSend, isSending }: { 
  quote: Quote; 
  onSend: () => void;
  isSending: boolean;
}) {
  const status = (quote.status?.toLowerCase() || "draft") as QuoteStatus;
  const statusConfig = quoteStatuses[status] || quoteStatuses.draft;

  return (
    <Card className="hover-elevate" data-testid={`quote-card-${quote.id}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="p-2 rounded-md bg-muted">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">{quote.customerName}</span>
              <Badge className={statusConfig.color}>
                {statusConfig.label}
              </Badge>
            </div>
            
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>{quote.services.slice(0, 2).join(", ")}</span>
              <span>{format(new Date(quote.createdAt), "MMM d, yyyy")}</span>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-lg font-semibold">
              ${(quote.amount / 100).toFixed(2)}
            </div>
          </div>
          
          {status === "draft" && (
            <Button
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSend();
              }}
              disabled={isSending}
              data-testid={`button-send-quote-${quote.id}`}
            >
              <Send className="h-4 w-4 mr-1" />
              Send
            </Button>
          )}
          
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function QuotesPage() {
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data, isLoading } = useQuery<{ quotes: Quote[] }>({
    queryKey: ["/api/quotes"],
    retry: false,
  });

  const sendMutation = useMutation({
    mutationFn: async (quoteId: number) => {
      await apiRequest("POST", `/api/quotes/${quoteId}/send`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Quote sent", description: "The customer will receive the quote shortly." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to send quote", description: error.message, variant: "destructive" });
    },
  });

  const quotes = data?.quotes || [];

  const filteredQuotes = quotes.filter((quote) => {
    if (filterStatus === "all") return true;
    return quote.status?.toLowerCase() === filterStatus;
  });

  const stats = {
    draft: quotes.filter((q) => q.status?.toLowerCase() === "draft").length,
    sent: quotes.filter((q) => q.status?.toLowerCase() === "sent").length,
    accepted: quotes.filter((q) => q.status?.toLowerCase() === "accepted").length,
    total: quotes.reduce((sum, q) => sum + (q.amount || 0), 0),
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Quotes</h1>
          <p className="text-sm text-muted-foreground">
            {quotes.length} {quotes.length === 1 ? "quote" : "quotes"}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32" data-testid="select-filter-status">
              <SelectValue placeholder="All status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
          
          <Link href="/quote-builder">
            <Button data-testid="button-new-quote">
              <Plus className="h-4 w-4 mr-1" />
              New Quote
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold">{stats.draft}</div>
            <div className="text-xs text-muted-foreground">Draft</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold">{stats.sent}</div>
            <div className="text-xs text-muted-foreground">Sent</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold text-green-600 dark:text-green-400">{stats.accepted}</div>
            <div className="text-xs text-muted-foreground">Accepted</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-semibold">${(stats.total / 100).toFixed(0)}</div>
            <div className="text-xs text-muted-foreground">Total Value</div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <QuoteCardSkeleton />
          <QuoteCardSkeleton />
          <QuoteCardSkeleton />
        </div>
      ) : filteredQuotes.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">
              {quotes.length === 0 ? "No quotes yet" : "No quotes match filter"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {quotes.length === 0
                ? "Create your first quote to get started."
                : "Try adjusting your filter."}
            </p>
            {quotes.length === 0 && (
              <Link href="/quote-builder">
                <Button>
                  <Plus className="h-4 w-4 mr-1" />
                  Create Quote
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredQuotes.map((quote) => (
            <QuoteCard
              key={quote.id}
              quote={quote}
              onSend={() => sendMutation.mutate(quote.id)}
              isSending={sendMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
