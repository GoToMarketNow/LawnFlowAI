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
  FileText, 
  User,
  Calendar,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Send,
  DollarSign,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Invoice, InvoiceStatus } from "@shared/schema";

const statusVariants: Record<string, string> = {
  DRAFT: "secondary",
  PENDING_APPROVAL: "secondary",
  SENT: "default",
  PAID: "outline",
  PARTIAL: "secondary",
  OVERDUE: "destructive",
  VOID: "outline",
  DISPUTED: "destructive",
  FAILED_SYNC: "destructive",
};

const statusLabels: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending Approval",
  SENT: "Sent",
  PAID: "Paid",
  PARTIAL: "Partial",
  OVERDUE: "Overdue",
  VOID: "Void",
  DISPUTED: "Disputed",
  FAILED_SYNC: "Sync Failed",
};

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function InvoiceRow({ 
  invoice, 
  isSelected, 
  onSelect 
}: { 
  invoice: Invoice; 
  isSelected: boolean; 
  onSelect: () => void;
}) {
  const isOverdue = invoice.status === 'OVERDUE';

  return (
    <div
      className={`p-3 rounded-md cursor-pointer transition-colors ${
        isSelected 
          ? 'bg-accent' 
          : 'hover-elevate'
      }`}
      onClick={onSelect}
      data-testid={`invoice-row-${invoice.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <FileText className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium truncate">
              {invoice.invoiceNumber || `INV-${invoice.id}`}
            </span>
            {isOverdue && (
              <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={statusVariants[invoice.status] as any} className="text-xs">
              {statusLabels[invoice.status] || invoice.status}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatCurrency(invoice.total)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function InvoiceDetail({ invoice }: { invoice: Invoice | null }) {
  if (!invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Select an invoice</h3>
        <p className="text-sm text-muted-foreground">
          Choose an invoice from the list to view details
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-medium">
              {invoice.invoiceNumber || `INV-${invoice.id}`}
            </h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant={statusVariants[invoice.status] as any}>
                {statusLabels[invoice.status] || invoice.status}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {invoice.status === 'DRAFT' && (
            <Button data-testid="button-approve-invoice">
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </Button>
          )}
          {invoice.status === 'PENDING_APPROVAL' && (
            <Button data-testid="button-send-invoice">
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          )}
          {['SENT', 'OVERDUE', 'PARTIAL'].includes(invoice.status) && (
            <Button variant="outline" data-testid="button-record-payment">
              <DollarSign className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
          )}
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Subtotal</span>
          <p className="font-medium">{formatCurrency(invoice.subtotal)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Tax</span>
          <p className="font-medium">{formatCurrency(invoice.tax)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">Total</span>
          <p className="font-bold text-lg">{formatCurrency(invoice.total)}</p>
        </div>
        {invoice.dueDate && (
          <div>
            <span className="text-muted-foreground">Due Date</span>
            <p className="font-medium">{new Date(invoice.dueDate).toLocaleDateString()}</p>
          </div>
        )}
      </div>

      {invoice.notes && (
        <>
          <Separator />
          <div>
            <h4 className="text-sm font-medium mb-1">Notes</h4>
            <p className="text-sm text-muted-foreground">{invoice.notes}</p>
          </div>
        </>
      )}

      <Separator />

      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
        <div className="flex items-center gap-1">
          <Clock className="h-4 w-4" />
          <span>Created {new Date(invoice.createdAt).toLocaleDateString()}</span>
        </div>
        {invoice.lastSyncedAt && (
          <div className="flex items-center gap-1">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>Synced {new Date(invoice.lastSyncedAt).toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BillingInvoicesPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ['/api/billing/invoices', { status: statusFilter !== 'all' ? statusFilter : undefined }],
  });

  const filteredInvoices = invoices.filter(inv => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const number = (inv.invoiceNumber || `INV-${inv.id}`).toLowerCase();
      if (!number.includes(query)) return false;
    }
    return true;
  });

  const selectedInvoice = filteredInvoices.find(i => i.id === selectedId) || null;

  return (
    <div className="flex h-full">
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search invoices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-invoices"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger data-testid="select-status-filter">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
              <SelectItem value="SENT">Sent</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="OVERDUE">Overdue</SelectItem>
              <SelectItem value="DISPUTED">Disputed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground">Loading...</div>
            ) : filteredInvoices.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                No invoices found
              </div>
            ) : (
              filteredInvoices.map((invoice) => (
                <InvoiceRow
                  key={invoice.id}
                  invoice={invoice}
                  isSelected={selectedId === invoice.id}
                  onSelect={() => setSelectedId(invoice.id)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1">
        <ScrollArea className="h-full">
          <InvoiceDetail invoice={selectedInvoice} />
        </ScrollArea>
      </div>
    </div>
  );
}
