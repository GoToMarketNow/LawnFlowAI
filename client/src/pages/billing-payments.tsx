import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  CreditCard, 
  Banknote,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Payment, PaymentStatus } from "@shared/schema";

const statusVariants: Record<string, string> = {
  PENDING: "secondary",
  SUCCEEDED: "outline",
  FAILED: "destructive",
  REFUNDED: "secondary",
  PARTIAL: "secondary",
};

const statusLabels: Record<string, string> = {
  PENDING: "Pending",
  SUCCEEDED: "Succeeded",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  PARTIAL: "Partial",
};

const methodIcons: Record<string, React.ElementType> = {
  CARD: CreditCard,
  CASH: Banknote,
  CHECK: CheckCircle,
  ACH: CreditCard,
  UNKNOWN: CreditCard,
};

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function PaymentRow({ 
  payment, 
  isSelected, 
  onSelect 
}: { 
  payment: Payment; 
  isSelected: boolean; 
  onSelect: () => void;
}) {
  const Icon = methodIcons[payment.method || 'UNKNOWN'] || CreditCard;
  const isFailed = payment.status === 'FAILED';

  return (
    <div
      className={`p-3 rounded-md cursor-pointer transition-colors ${
        isSelected 
          ? 'bg-accent' 
          : 'hover-elevate'
      }`}
      onClick={onSelect}
      data-testid={`payment-row-${payment.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <Icon className={`h-4 w-4 ${isFailed ? 'text-destructive' : 'text-muted-foreground'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium">
              {formatCurrency(payment.amount)}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={statusVariants[payment.status] as any} className="text-xs">
              {statusLabels[payment.status] || payment.status}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {payment.method || 'Unknown'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentDetail({ payment }: { payment: Payment | null }) {
  if (!payment) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Select a payment</h3>
        <p className="text-sm text-muted-foreground">
          Choose a payment from the list to view details
        </p>
      </div>
    );
  }

  const Icon = methodIcons[payment.method || 'UNKNOWN'] || CreditCard;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-medium">
              {formatCurrency(payment.amount)}
            </h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant={statusVariants[payment.status] as any}>
                {statusLabels[payment.status] || payment.status}
              </Badge>
              <Badge variant="outline">
                {payment.method || 'Unknown'}
              </Badge>
            </div>
          </div>
        </div>
        {payment.status === 'FAILED' && (
          <Button variant="outline" data-testid="button-retry-payment">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        )}
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Invoice</span>
          <p className="font-medium">INV-{payment.invoiceId}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Method</span>
          <p className="font-medium">{payment.method || 'Unknown'}</p>
        </div>
        {payment.occurredAt && (
          <div>
            <span className="text-muted-foreground">Date</span>
            <p className="font-medium">{new Date(payment.occurredAt).toLocaleDateString()}</p>
          </div>
        )}
        {payment.externalPaymentId && (
          <div>
            <span className="text-muted-foreground">External ID</span>
            <p className="font-medium text-xs truncate">{payment.externalPaymentId}</p>
          </div>
        )}
      </div>

      <Separator />

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="h-4 w-4" />
          <span>Recorded {new Date(payment.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}

export default function BillingPaymentsPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ['/api/billing/payments', { status: statusFilter !== 'all' ? statusFilter : undefined }],
  });

  const filteredPayments = payments;

  const selectedPayment = filteredPayments.find(p => p.id === selectedId) || null;

  return (
    <div className="flex h-full">
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b space-y-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger data-testid="select-payment-status-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="SUCCEEDED">Succeeded</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="REFUNDED">Refunded</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground">Loading...</div>
            ) : filteredPayments.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                No payments found
              </div>
            ) : (
              filteredPayments.map((payment) => (
                <PaymentRow
                  key={payment.id}
                  payment={payment}
                  isSelected={selectedId === payment.id}
                  onSelect={() => setSelectedId(payment.id)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1">
        <ScrollArea className="h-full">
          <PaymentDetail payment={selectedPayment} />
        </ScrollArea>
      </div>
    </div>
  );
}
