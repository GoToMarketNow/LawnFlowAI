import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { useLocation } from "wouter"
import { AuthenticatedWebAppShell } from "@/components/web/authenticated-shell"
import { WebPageHeader } from "@/components/web/page-header"
import { WebMetricCard } from "@/components/web/metric-card"
import { WebTabbedLayout } from "@/components/web/tabbed-layout"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DollarSign,
  Receipt,
  CreditCard,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
} from "lucide-react"

interface BillingOverview {
  totalRevenue: number
  outstandingBalance: number
  overdueAmount: number
  paidThisMonth: number
  invoiceCount: number
  overdueCount: number
  revenueChange: number
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(cents / 100)
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? "+" : ""
  return `${sign}${value.toFixed(1)}%`
}

export default function FigmaBillingPage() {
  const [, setLocation] = useLocation()
  const [activeTab, setActiveTab] = React.useState("overview")

  // Fetch billing overview
  const { data: billing, isLoading } = useQuery<BillingOverview>({
    queryKey: ["/api/billing/overview"],
    staleTime: 30000,
  })

  // Default values for display
  const overview = billing || {
    totalRevenue: 0,
    outstandingBalance: 0,
    overdueAmount: 0,
    paidThisMonth: 0,
    invoiceCount: 0,
    overdueCount: 0,
    revenueChange: 0,
  }

  // Tab configuration
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "invoices", label: "Invoices", count: overview.invoiceCount },
    { id: "payments", label: "Payments" },
    { id: "issues", label: "Issues", count: overview.overdueCount },
  ]

  const quickActions = [
    {
      title: "View Invoices",
      description: "Manage and send invoices",
      icon: <Receipt className="w-5 h-5" />,
      href: "/billing/invoices",
    },
    {
      title: "Record Payment",
      description: "Log a customer payment",
      icon: <CreditCard className="w-5 h-5" />,
      href: "/billing/payments",
    },
    {
      title: "Billing Issues",
      description: "Review overdue accounts",
      icon: <AlertTriangle className="w-5 h-5" />,
      href: "/billing/issues",
    },
  ]

  return (
    <AuthenticatedWebAppShell pageTitle="Billing">
      <div className="h-full flex flex-col">
        <WebPageHeader
          title="Billing"
          subtitle="Manage invoices, payments, and billing issues"
          breadcrumbs={[
            { label: "Home", href: "/home" },
            { label: "Billing" },
          ]}
        />

        <div className="flex-1 p-6">
          <WebTabbedLayout
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={(tab) => {
              if (tab === "invoices") setLocation("/billing/invoices")
              else if (tab === "payments") setLocation("/billing/payments")
              else if (tab === "issues") setLocation("/billing/issues")
              else setActiveTab(tab)
            }}
          >
            {isLoading ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                  <Skeleton className="h-32" />
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Metric Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <WebMetricCard
                    label="Total Revenue"
                    value={formatCurrency(overview.totalRevenue)}
                    change={{
                      value: formatPercent(overview.revenueChange),
                      type: overview.revenueChange >= 0 ? "increase" : "decrease",
                    }}
                    trend={overview.revenueChange >= 0 ? "up" : "down"}
                    icon={<DollarSign className="w-5 h-5" />}
                  />
                  <WebMetricCard
                    label="Outstanding"
                    value={formatCurrency(overview.outstandingBalance)}
                    icon={<Receipt className="w-5 h-5" />}
                    href="/billing/invoices"
                  />
                  <WebMetricCard
                    label="Paid This Month"
                    value={formatCurrency(overview.paidThisMonth)}
                    icon={<CreditCard className="w-5 h-5" />}
                    href="/billing/payments"
                  />
                  <WebMetricCard
                    label="Overdue"
                    value={formatCurrency(overview.overdueAmount)}
                    change={{
                      value: `${overview.overdueCount} invoices`,
                      type: overview.overdueCount > 0 ? "decrease" : "increase",
                    }}
                    icon={<AlertTriangle className="w-5 h-5" />}
                    href="/billing/issues"
                  />
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {quickActions.map((action) => (
                    <Card
                      key={action.title}
                      className="cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => setLocation(action.href)}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                              {action.icon}
                            </div>
                            <div>
                              <h3 className="font-semibold text-foreground">{action.title}</h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                {action.description}
                              </p>
                            </div>
                          </div>
                          <ArrowRight className="w-5 h-5 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Revenue Chart Placeholder */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      Revenue Trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 flex items-center justify-center bg-muted/50 rounded-lg">
                      <p className="text-muted-foreground">Revenue chart will be displayed here</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </WebTabbedLayout>
        </div>
      </div>
    </AuthenticatedWebAppShell>
  )
}
