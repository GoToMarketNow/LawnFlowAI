import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileText, 
  Plus,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  User,
  MapPin,
  Phone,
  Loader2,
  RefreshCw,
  ChevronRight,
  MessageSquare,
  History,
  DollarSign,
  Ruler,
  Search,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Quote {
  id: number;
  customerName: string;
  customerPhone: string | null;
  customerAddress?: string;
  amount: number;
  amountLow?: number;
  amountHigh?: number;
  status: "draft" | "awaiting_approval" | "sent" | "accepted" | "declined" | "expired";
  services: string[];
  frequency?: string;
  lotSize?: number;
  assumptions?: string[];
  exclusions?: string[];
  customerMessage?: string;
  confidence?: string;
  createdAt: string;
  createdByUserId?: number;
  createdByUserName?: string;
  sentAt?: string;
  expiresAt?: string;
  approvedAt?: string;
  approvedByUserId?: number;
  approvedByUserName?: string;
  jobRequestId?: number;
  leadId?: number;
}

interface QuoteDetail extends Quote {
  auditTrail: Array<{
    id: number;
    action: string;
    userId?: number;
    userName?: string;
    notes?: string;
    createdAt: string;
  }>;
  nextStep?: string;
  scheduleOptions?: string[];
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof FileText }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: FileText },
  awaiting_approval: { label: "Awaiting Approval", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400", icon: Clock },
  sent: { label: "Sent", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400", icon: Send },
  accepted: { label: "Accepted", color: "bg-green-500/10 text-green-600 dark:text-green-400", icon: CheckCircle },
  declined: { label: "Declined", color: "bg-red-500/10 text-red-600 dark:text-red-400", icon: XCircle },
  expired: { label: "Expired", color: "bg-muted text-muted-foreground", icon: AlertCircle },
};

const serviceOptions = [
  { value: "mowing", label: "Lawn Mowing" },
  { value: "cleanup", label: "Yard Cleanup" },
  { value: "mulch", label: "Mulching" },
  { value: "landscaping", label: "Landscaping" },
  { value: "irrigation", label: "Irrigation" },
  { value: "trimming", label: "Shrub Trimming" },
  { value: "other", label: "Other" },
];

const frequencyOptions = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "one_time", label: "One-Time" },
];

const propertySizeOptions = [
  { value: "xs", label: "Under 5,000 sq ft" },
  { value: "small", label: "5,000 - 10,000 sq ft" },
  { value: "medium", label: "10,000 - 20,000 sq ft" },
  { value: "large", label: "20,000 - 40,000 sq ft" },
  { value: "xl", label: "40,000 - 1 acre" },
  { value: "xxl", label: "Over 1 acre" },
  { value: "unknown", label: "Unknown" },
];

function QuoteRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b">
      <Skeleton className="h-9 w-9 rounded-md" />
      <div className="flex-1">
        <Skeleton className="h-4 w-32 mb-2" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-6 w-20" />
      <Skeleton className="h-8 w-24" />
    </div>
  );
}

export default function QuotesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isOwnerOrAdmin = user?.role === "owner" || user?.role === "admin";

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quickQuoteOpen, setQuickQuoteOpen] = useState(false);

  const [quickQuoteForm, setQuickQuoteForm] = useState({
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    services: [] as string[],
    frequency: "one_time",
    propertySize: "unknown",
    notes: "",
  });

  const { data: quotesData, isLoading, error, refetch } = useQuery<{ quotes: Quote[] }>({
    queryKey: ["/api/quotes", { status: statusFilter }],
    queryFn: async () => {
      const url = statusFilter !== "all" 
        ? `/api/quotes?status=${statusFilter}` 
        : "/api/quotes";
      const res = await fetch(url);
      return res.json();
    },
  });

  const { data: quoteDetail } = useQuery<QuoteDetail>({
    queryKey: ["/api/quotes", selectedQuote?.id, "detail"],
    queryFn: async () => {
      const res = await fetch(`/api/quotes/${selectedQuote?.id}`);
      return res.json();
    },
    enabled: !!selectedQuote,
  });

  const generateQuoteMutation = useMutation({
    mutationFn: async (formData: typeof quickQuoteForm) => {
      const res = await apiRequest("POST", "/api/quotes/quick", formData);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Quote Created",
        description: isOwnerOrAdmin 
          ? "Quote is ready to send" 
          : "Quote submitted for approval",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ops/inbox"] });
      setQuickQuoteOpen(false);
      resetQuickQuoteForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const approveQuoteMutation = useMutation({
    mutationFn: async (quoteId: number) => {
      const res = await apiRequest("POST", `/api/quotes/${quoteId}/approve`);
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("Only owners can approve quotes");
        }
        throw new Error("Failed to approve quote");
      }
      return res.json();
    },
    onSuccess: (_, quoteId) => {
      toast({ title: "Quote approved" });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "detail"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ops/inbox"] });
      setSelectedQuote(prev => prev ? { ...prev, status: "draft" } : null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const sendQuoteMutation = useMutation({
    mutationFn: async (quoteId: number) => {
      const res = await apiRequest("POST", `/api/quotes/${quoteId}/send`);
      if (!res.ok) {
        throw new Error("Failed to send quote");
      }
      return res.json();
    },
    onSuccess: (_, quoteId) => {
      toast({ title: "Quote sent to customer" });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotes", quoteId, "detail"] });
      setSelectedQuote(prev => prev ? { ...prev, status: "sent" } : null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetQuickQuoteForm = () => {
    setQuickQuoteForm({
      customerName: "",
      customerPhone: "",
      customerAddress: "",
      services: [],
      frequency: "one_time",
      propertySize: "unknown",
      notes: "",
    });
  };

  const handleQuickQuoteSubmit = () => {
    if (!quickQuoteForm.customerName.trim()) {
      toast({ title: "Customer name required", variant: "destructive" });
      return;
    }
    if (quickQuoteForm.services.length === 0) {
      toast({ title: "Select at least one service", variant: "destructive" });
      return;
    }
    generateQuoteMutation.mutate(quickQuoteForm);
  };

  const toggleService = (service: string) => {
    setQuickQuoteForm(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service],
    }));
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  const quotes = quotesData?.quotes || [];

  const filteredQuotes = quotes.filter(quote => {
    if (statusFilter !== "all" && quote.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!quote.customerName.toLowerCase().includes(query) &&
          !quote.customerPhone?.includes(query)) {
        return false;
      }
    }
    return true;
  });

  const QuoteRow = ({ quote }: { quote: Quote }) => {
    const config = statusConfig[quote.status] || statusConfig.draft;
    const Icon = config.icon;

    return (
      <div
        className="flex items-center gap-4 p-4 border-b hover-elevate cursor-pointer"
        onClick={() => {
          setSelectedQuote(quote);
          setDrawerOpen(true);
        }}
        data-testid={`quote-row-${quote.id}`}
      >
        <div className={`p-2 rounded-md ${config.color}`}>
          <Icon className="h-5 w-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{quote.customerName}</span>
            <Badge variant="outline" className={`text-xs ${config.color}`}>
              {config.label}
            </Badge>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            {quote.services.length > 0 && (
              <span className="truncate">
                {quote.services.map(s => serviceOptions.find(o => o.value === s)?.label || s).join(", ")}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true })}
            </span>
          </div>
        </div>

        <div className="text-right">
          <div className="font-medium">
            {quote.amountLow && quote.amountHigh ? (
              <span>{formatCurrency(quote.amountLow)} - {formatCurrency(quote.amountHigh)}</span>
            ) : (
              <span>{formatCurrency(quote.amount)}</span>
            )}
          </div>
          {quote.frequency && (
            <div className="text-xs text-muted-foreground">
              {frequencyOptions.find(f => f.value === quote.frequency)?.label}
            </div>
          )}
        </div>

        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </div>
    );
  };

  const QuoteDetailDrawer = () => {
    if (!selectedQuote) return null;

    const config = statusConfig[selectedQuote.status] || statusConfig.draft;
    const Icon = config.icon;
    const detail = quoteDetail || selectedQuote;

    return (
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-md ${config.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle>{selectedQuote.customerName}</SheetTitle>
                <SheetDescription>
                  {config.label} - Created {formatDistanceToNow(new Date(selectedQuote.createdAt), { addSuffix: true })}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Quote Range
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {detail.amountLow && detail.amountHigh ? (
                    <span>{formatCurrency(detail.amountLow)} - {formatCurrency(detail.amountHigh)}</span>
                  ) : (
                    <span>{formatCurrency(detail.amount)}</span>
                  )}
                </div>
                {detail.frequency && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {frequencyOptions.find(f => f.value === detail.frequency)?.label}
                  </p>
                )}
                {detail.confidence && (
                  <Badge variant="outline" className="mt-2">
                    {detail.confidence} confidence
                  </Badge>
                )}
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h4 className="text-sm font-medium">Customer</h4>
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{detail.customerName}</span>
              </div>
              {detail.customerPhone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{detail.customerPhone}</span>
                </div>
              )}
              {detail.customerAddress && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{detail.customerAddress}</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium">Services</h4>
              <div className="flex flex-wrap gap-1">
                {detail.services.map((service, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {serviceOptions.find(o => o.value === service)?.label || service}
                  </Badge>
                ))}
              </div>
              {detail.lotSize && (
                <div className="flex items-center gap-2 text-sm">
                  <Ruler className="h-4 w-4 text-muted-foreground" />
                  <span>{detail.lotSize.toLocaleString()} sq ft</span>
                </div>
              )}
            </div>

            {detail.assumptions && detail.assumptions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Assumptions</h4>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  {detail.assumptions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}

            {detail.customerMessage && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Customer Message
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {detail.customerMessage}
                  </p>
                </CardContent>
              </Card>
            )}

            <Separator />

            <div className="space-y-3">
              <h4 className="text-sm font-medium">Actions</h4>
              <div className="flex flex-wrap gap-2">
                {selectedQuote.status === "awaiting_approval" && isOwnerOrAdmin && (
                  <Button
                    onClick={() => approveQuoteMutation.mutate(selectedQuote.id)}
                    disabled={approveQuoteMutation.isPending}
                    data-testid="button-approve-quote"
                  >
                    {approveQuoteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                )}

                {(selectedQuote.status === "draft" || (selectedQuote.status === "awaiting_approval" && isOwnerOrAdmin)) && isOwnerOrAdmin && (
                  <Button
                    variant="outline"
                    onClick={() => sendQuoteMutation.mutate(selectedQuote.id)}
                    disabled={sendQuoteMutation.isPending}
                    data-testid="button-send-quote"
                  >
                    {sendQuoteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Send className="h-4 w-4 mr-2" />
                    Send to Customer
                  </Button>
                )}

                {selectedQuote.status === "awaiting_approval" && !isOwnerOrAdmin && (
                  <p className="text-sm text-muted-foreground">
                    Waiting for owner approval before sending.
                  </p>
                )}
              </div>
            </div>

            {quoteDetail?.auditTrail && quoteDetail.auditTrail.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <History className="h-4 w-4" />
                    How We Got Here
                  </h4>
                  <ScrollArea className="h-48">
                    <div className="space-y-3">
                      {quoteDetail.auditTrail.map((entry, i) => (
                        <div key={entry.id} className="flex gap-3 text-sm">
                          <div className="flex flex-col items-center">
                            <div className="w-2 h-2 rounded-full bg-primary" />
                            {i < quoteDetail.auditTrail.length - 1 && (
                              <div className="w-px h-full bg-border" />
                            )}
                          </div>
                          <div className="flex-1 pb-3">
                            <div className="font-medium">{entry.action}</div>
                            {entry.userName && (
                              <div className="text-xs text-muted-foreground">
                                by {entry.userName}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                            </div>
                            {entry.notes && (
                              <p className="text-xs text-muted-foreground mt-1">{entry.notes}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    );
  };

  const QuickQuoteDialog = () => (
    <Dialog open={quickQuoteOpen} onOpenChange={setQuickQuoteOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Quick Quote</DialogTitle>
          <DialogDescription>
            Create a new quote estimate. {!isOwnerOrAdmin && "It will be submitted for owner approval."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="customerName">Customer Name *</Label>
            <Input
              id="customerName"
              placeholder="John Smith"
              value={quickQuoteForm.customerName}
              onChange={(e) => setQuickQuoteForm(prev => ({ ...prev, customerName: e.target.value }))}
              data-testid="input-customer-name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customerPhone">Phone</Label>
              <Input
                id="customerPhone"
                placeholder="(555) 123-4567"
                value={quickQuoteForm.customerPhone}
                onChange={(e) => setQuickQuoteForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                data-testid="input-customer-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="propertySize">Property Size</Label>
              <Select 
                value={quickQuoteForm.propertySize} 
                onValueChange={(v) => setQuickQuoteForm(prev => ({ ...prev, propertySize: v }))}
              >
                <SelectTrigger data-testid="select-property-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {propertySizeOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customerAddress">Address</Label>
            <Input
              id="customerAddress"
              placeholder="123 Main St, City, State"
              value={quickQuoteForm.customerAddress}
              onChange={(e) => setQuickQuoteForm(prev => ({ ...prev, customerAddress: e.target.value }))}
              data-testid="input-customer-address"
            />
          </div>

          <div className="space-y-2">
            <Label>Services *</Label>
            <div className="flex flex-wrap gap-2">
              {serviceOptions.map(service => (
                <Badge
                  key={service.value}
                  variant={quickQuoteForm.services.includes(service.value) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleService(service.value)}
                  data-testid={`badge-service-${service.value}`}
                >
                  {service.label}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="frequency">Frequency</Label>
            <Select 
              value={quickQuoteForm.frequency} 
              onValueChange={(v) => setQuickQuoteForm(prev => ({ ...prev, frequency: v }))}
            >
              <SelectTrigger data-testid="select-frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {frequencyOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional details..."
              value={quickQuoteForm.notes}
              onChange={(e) => setQuickQuoteForm(prev => ({ ...prev, notes: e.target.value }))}
              data-testid="textarea-notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setQuickQuoteOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleQuickQuoteSubmit}
            disabled={generateQuoteMutation.isPending}
            data-testid="button-create-quote"
          >
            {generateQuoteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isOwnerOrAdmin ? "Create Quote" : "Submit for Approval"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const statusCounts = quotes.reduce((acc, q) => {
    acc[q.status] = (acc[q.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="h-full flex flex-col">
      <div className="border-b p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Quotes
            </h1>
            <p className="text-sm text-muted-foreground">
              {quotes.length} total quotes
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              data-testid="button-refresh-quotes"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setQuickQuoteOpen(true)} data-testid="button-quick-quote">
              <Plus className="h-4 w-4 mr-2" />
              Quick Quote
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="p-4 border-b flex items-center gap-4 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-quotes"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44" data-testid="select-status-filter">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft ({statusCounts.draft || 0})</SelectItem>
              <SelectItem value="awaiting_approval">Awaiting Approval ({statusCounts.awaiting_approval || 0})</SelectItem>
              <SelectItem value="sent">Sent ({statusCounts.sent || 0})</SelectItem>
              <SelectItem value="accepted">Accepted ({statusCounts.accepted || 0})</SelectItem>
              <SelectItem value="declined">Declined ({statusCounts.declined || 0})</SelectItem>
              <SelectItem value="expired">Expired ({statusCounts.expired || 0})</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div>
              <QuoteRowSkeleton />
              <QuoteRowSkeleton />
              <QuoteRowSkeleton />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h3 className="font-medium">Failed to load quotes</h3>
              <p className="text-sm text-muted-foreground">
                Please try refreshing the page.
              </p>
            </div>
          ) : filteredQuotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium">No quotes found</h3>
              <p className="text-sm text-muted-foreground">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Create your first quote to get started"}
              </p>
              <Button className="mt-4" onClick={() => setQuickQuoteOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Quote
              </Button>
            </div>
          ) : (
            <div>
              {filteredQuotes.map((quote) => (
                <QuoteRow key={quote.id} quote={quote} />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <QuoteDetailDrawer />
      <QuickQuoteDialog />
    </div>
  );
}
