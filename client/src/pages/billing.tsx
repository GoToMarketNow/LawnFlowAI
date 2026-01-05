import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { 
  Receipt, 
  FileText, 
  CreditCard, 
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  ArrowRight,
  Plug,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { BillingOverview } from "@shared/schema";

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export default function BillingPage() {
  const { data: overview, isLoading, refetch } = useQuery<BillingOverview>({
    queryKey: ['/api/billing/overview'],
  });

  const syncStatusIcon = () => {
    if (!overview?.lastSyncStatus) {
      return <Plug className="h-4 w-4 text-muted-foreground" />;
    }
    switch (overview.lastSyncStatus) {
      case 'CONNECTED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'ERROR':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      default:
        return <Plug className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const syncStatusText = () => {
    if (!overview?.lastSyncStatus) return 'Not connected';
    if (overview.lastSyncStatus === 'CONNECTED') {
      const lastSync = overview.lastSyncAt ? new Date(overview.lastSyncAt).toLocaleTimeString() : 'Unknown';
      return `Synced at ${lastSync}`;
    }
    if (overview.lastSyncStatus === 'ERROR') return 'Sync error';
    return 'Disconnected';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Billing</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Exception-driven billing with QuickBooks integration
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-md">
            {syncStatusIcon()}
            <span className="text-sm text-muted-foreground">{syncStatusText()}</span>
          </div>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => refetch()}
            disabled={isLoading}
            data-testid="button-refresh-billing"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Link href="/settings/integrations">
            <Button variant="outline" data-testid="button-connect-qb">
              <Plug className="h-4 w-4 mr-2" />
              Connect QuickBooks
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-draft-invoices">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Draft Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.draftInvoices ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card data-testid="card-overdue-invoices">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{overview?.overdueInvoices ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Past due date</p>
          </CardContent>
        </Card>

        <Card data-testid="card-open-issues">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Open Issues</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{overview?.openIssues ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Requires attention</p>
          </CardContent>
        </Card>

        <Card data-testid="card-outstanding">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(overview?.totalOutstanding ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Total unpaid</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Recent Invoices</CardTitle>
            <Link href="/billing/invoices">
              <Button variant="ghost" size="sm" data-testid="button-view-all-invoices">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Receipt className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No invoices yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Invoices will appear here once jobs are completed
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Billing Issues</CardTitle>
            <Link href="/billing/issues">
              <Button variant="ghost" size="sm" data-testid="button-view-all-issues">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle className="h-10 w-10 text-green-500 mb-3" />
              <p className="text-sm text-muted-foreground">No issues</p>
              <p className="text-xs text-muted-foreground mt-1">
                All billing is running smoothly
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
