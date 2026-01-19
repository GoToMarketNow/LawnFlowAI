import * as React from "react"
import { WebAppShell } from "../components/web/app-shell"
import { WebPageHeader } from "../components/web/page-header"
import { WebTabbedLayout } from "../components/web/tabbed-layout"
import { DollarSign, TrendingUp, AlertTriangle } from "lucide-react"

export default function BillingPage() {
  const stats = [
    {
      label: "Total Revenue (MTD)",
      value: "$24,580",
      change: "+12%",
      trend: "up",
    },
    {
      label: "Outstanding Invoices",
      value: "$8,420",
      count: "12 invoices",
      trend: "neutral",
    },
    {
      label: "Overdue Payments",
      value: "$2,150",
      count: "3 invoices",
      trend: "down",
    },
    {
      label: "Payment Success Rate",
      value: "94%",
      change: "+2%",
      trend: "up",
    },
  ]

  const overviewContent = (
    <div className="p-6 space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-6">
            <p className="text-sm text-muted-foreground mb-2">{stat.label}</p>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-semibold mb-1">{stat.value}</p>
                {stat.count && (
                  <p className="text-xs text-muted-foreground">{stat.count}</p>
                )}
              </div>
              {stat.change && (
                <span className={`text-sm ${stat.trend === "up" ? "text-success" : "text-error"}`}>
                  {stat.change}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="bg-card border border-border rounded-lg">
        <div className="p-6 border-b border-border">
          <h3 className="font-semibold">Recent Billing Activity</h3>
        </div>
        <div className="divide-y divide-border">
          {[
            { action: "Payment received", amount: "$450", customer: "Smith Residence", time: "2 hours ago" },
            { action: "Invoice sent", amount: "$1,200", customer: "Green Acres HOA", time: "4 hours ago" },
            { action: "Payment failed", amount: "$320", customer: "Downtown Office", time: "1 day ago" },
          ].map((activity, i) => (
            <div key={i} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{activity.action}</p>
                  <p className="text-sm text-muted-foreground">{activity.customer}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold">{activity.amount}</p>
                <p className="text-xs text-muted-foreground">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const tabs = [
    {
      id: "overview",
      label: "Overview",
      content: overviewContent,
    },
    {
      id: "trends",
      label: "Trends",
      content: (
        <div className="p-6">
          <div className="bg-card border border-border rounded-lg p-12 text-center">
            <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Revenue Trends</h3>
            <p className="text-muted-foreground">Monthly and yearly revenue analytics</p>
          </div>
        </div>
      ),
    },
    {
      id: "issues",
      label: "Issues",
      badge: 3,
      content: (
        <div className="p-6">
          <div className="bg-card border border-border rounded-lg p-12 text-center">
            <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Billing Issues</h3>
            <p className="text-muted-foreground">3 issues requiring attention</p>
          </div>
        </div>
      ),
    },
  ]

  return (
    <WebAppShell pageTitle="Billing Overview" userRole="USER">
      <div className="h-full flex flex-col">
        <WebPageHeader
          title="Billing Overview"
          subtitle="Monitor revenue and billing activity"
          breadcrumbs={[
            { label: "Home", href: "/home" },
            { label: "Billing Overview" },
          ]}
        />

        <div className="flex-1 overflow-auto">
          <WebTabbedLayout tabs={tabs} defaultTab="overview" />
        </div>
      </div>
    </WebAppShell>
  )
}
