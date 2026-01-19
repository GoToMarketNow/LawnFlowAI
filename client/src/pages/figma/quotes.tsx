import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { useLocation } from "wouter"
import { AuthenticatedWebAppShell } from "@/components/web/authenticated-shell"
import { WebPageHeader } from "@/components/web/page-header"
import { WebDataTable, DataTableColumn, DataTableAction } from "@/components/web/data-table"
import { WebTabbedLayout } from "@/components/web/tabbed-layout"
import { WebBadge } from "@/components/web/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  Eye,
  Send,
  CheckCircle,
  X,
  Plus,
  FileText,
} from "lucide-react"

interface Quote {
  id: number
  jobId: number
  customerName: string
  customerPhone: string
  customerAddress?: string
  serviceType: string
  amount: number
  status: string
  createdAt: string
  expiresAt?: string
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(cents / 100)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function getStatusBadgeVariant(status: string): "pending" | "active" | "completed" | "cancelled" {
  switch (status) {
    case "accepted":
    case "approved":
      return "completed"
    case "sent":
    case "viewed":
      return "active"
    case "rejected":
    case "expired":
      return "cancelled"
    default:
      return "pending"
  }
}

export default function FigmaQuotesPage() {
  const [, setLocation] = useLocation()
  const [activeTab, setActiveTab] = React.useState("all")

  // Fetch quotes from API
  const { data: quotes, isLoading } = useQuery<Quote[]>({
    queryKey: ["/api/quotes"],
    staleTime: 30000,
  })

  // Filter quotes by status
  const getFilteredQuotes = (status: string): Quote[] => {
    if (!quotes) return []
    if (status === "all") return quotes
    return quotes.filter((quote) => quote.status === status)
  }

  // Get counts for tabs
  const getCounts = () => {
    if (!quotes) return { all: 0, draft: 0, sent: 0, accepted: 0 }
    return {
      all: quotes.length,
      draft: quotes.filter((q) => q.status === "draft").length,
      sent: quotes.filter((q) => q.status === "sent" || q.status === "viewed").length,
      accepted: quotes.filter((q) => q.status === "accepted" || q.status === "approved").length,
    }
  }

  const counts = getCounts()

  // Tab configuration
  const tabs = [
    { id: "all", label: "All Quotes", count: counts.all },
    { id: "draft", label: "Drafts", count: counts.draft },
    { id: "sent", label: "Sent", count: counts.sent },
    { id: "accepted", label: "Accepted", count: counts.accepted },
  ]

  // Table columns
  const columns: DataTableColumn<Quote>[] = [
    {
      id: "id",
      header: "Quote #",
      accessor: (quote) => `Q-${quote.id}`,
      width: "100px",
      render: (value) => <span className="font-mono text-sm font-medium">{value}</span>,
    },
    {
      id: "customer",
      header: "Customer",
      accessor: "customerName",
      sortable: true,
      render: (_, quote) => (
        <div>
          <div className="font-medium text-foreground">{quote.customerName}</div>
          {quote.customerAddress && (
            <div className="text-xs text-muted-foreground mt-0.5">{quote.customerAddress}</div>
          )}
        </div>
      ),
    },
    {
      id: "service",
      header: "Service",
      accessor: "serviceType",
      sortable: true,
    },
    {
      id: "amount",
      header: "Amount",
      accessor: (quote) => formatCurrency(quote.amount),
      align: "right",
      sortable: true,
    },
    {
      id: "createdAt",
      header: "Created",
      accessor: (quote) => formatDate(quote.createdAt),
      sortable: true,
    },
    {
      id: "status",
      header: "Status",
      accessor: "status",
      sortable: true,
      render: (value) => (
        <WebBadge variant="status" status={getStatusBadgeVariant(value as string)} size="sm">
          {value as string}
        </WebBadge>
      ),
    },
  ]

  // Row actions
  const actions: DataTableAction<Quote>[] = [
    {
      id: "view",
      label: "View Quote",
      icon: <Eye className="w-4 h-4" />,
      onClick: (quote) => console.log("View quote", quote.id),
    },
    {
      id: "send",
      label: "Send Quote",
      icon: <Send className="w-4 h-4" />,
      onClick: (quote) => console.log("Send quote", quote.id),
      disabled: (quote) => quote.status !== "draft",
    },
    {
      id: "approve",
      label: "Mark Accepted",
      icon: <CheckCircle className="w-4 h-4" />,
      onClick: (quote) => console.log("Approve quote", quote.id),
      disabled: (quote) => quote.status === "accepted" || quote.status === "approved",
    },
  ]

  return (
    <AuthenticatedWebAppShell pageTitle="Quotes">
      <div className="h-full flex flex-col">
        <WebPageHeader
          title="Quotes"
          subtitle="Create and manage customer quotes"
          breadcrumbs={[
            { label: "Home", href: "/home" },
            { label: "Quotes" },
          ]}
          actions={
            <Button onClick={() => setLocation("/quote-builder")}>
              <Plus className="w-4 h-4 mr-2" />
              New Quote
            </Button>
          }
        />

        <div className="flex-1 p-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <WebTabbedLayout
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            >
              <WebDataTable
                columns={columns}
                data={getFilteredQuotes(activeTab)}
                actions={actions}
                searchable
                searchPlaceholder="Search quotes..."
                emptyState={{
                  icon: <FileText className="w-12 h-12 text-muted-foreground" />,
                  title: "No quotes found",
                  description: activeTab === "all"
                    ? "Create your first quote to get started"
                    : `No ${activeTab} quotes`,
                }}
              />
            </WebTabbedLayout>
          )}
        </div>
      </div>
    </AuthenticatedWebAppShell>
  )
}
