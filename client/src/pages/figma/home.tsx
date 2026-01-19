import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { useLocation } from "wouter"
import { AuthenticatedWebAppShell } from "@/components/web/authenticated-shell"
import { WebMetricCard } from "@/components/web/metric-card"
import { TimelineItem } from "@/components/web/timeline-item"
import { MarginAlertTile } from "@/components/web/margin-alert-tile"
import { GrowthAdvisorWidget, GrowthInsight } from "@/components/web/growth-advisor-widget"
import { WebBadge } from "@/components/web/badge"
import { Skeleton } from "@/components/ui/skeleton"
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

// Types for API responses
interface KPIData {
  monthlyRevenue: number
  activeJobs: number
  avgMargin: number
  pendingQuotes: number
  revenueChange: number
  jobsChange: number
  marginChange: number
  quotesChange: number
}

interface PendingAction {
  id: number
  type: string
  title: string
  description: string
  status: string
  createdAt: string
}

interface ActivityEvent {
  id: number
  type: string
  title: string
  description: string
  status: string
  createdAt: string
}

interface GrowthRecommendation {
  id: number
  title: string
  description: string
  impact: "high" | "medium" | "low"
  category: string
  actionUrl?: string
  actionLabel?: string
}

interface MarginAlert {
  id: number
  jobId: number
  severity: "high" | "medium" | "low"
  title: string
  description: string
  currentMargin: number
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHours < 24) return `${diffHours} hours ago`
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

export default function FigmaHomePage() {
  const [showMarginAlert, setShowMarginAlert] = React.useState(true)
  const [, setLocation] = useLocation()

  // Fetch KPIs from API
  const { data: kpis, isLoading: kpisLoading } = useQuery<KPIData>({
    queryKey: ["/api/ops/kpis"],
    staleTime: 30000,
  })

  // Fetch pending actions
  const { data: pendingActions, isLoading: actionsLoading } = useQuery<PendingAction[]>({
    queryKey: ["/api/pending-actions"],
    staleTime: 30000,
  })

  // Fetch recent activity/events
  const { data: events, isLoading: eventsLoading } = useQuery<ActivityEvent[]>({
    queryKey: ["/api/events"],
    staleTime: 30000,
  })

  // Fetch growth recommendations
  const { data: recommendations } = useQuery<GrowthRecommendation[]>({
    queryKey: ["/api/growth-advisor/recommendation"],
    staleTime: 60000,
  })

  // Fetch margin alerts
  const { data: marginAlerts } = useQuery<MarginAlert[]>({
    queryKey: ["/api/margin-alerts"],
    staleTime: 30000,
  })

  // Transform recommendations to GrowthInsight format
  const growthInsights: GrowthInsight[] = (recommendations || []).slice(0, 3).map((rec) => ({
    id: String(rec.id),
    title: rec.title,
    description: rec.description,
    impact: rec.impact,
    category: rec.category as "revenue" | "efficiency" | "customer",
    actionLabel: rec.actionLabel || "View Details",
    onAction: () => rec.actionUrl && setLocation(rec.actionUrl),
  }))

  // Fallback growth insights if no recommendations available
  const defaultInsights: GrowthInsight[] = [
    {
      id: "1",
      title: "Increase quote conversion by 15%",
      description: "Review pending quotes that need follow-up to recover potential revenue.",
      impact: "high",
      category: "revenue",
      actionLabel: "View Quotes",
      onAction: () => setLocation("/quotes"),
    },
    {
      id: "2",
      title: "Optimize route efficiency",
      description: "Routes can be consolidated to save drive time and reduce fuel costs.",
      impact: "medium",
      category: "efficiency",
      actionLabel: "View Schedule",
      onAction: () => setLocation("/schedule"),
    },
    {
      id: "3",
      title: "Upsell opportunities identified",
      description: "Customers are due for seasonal services. Send personalized offers.",
      impact: "high",
      category: "customer",
      actionLabel: "View Customers",
      onAction: () => setLocation("/customers"),
    },
  ]

  const displayInsights = growthInsights.length > 0 ? growthInsights : defaultInsights

  // Transform pending actions for display
  const displayActions = (pendingActions || []).slice(0, 5).map((action) => ({
    id: String(action.id),
    title: action.title,
    description: action.description,
    status: action.status as "pending" | "completed" | "cancelled",
    timestamp: formatTimeAgo(action.createdAt),
  }))

  // Transform events for timeline
  const activityTimeline = (events || []).slice(0, 5).map((event) => ({
    id: String(event.id),
    title: event.title,
    description: event.description,
    status: event.status as "completed" | "pending" | "active",
    timestamp: formatTimeAgo(event.createdAt),
    icon: getEventIcon(event.type),
  }))

  function getEventIcon(type: string) {
    switch (type) {
      case "job_completed":
        return <CheckCircle2 className="w-5 h-5" />
      case "quote_requested":
        return <FileText className="w-5 h-5" />
      case "route_optimized":
        return <MapPin className="w-5 h-5" />
      case "job_started":
        return <Briefcase className="w-5 h-5" />
      case "schedule_published":
        return <Calendar className="w-5 h-5" />
      default:
        return <AlertCircle className="w-5 h-5" />
    }
  }

  const topAlert = marginAlerts?.[0]

  return (
    <AuthenticatedWebAppShell pageTitle="Command Center">
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Profit Protection Alert */}
        {showMarginAlert && topAlert && (
          <MarginAlertTile
            severity={topAlert.severity}
            title={topAlert.title}
            description={topAlert.description}
            metric={{
              label: "Current Margin",
              value: `${topAlert.currentMargin}%`,
            }}
            actionLabel="Review Job"
            onAction={() => setLocation(`/jobs/${topAlert.jobId}`)}
            onDismiss={() => setShowMarginAlert(false)}
          />
        )}

        {/* Metric Cards - 4 Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {kpisLoading ? (
            <>
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </>
          ) : (
            <>
              <WebMetricCard
                label="Monthly Revenue"
                value={formatCurrency(kpis?.monthlyRevenue || 0)}
                change={{
                  value: formatPercent(kpis?.revenueChange || 0),
                  type: (kpis?.revenueChange || 0) >= 0 ? "increase" : "decrease",
                }}
                trend={(kpis?.revenueChange || 0) >= 0 ? "up" : "down"}
                icon={<DollarSign className="w-5 h-5" />}
                href="/billing/invoices"
              />
              <WebMetricCard
                label="Active Jobs"
                value={String(kpis?.activeJobs || 0)}
                change={{
                  value: `${(kpis?.jobsChange || 0) >= 0 ? '+' : ''}${kpis?.jobsChange || 0}`,
                  type: (kpis?.jobsChange || 0) >= 0 ? "increase" : "decrease",
                }}
                icon={<Briefcase className="w-5 h-5" />}
                href="/jobs"
              />
              <WebMetricCard
                label="Avg Margin"
                value={`${kpis?.avgMargin || 0}%`}
                change={{
                  value: formatPercent(kpis?.marginChange || 0),
                  type: (kpis?.marginChange || 0) >= 0 ? "increase" : "decrease",
                }}
                trend={(kpis?.marginChange || 0) >= 0 ? "up" : "down"}
                icon={<TrendingUp className="w-5 h-5" />}
                href="/analytics"
              />
              <WebMetricCard
                label="Pending Quotes"
                value={String(kpis?.pendingQuotes || 0)}
                change={{
                  value: `${(kpis?.quotesChange || 0) >= 0 ? '+' : ''}${kpis?.quotesChange || 0}`,
                  type: (kpis?.quotesChange || 0) >= 0 ? "increase" : "decrease",
                }}
                icon={<FileText className="w-5 h-5" />}
                href="/quotes"
              />
            </>
          )}
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
                    {displayActions.length}
                  </WebBadge>
                </div>
              </div>
              <div className="divide-y divide-border">
                {actionsLoading ? (
                  <div className="p-6 space-y-4">
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                  </div>
                ) : displayActions.length === 0 ? (
                  <div className="px-6 py-8 text-center text-muted-foreground">
                    No pending actions
                  </div>
                ) : (
                  displayActions.map((action) => (
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
                  ))
                )}
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
                {eventsLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-12" />
                    <Skeleton className="h-12" />
                    <Skeleton className="h-12" />
                  </div>
                ) : activityTimeline.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No recent activity
                  </div>
                ) : (
                  activityTimeline.map((item, index) => (
                    <TimelineItem
                      key={item.id}
                      title={item.title}
                      description={item.description}
                      timestamp={item.timestamp}
                      status={item.status}
                      icon={item.icon}
                      showConnector={index < activityTimeline.length - 1}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Growth Advisor */}
          <div className="lg:col-span-1">
            <GrowthAdvisorWidget insights={displayInsights} />
          </div>
        </div>
      </div>
    </AuthenticatedWebAppShell>
  )
}
