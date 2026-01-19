import * as React from "react"
import { WebAppShell } from "../components/web/app-shell"
import { WebMetricCard } from "../components/web/metric-card"
import { TimelineItem } from "../components/web/timeline-item"
import { MarginAlertTile } from "../components/web/margin-alert-tile"
import { GrowthAdvisorWidget, GrowthInsight } from "../components/web/growth-advisor-widget"
import { WebBadge } from "../components/web/badge"
import { useRouter } from "../lib/router"
import {
  DollarSign,
  Briefcase,
  TrendingUp,
  FileText,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"

export default function HomePage() {
  const [showMarginAlert, setShowMarginAlert] = React.useState(true)
  const { navigate } = useRouter()

  // Growth insights data
  const growthInsights: GrowthInsight[] = [
    {
      id: "1",
      title: "Increase quote conversion by 15%",
      description: "3 quotes older than 7 days need follow-up. Quick check-ins can recover potential revenue.",
      impact: "high",
      category: "revenue",
      actionLabel: "View Quotes",
      onAction: () => navigate("/quotes?filter=stale"),
    },
    {
      id: "2",
      title: "Optimize route efficiency",
      description: "Tuesday routes can be consolidated to save 2 hours of drive time and reduce fuel costs.",
      impact: "medium",
      category: "efficiency",
      actionLabel: "Optimize Routes",
      onAction: () => navigate("/schedule?day=tuesday"),
    },
    {
      id: "3",
      title: "Upsell opportunities identified",
      description: "12 customers are due for seasonal services. Send personalized offers to increase revenue.",
      impact: "high",
      category: "customer",
      actionLabel: "View Customers",
      onAction: () => navigate("/customers?filter=upsell"),
    },
  ]

  // Pending actions data
  const pendingActions = [
    {
      id: "1",
      title: "Quote #1234 awaiting response",
      description: "Customer requested lawn maintenance services",
      status: "pending" as const,
      timestamp: "2 hours ago",
    },
    {
      id: "2",
      title: "Job #5678 ready for scheduling",
      description: "Spring cleanup - needs crew assignment",
      status: "pending" as const,
      timestamp: "5 hours ago",
    },
    {
      id: "3",
      title: "Invoice #9012 overdue",
      description: "Payment 7 days past due - follow up needed",
      status: "cancelled" as const,
      timestamp: "1 day ago",
    },
  ]

  // Activity timeline data
  const activityTimeline = [
    {
      id: "1",
      title: "Job #4567 completed",
      description: "Residential lawn mowing - 123 Oak Street",
      status: "completed" as const,
      timestamp: "30 min ago",
      icon: <CheckCircle2 className="w-5 h-5" />,
    },
    {
      id: "2",
      title: "New quote requested",
      description: "Commercial property maintenance - Downtown Plaza",
      status: "pending" as const,
      timestamp: "1 hour ago",
      icon: <FileText className="w-5 h-5" />,
    },
    {
      id: "3",
      title: "Route optimization complete",
      description: "Thursday route updated with 2 new stops",
      status: "completed" as const,
      timestamp: "2 hours ago",
      icon: <MapPin className="w-5 h-5" />,
    },
    {
      id: "4",
      title: "Job #4566 started",
      description: "Garden bed installation - 456 Maple Avenue",
      status: "active" as const,
      timestamp: "3 hours ago",
      icon: <Briefcase className="w-5 h-5" />,
    },
    {
      id: "5",
      title: "Weekly schedule published",
      description: "All crews notified for week of Jan 13-19",
      status: "completed" as const,
      timestamp: "5 hours ago",
      icon: <Calendar className="w-5 h-5" />,
    },
  ]

  return (
    <WebAppShell
      pageTitle="Command Center"
      userRole="ADMIN"
      userName="John Smith"
      userEmail="john@lawnflow.ai"
    >
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Profit Protection Alert */}
        {showMarginAlert && (
          <MarginAlertTile
            severity="high"
            title="Margin Alert: Job #4589"
            description="This job is tracking 15% below target margin. Review labor costs and pricing to protect profitability."
            metric={{
              label: "Current Margin",
              value: "18%",
            }}
            actionLabel="Review Job"
            onAction={() => console.log("Review job")}
            onDismiss={() => setShowMarginAlert(false)}
          />
        )}

        {/* Metric Cards - 4 Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <WebMetricCard
            label="Monthly Revenue"
            value="$24,580"
            change={{
              value: "+12.5%",
              type: "increase",
            }}
            trend="up"
            icon={<DollarSign className="w-5 h-5" />}
            href="/invoices"
          />
          <WebMetricCard
            label="Active Jobs"
            value="18"
            change={{
              value: "+3",
              type: "increase",
            }}
            icon={<Briefcase className="w-5 h-5" />}
            href="/jobs"
          />
          <WebMetricCard
            label="Avg Margin"
            value="32%"
            change={{
              value: "-2.1%",
              type: "decrease",
            }}
            trend="down"
            icon={<TrendingUp className="w-5 h-5" />}
            href="/analytics"
          />
          <WebMetricCard
            label="Pending Quotes"
            value="7"
            change={{
              value: "+4",
              type: "increase",
            }}
            icon={<FileText className="w-5 h-5" />}
            href="/quotes"
          />
        </div>

        {/* 3-Column Grid - Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Pending Actions */}
          <div className="lg:col-span-1">
            <div className="bg-card border border-border rounded-lg">
              <div className="px-6 py-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">Pending Actions</h3>
                  <WebBadge variant="priority" priority="high" size="sm">
                    {pendingActions.length}
                  </WebBadge>
                </div>
              </div>
              <div className="divide-y divide-border">
                {pendingActions.map((action, index) => (
                  <div
                    key={action.id}
                    className="px-6 py-4 hover:bg-accent/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        <AlertCircle className="w-5 h-5 text-warning" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-foreground text-sm mb-1">
                          {action.title}
                        </h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          {action.description}
                        </p>
                        <div className="flex items-center gap-2">
                          <WebBadge variant="status" status={action.status} size="sm">
                            {action.status}
                          </WebBadge>
                          <span className="text-xs text-muted-foreground">
                            {action.timestamp}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Middle Column - Activity Timeline */}
          <div className="lg:col-span-1">
            <div className="bg-card border border-border rounded-lg">
              <div className="px-6 py-4 border-b border-border">
                <h3 className="font-semibold text-foreground">Recent Activity</h3>
              </div>
              <div className="px-6 py-4">
                {activityTimeline.map((item, index) => (
                  <TimelineItem
                    key={item.id}
                    title={item.title}
                    description={item.description}
                    timestamp={item.timestamp}
                    status={item.status}
                    icon={item.icon}
                    showConnector={index < activityTimeline.length - 1}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Growth Advisor */}
          <div className="lg:col-span-1">
            <GrowthAdvisorWidget insights={growthInsights} />
          </div>
        </div>
      </div>
    </WebAppShell>
  )
}