import * as React from "react"
import { WebAppShell } from "../components/web/app-shell"
import { WebTabbedLayout } from "../components/web/tabbed-layout"
import { WebButton } from "../components/web/button"
import { WebChartContainer } from "../components/web/chart-container"
import { WebBadge } from "../components/web/badge"
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import {
  Download,
  Calendar,
  TrendingUp,
  DollarSign,
  Users,
  Target,
  Activity,
  ArrowRight,
} from "lucide-react"
import { cn } from "../components/ui/utils"

export default function AnalyticsPage() {
  // Profit Tab Data
  const revenueData = [
    { month: "Jan", revenue: 45000, cost: 28000, margin: 17000 },
    { month: "Feb", revenue: 52000, cost: 31000, margin: 21000 },
    { month: "Mar", revenue: 48000, cost: 29000, margin: 19000 },
    { month: "Apr", revenue: 61000, cost: 35000, margin: 26000 },
    { month: "May", revenue: 55000, cost: 32000, margin: 23000 },
    { month: "Jun", revenue: 67000, cost: 38000, margin: 29000 },
  ]

  const profitByService = [
    { name: "Lawn Mowing", value: 85000, percentage: 38 },
    { name: "Landscaping", value: 62000, percentage: 28 },
    { name: "Fertilization", value: 45000, percentage: 20 },
    { name: "Cleanup", value: 31000, percentage: 14 },
  ]

  const marginByCrew = [
    { crew: "Crew Alpha", margin: 68, jobs: 156 },
    { crew: "Crew Beta", margin: 64, jobs: 142 },
    { crew: "Crew Charlie", margin: 72, jobs: 128 },
    { crew: "Crew Delta", margin: 58, jobs: 115 },
    { crew: "Crew Echo", margin: 66, jobs: 134 },
  ]

  // Retention Tab Data
  const customerRetention = [
    { month: "Jan", retained: 92, churned: 8 },
    { month: "Feb", retained: 94, churned: 6 },
    { month: "Mar", retained: 91, churned: 9 },
    { month: "Apr", retained: 95, churned: 5 },
    { month: "May", retained: 93, churned: 7 },
    { month: "Jun", retained: 96, churned: 4 },
  ]

  const cohortData = [
    { cohort: "Jan 2026", m0: 100, m1: 94, m2: 90, m3: 88, m4: 85, m5: 84 },
    { cohort: "Feb 2026", m0: 100, m1: 96, m2: 92, m3: 90, m4: 88, m5: null },
    { cohort: "Mar 2026", m0: 100, m1: 93, m2: 89, m3: 87, m4: null, m5: null },
    { cohort: "Apr 2026", m0: 100, m1: 97, m2: 94, m3: null, m4: null, m5: null },
    { cohort: "May 2026", m0: 100, m1: 95, m2: null, m3: null, m4: null, m5: null },
    { cohort: "Jun 2026", m0: 100, m1: null, m2: null, m3: null, m4: null, m5: null },
  ]

  const churnReasons = [
    { reason: "Price", count: 12 },
    { reason: "Service Quality", count: 8 },
    { reason: "Moved Away", count: 15 },
    { reason: "Found Competitor", count: 10 },
    { reason: "Seasonal", count: 20 },
  ]

  // Growth Tab Data
  const customerGrowth = [
    { month: "Jan", new: 24, total: 312 },
    { month: "Feb", new: 18, total: 330 },
    { month: "Mar", new: 31, total: 361 },
    { month: "Apr", new: 27, total: 388 },
    { month: "May", new: 22, total: 410 },
    { month: "Jun", new: 35, total: 445 },
  ]

  const acquisitionFunnel = [
    { stage: "Leads", count: 450, conversion: 100 },
    { stage: "Quotes Sent", count: 320, conversion: 71 },
    { stage: "Quotes Accepted", count: 180, conversion: 56 },
    { stage: "First Job", count: 145, conversion: 81 },
    { stage: "Repeat Customer", count: 98, conversion: 68 },
  ]

  const revenueBySegment = [
    { segment: "High-Value", revenue: 142000, customers: 5 },
    { segment: "Commercial", revenue: 186000, customers: 12 },
    { segment: "Residential", revenue: 98000, customers: 68 },
    { segment: "New", revenue: 24000, customers: 15 },
  ]

  // Agent Performance Tab Data
  const agentMetrics = [
    {
      agent: "AI Assistant",
      conversations: 1240,
      satisfaction: 4.8,
      resolutionRate: 87,
      avgResponseTime: "2.3s",
    },
    {
      agent: "Human Support",
      conversations: 340,
      satisfaction: 4.6,
      resolutionRate: 94,
      avgResponseTime: "4.2m",
    },
  ]

  const conversationVolume = [
    { day: "Mon", ai: 180, human: 45 },
    { day: "Tue", ai: 165, human: 52 },
    { day: "Wed", ai: 195, human: 48 },
    { day: "Thu", ai: 210, human: 55 },
    { day: "Fri", ai: 225, human: 62 },
    { day: "Sat", ai: 145, human: 38 },
    { day: "Sun", ai: 120, human: 30 },
  ]

  const intentDistribution = [
    { intent: "Scheduling", value: 420, color: "hsl(var(--lf-primary-500))" },
    { intent: "Billing", value: 280, color: "hsl(var(--lf-success-500))" },
    { intent: "Service Info", value: 340, color: "hsl(var(--lf-warning-500))" },
    { intent: "Complaints", value: 120, color: "hsl(var(--destructive))" },
    { intent: "Other", value: 180, color: "hsl(var(--muted-foreground))" },
  ]

  const COLORS = ["hsl(var(--lf-primary-500))", "hsl(var(--lf-success-500))", "hsl(var(--lf-warning-500))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))"]

  // Chart color helper
  const getCohortColor = (value: number | null) => {
    if (value === null) return "bg-muted"
    if (value >= 90) return "bg-success/80"
    if (value >= 80) return "bg-success/50"
    if (value >= 70) return "bg-warning/50"
    return "bg-destructive/50"
  }

  const tabs = [
    {
      id: "profit",
      label: "Profit",
      icon: <DollarSign className="w-4 h-4" />,
      content: (
        <div className="p-6 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Total Revenue</p>
              </div>
              <p className="text-2xl font-semibold">$328,000</p>
              <div className="flex items-center gap-1 text-sm text-success mt-1">
                <TrendingUp className="w-3 h-3" />
                <span>+14.2%</span>
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Gross Profit</p>
              </div>
              <p className="text-2xl font-semibold">$135,000</p>
              <div className="flex items-center gap-1 text-sm text-success mt-1">
                <TrendingUp className="w-3 h-3" />
                <span>+18.5%</span>
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Profit Margin</p>
              </div>
              <p className="text-2xl font-semibold">41.2%</p>
              <div className="flex items-center gap-1 text-sm text-success mt-1">
                <TrendingUp className="w-3 h-3" />
                <span>+2.8%</span>
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Jobs Completed</p>
              </div>
              <p className="text-2xl font-semibold">675</p>
              <div className="flex items-center gap-1 text-sm text-success mt-1">
                <TrendingUp className="w-3 h-3" />
                <span>+8.4%</span>
              </div>
            </div>
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <WebChartContainer
              title="Revenue & Margin Trend"
              subtitle="6-month performance"
              metric={{ value: "$67,000", change: 21.8, changeLabel: "vs last month" }}
              tooltip="Tracking monthly revenue, costs, and gross margin"
            >
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--lf-primary-500))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--lf-primary-500))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="marginGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--lf-success-500))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--lf-success-500))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--lf-primary-500))"
                    fill="url(#revenueGradient)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="margin"
                    stroke="hsl(var(--lf-success-500))"
                    fill="url(#marginGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </WebChartContainer>

            <WebChartContainer
              title="Profit by Service Type"
              subtitle="Revenue distribution"
              metric={{ value: "$223,000", change: 12.4, changeLabel: "total" }}
              actions={
                <WebButton variant="ghost" size="sm">
                  <ArrowRight className="w-4 h-4" />
                </WebButton>
              }
            >
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={profitByService}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name} (${percentage}%)`}
                    outerRadius={100}
                    fill="hsl(var(--lf-primary-500))"
                    dataKey="value"
                  >
                    {profitByService.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </WebChartContainer>
          </div>

          {/* Charts Row 2 */}
          <WebChartContainer
            title="Crew Profit Margins"
            subtitle="Performance by team"
            actions={
              <WebButton variant="secondary" size="sm" onClick={() => console.log("Navigate to /operations/crews")}>
                View Crews
                <ArrowRight className="w-4 h-4 ml-2" />
              </WebButton>
            }
          >
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={marginByCrew}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="crew" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => `${value}%`}
                />
                <Bar dataKey="margin" fill="hsl(var(--lf-primary-500))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </WebChartContainer>
        </div>
      ),
    },
    {
      id: "retention",
      label: "Retention",
      icon: <Users className="w-4 h-4" />,
      content: (
        <div className="p-6 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-2">Retention Rate</p>
              <p className="text-2xl font-semibold">94.2%</p>
              <div className="flex items-center gap-1 text-sm text-success mt-1">
                <TrendingUp className="w-3 h-3" />
                <span>+2.1%</span>
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-2">Churn Rate</p>
              <p className="text-2xl font-semibold">5.8%</p>
              <div className="flex items-center gap-1 text-sm text-success mt-1">
                <TrendingUp className="w-3 h-3" />
                <span>-1.2%</span>
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-2">Avg Customer LTV</p>
              <p className="text-2xl font-semibold">$8,450</p>
              <div className="flex items-center gap-1 text-sm text-success mt-1">
                <TrendingUp className="w-3 h-3" />
                <span>+15.3%</span>
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-2">At-Risk Customers</p>
              <p className="text-2xl font-semibold">12</p>
              <div className="flex items-center gap-1 text-sm text-warning mt-1">
                <span>Needs attention</span>
              </div>
            </div>
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <WebChartContainer
              title="Customer Retention Trend"
              subtitle="Monthly retained vs churned customers"
              metric={{ value: "96%", change: 1.8, changeLabel: "this month" }}
            >
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={customerRetention}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="retained"
                    stroke="hsl(var(--lf-success-500))"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="churned"
                    stroke="hsl(var(--destructive))"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </WebChartContainer>

            <WebChartContainer
              title="Churn Reasons"
              subtitle="Why customers leave"
              actions={
                <WebButton variant="secondary" size="sm" onClick={() => console.log("Navigate to /customers/segments")}>
                  View Segments
                  <ArrowRight className="w-4 h-4 ml-2" />
                </WebButton>
              }
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={churnReasons} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis dataKey="reason" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={120} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--lf-warning-500))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </WebChartContainer>
          </div>

          {/* Cohort Analysis */}
          <WebChartContainer
            title="Cohort Retention Analysis"
            subtitle="Customer retention by signup month"
            tooltip="Each row shows retention % for customers acquired in that month"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-2 font-medium">Cohort</th>
                    <th className="text-center p-2 font-medium">M0</th>
                    <th className="text-center p-2 font-medium">M1</th>
                    <th className="text-center p-2 font-medium">M2</th>
                    <th className="text-center p-2 font-medium">M3</th>
                    <th className="text-center p-2 font-medium">M4</th>
                    <th className="text-center p-2 font-medium">M5</th>
                  </tr>
                </thead>
                <tbody>
                  {cohortData.map((row) => (
                    <tr key={row.cohort} className="border-b border-border">
                      <td className="p-2 font-medium">{row.cohort}</td>
                      <td className="p-2">
                        <div className={cn("text-center rounded py-1", getCohortColor(row.m0))}>
                          {row.m0}%
                        </div>
                      </td>
                      <td className="p-2">
                        {row.m1 !== null && (
                          <div className={cn("text-center rounded py-1", getCohortColor(row.m1))}>
                            {row.m1}%
                          </div>
                        )}
                      </td>
                      <td className="p-2">
                        {row.m2 !== null && (
                          <div className={cn("text-center rounded py-1", getCohortColor(row.m2))}>
                            {row.m2}%
                          </div>
                        )}
                      </td>
                      <td className="p-2">
                        {row.m3 !== null && (
                          <div className={cn("text-center rounded py-1", getCohortColor(row.m3))}>
                            {row.m3}%
                          </div>
                        )}
                      </td>
                      <td className="p-2">
                        {row.m4 !== null && (
                          <div className={cn("text-center rounded py-1", getCohortColor(row.m4))}>
                            {row.m4}%
                          </div>
                        )}
                      </td>
                      <td className="p-2">
                        {row.m5 !== null && (
                          <div className={cn("text-center rounded py-1", getCohortColor(row.m5))}>
                            {row.m5}%
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-4 mt-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-success/80 rounded" />
                <span className="text-muted-foreground">≥90%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-success/50 rounded" />
                <span className="text-muted-foreground">80-89%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-warning/50 rounded" />
                <span className="text-muted-foreground">70-79%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-destructive/50 rounded" />
                <span className="text-muted-foreground">&lt;70%</span>
              </div>
            </div>
          </WebChartContainer>
        </div>
      ),
    },
    {
      id: "growth",
      label: "Growth",
      icon: <TrendingUp className="w-4 h-4" />,
      content: (
        <div className="p-6 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-2">Total Customers</p>
              <p className="text-2xl font-semibold">445</p>
              <div className="flex items-center gap-1 text-sm text-success mt-1">
                <TrendingUp className="w-3 h-3" />
                <span>+35 this month</span>
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-2">New Customers</p>
              <p className="text-2xl font-semibold">35</p>
              <div className="flex items-center gap-1 text-sm text-success mt-1">
                <TrendingUp className="w-3 h-3" />
                <span>+59% vs May</span>
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-2">Conversion Rate</p>
              <p className="text-2xl font-semibold">32.2%</p>
              <div className="flex items-center gap-1 text-sm text-success mt-1">
                <TrendingUp className="w-3 h-3" />
                <span>+4.5%</span>
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-2">CAC (Customer Acquisition Cost)</p>
              <p className="text-2xl font-semibold">$142</p>
              <div className="flex items-center gap-1 text-sm text-success mt-1">
                <TrendingUp className="w-3 h-3" />
                <span>-$18 vs last month</span>
              </div>
            </div>
          </div>

          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <WebChartContainer
              title="Customer Growth"
              subtitle="New customers & total customer base"
              metric={{ value: "445", change: 8.5, changeLabel: "customers" }}
            >
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={customerGrowth}>
                  <defs>
                    <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--lf-primary-500))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--lf-primary-500))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="new" fill="hsl(var(--lf-success-500))" radius={[4, 4, 0, 0]} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="hsl(var(--lf-primary-500))"
                    fill="url(#totalGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </WebChartContainer>

            <WebChartContainer
              title="Revenue by Customer Segment"
              subtitle="Revenue contribution by segment"
              actions={
                <WebButton variant="secondary" size="sm" onClick={() => console.log("Navigate to /customers/segments")}>
                  View Segments
                  <ArrowRight className="w-4 h-4 ml-2" />
                </WebButton>
              }
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueBySegment}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="segment" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--lf-primary-500))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </WebChartContainer>
          </div>

          {/* Acquisition Funnel */}
          <WebChartContainer
            title="Customer Acquisition Funnel"
            subtitle="Lead to customer conversion journey"
            metric={{ value: "21.8%", change: 3.2, changeLabel: "overall conversion" }}
          >
            <div className="space-y-3">
              {acquisitionFunnel.map((stage, index) => (
                <div key={stage.stage} className="relative">
                  <div className="flex items-center gap-4">
                    <div className="w-32 text-sm font-medium">{stage.stage}</div>
                    <div className="flex-1">
                      <div className="relative h-12 bg-muted rounded-lg overflow-hidden">
                        <div
                          className={cn(
                            "absolute inset-y-0 left-0 flex items-center justify-between px-4 transition-all",
                            index === 0 && "bg-primary",
                            index === 1 && "bg-primary/80",
                            index === 2 && "bg-primary/60",
                            index === 3 && "bg-primary/40",
                            index === 4 && "bg-primary/20"
                          )}
                          style={{ width: `${stage.conversion}%` }}
                        >
                          <span className="text-sm font-semibold text-white">
                            {stage.count}
                          </span>
                          <span className="text-sm font-medium text-white">
                            {stage.conversion}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {index < acquisitionFunnel.length - 1 && (
                    <div className="ml-32 mt-1 text-xs text-muted-foreground">
                      {Math.round((acquisitionFunnel[index + 1].count / stage.count) * 100)}% convert to next stage
                    </div>
                  )}
                </div>
              ))}
            </div>
          </WebChartContainer>
        </div>
      ),
    },
    {
      id: "agent",
      label: "Agent Performance",
      icon: <Activity className="w-4 h-4" />,
      content: (
        <div className="p-6 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-2">Total Conversations</p>
              <p className="text-2xl font-semibold">1,580</p>
              <div className="flex items-center gap-1 text-sm text-success mt-1">
                <TrendingUp className="w-3 h-3" />
                <span>+12.4%</span>
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-2">AI Resolution Rate</p>
              <p className="text-2xl font-semibold">87%</p>
              <div className="flex items-center gap-1 text-sm text-success mt-1">
                <TrendingUp className="w-3 h-3" />
                <span>+5.2%</span>
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-2">Avg Satisfaction</p>
              <p className="text-2xl font-semibold">4.7/5</p>
              <div className="flex items-center gap-1 text-sm text-success mt-1">
                <TrendingUp className="w-3 h-3" />
                <span>+0.2</span>
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-2">Cost Savings</p>
              <p className="text-2xl font-semibold">$8,420</p>
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                <span>This month</span>
              </div>
            </div>
          </div>

          {/* Agent Comparison */}
          <WebChartContainer
            title="Agent Performance Comparison"
            subtitle="AI vs Human support metrics"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {agentMetrics.map((agent) => (
                <div key={agent.agent} className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-semibold mb-4">{agent.agent}</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Conversations</span>
                      <span className="font-semibold">{agent.conversations.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Satisfaction</span>
                      <div className="flex items-center gap-1">
                        <span className="font-semibold">{agent.satisfaction.toFixed(1)}</span>
                        <span className="text-sm text-muted-foreground">/5</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Resolution Rate</span>
                      <span className="font-semibold">{agent.resolutionRate}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Avg Response Time</span>
                      <WebBadge variant="status" status="success" size="sm">
                        {agent.avgResponseTime}
                      </WebBadge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </WebChartContainer>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <WebChartContainer
              title="Conversation Volume"
              subtitle="Daily distribution by agent type"
              metric={{ value: "1,240", change: 18.5, changeLabel: "AI conversations" }}
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={conversationVolume}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="ai" fill="hsl(var(--lf-primary-500))" radius={[4, 4, 0, 0]} name="AI Assistant" />
                  <Bar dataKey="human" fill="hsl(var(--lf-success-500))" radius={[4, 4, 0, 0]} name="Human Support" />
                </BarChart>
              </ResponsiveContainer>
            </WebChartContainer>

            <WebChartContainer
              title="Intent Distribution"
              subtitle="Top conversation topics"
            >
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={intentDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {intentDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </WebChartContainer>
          </div>
        </div>
      ),
    },
  ]

  return (
    <WebAppShell
      pageTitle="Insights"
      userRole="OWNER"
      userName="Jane Doe"
      userEmail="jane@lawnflow.ai"
    >
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold mb-2">Business Insights</h2>
            <p className="text-muted-foreground">
              Comprehensive analytics and performance metrics
            </p>
          </div>
          <div className="flex gap-2">
            <WebButton variant="secondary" size="sm">
              <Calendar className="w-4 h-4 mr-2" />
              Last 6 Months
            </WebButton>
            <WebButton variant="secondary" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </WebButton>
          </div>
        </div>

        {/* Tabbed Analytics */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <WebTabbedLayout tabs={tabs} defaultTab="profit" />
        </div>
      </div>
    </WebAppShell>
  )
}
