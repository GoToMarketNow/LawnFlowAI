import * as React from "react"
import { WebAppShell } from "../components/web/app-shell"
import { WebAgentCard, AgentLifecycleStage } from "../components/web/agent-card"
import { WebAgentConfigPanel, AgentConfig } from "../components/web/agent-config-panel"
import { WebAgentEventFeed, AgentEvent } from "../components/web/agent-event-feed"
import { WebContextualDrawer } from "../components/web/contextual-drawer"
import { WebButton } from "../components/web/button"
import { WebInput } from "../components/web/input"
import { WebSelect } from "../components/web/select"
import { WebBadge } from "../components/web/badge"
import { WebChartContainer } from "../components/web/chart-container"
import {
  Plus,
  Search,
  Filter,
  Play,
  Edit,
  Activity,
  Clock,
  TrendingUp,
  CheckCircle,
  XCircle,
  Zap,
} from "lucide-react"
import { cn } from "../components/ui/utils"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

interface Agent {
  id: string
  name: string
  description: string
  stage: AgentLifecycleStage
  status: "active" | "inactive" | "error" | "running"
  successRate: number
  lastRun?: {
    timestamp: string
    outcome: "success" | "failure" | "partial"
  }
  config: AgentConfig
  performance: {
    totalRuns: number
    successfulRuns: number
    failedRuns: number
    avgDuration: number
    lastWeekRuns: Array<{ day: string; runs: number; success: number; failure: number }>
  }
  recentRuns: AgentEvent[]
}

export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = React.useState<Agent | null>(null)
  const [testingAgent, setTestingAgent] = React.useState<Agent | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [stageFilter, setStageFilter] = React.useState<AgentLifecycleStage | "all">("all")
  const [eventFilter, setEventFilter] = React.useState({
    agentId: "all",
    outcome: [] as string[],
  })
  const [eventPage, setEventPage] = React.useState(1)

  // Sample agents data
  const agents: Agent[] = [
    {
      id: "agent-001",
      name: "Quote Generator",
      description: "Automatically generates quotes for incoming service requests based on property details and service type",
      stage: "production",
      status: "active",
      successRate: 94,
      lastRun: {
        timestamp: "2 hours ago",
        outcome: "success",
      },
      config: {
        id: "agent-001",
        name: "Quote Generator",
        description: "Automatically generates quotes for incoming service requests",
        trigger: {
          type: "event",
          value: "service_request.created",
        },
        actions: [
          {
            type: "calculate_quote",
            config: {
              baseRate: "$0.02/sqft",
              serviceMultipliers: { mowing: 1.0, landscaping: 1.5, fertilization: 1.2 },
            },
          },
          {
            type: "send_notification",
            config: {
              channel: "email",
              template: "quote_generated",
            },
          },
        ],
        conditions: [
          { field: "property.size", operator: ">", value: 0 },
          { field: "customer.status", operator: "==", value: "active" },
        ],
        settings: {
          timeout: 30,
          retries: 3,
          priority: "high",
        },
      },
      performance: {
        totalRuns: 1248,
        successfulRuns: 1173,
        failedRuns: 75,
        avgDuration: 1240,
        lastWeekRuns: [
          { day: "Mon", runs: 42, success: 40, failure: 2 },
          { day: "Tue", runs: 38, success: 36, failure: 2 },
          { day: "Wed", runs: 45, success: 43, failure: 2 },
          { day: "Thu", runs: 51, success: 48, failure: 3 },
          { day: "Fri", runs: 48, success: 46, failure: 2 },
          { day: "Sat", runs: 32, success: 30, failure: 2 },
          { day: "Sun", runs: 28, success: 27, failure: 1 },
        ],
      },
      recentRuns: [
        {
          id: "run-1",
          agentId: "agent-001",
          agentName: "Quote Generator",
          timestamp: "2 hours ago",
          outcome: "success",
          duration: 1180,
          message: "Generated quote for ABC Properties lawn service",
          triggeredBy: "System",
          details: {
            input: { propertySize: 5000, serviceType: "mowing" },
            output: { quoteAmount: 100, quoteId: "Q-2024-1234" },
          },
        },
        {
          id: "run-2",
          agentId: "agent-001",
          agentName: "Quote Generator",
          timestamp: "3 hours ago",
          outcome: "success",
          duration: 1320,
          message: "Generated quote for Martinez Residence landscaping",
          triggeredBy: "System",
        },
      ],
    },
    {
      id: "agent-002",
      name: "Schedule Optimizer",
      description: "Optimizes crew schedules based on location, job priority, and crew availability",
      stage: "production",
      status: "active",
      successRate: 88,
      lastRun: {
        timestamp: "30 minutes ago",
        outcome: "success",
      },
      config: {
        id: "agent-002",
        name: "Schedule Optimizer",
        description: "Optimizes crew schedules",
        trigger: {
          type: "schedule",
          value: "0 6 * * *",
        },
        actions: [
          {
            type: "fetch_jobs",
            config: { status: "pending", dueDate: "today" },
          },
          {
            type: "optimize_routes",
            config: { algorithm: "genetic", iterations: 1000 },
          },
          {
            type: "assign_crews",
            config: { balanceWorkload: true },
          },
        ],
        settings: {
          timeout: 120,
          retries: 2,
          priority: "high",
        },
      },
      performance: {
        totalRuns: 180,
        successfulRuns: 159,
        failedRuns: 21,
        avgDuration: 8420,
        lastWeekRuns: [
          { day: "Mon", runs: 1, success: 1, failure: 0 },
          { day: "Tue", runs: 1, success: 1, failure: 0 },
          { day: "Wed", runs: 1, success: 1, failure: 0 },
          { day: "Thu", runs: 1, success: 0, failure: 1 },
          { day: "Fri", runs: 1, success: 1, failure: 0 },
          { day: "Sat", runs: 1, success: 1, failure: 0 },
          { day: "Sun", runs: 1, success: 1, failure: 0 },
        ],
      },
      recentRuns: [
        {
          id: "run-3",
          agentId: "agent-002",
          agentName: "Schedule Optimizer",
          timestamp: "30 minutes ago",
          outcome: "success",
          duration: 7850,
          message: "Optimized schedule for 24 jobs across 6 crews",
          triggeredBy: "Scheduled",
        },
      ],
    },
    {
      id: "agent-003",
      name: "Invoice Reminder",
      description: "Sends automated reminders to customers with overdue invoices",
      stage: "production",
      status: "active",
      successRate: 98,
      lastRun: {
        timestamp: "1 day ago",
        outcome: "success",
      },
      config: {
        id: "agent-003",
        name: "Invoice Reminder",
        description: "Sends automated payment reminders",
        trigger: {
          type: "schedule",
          value: "0 9 * * *",
        },
        actions: [
          {
            type: "find_overdue_invoices",
            config: { daysOverdue: 7 },
          },
          {
            type: "send_reminder",
            config: { channel: "email,sms", template: "payment_reminder" },
          },
        ],
        settings: {
          timeout: 60,
          retries: 2,
          priority: "medium",
        },
      },
      performance: {
        totalRuns: 180,
        successfulRuns: 177,
        failedRuns: 3,
        avgDuration: 2340,
        lastWeekRuns: [
          { day: "Mon", runs: 1, success: 1, failure: 0 },
          { day: "Tue", runs: 1, success: 1, failure: 0 },
          { day: "Wed", runs: 1, success: 1, failure: 0 },
          { day: "Thu", runs: 1, success: 1, failure: 0 },
          { day: "Fri", runs: 1, success: 1, failure: 0 },
          { day: "Sat", runs: 1, success: 1, failure: 0 },
          { day: "Sun", runs: 1, success: 1, failure: 0 },
        ],
      },
      recentRuns: [],
    },
    {
      id: "agent-004",
      name: "Customer Segmentation",
      description: "Analyzes customer behavior and automatically assigns customers to segments",
      stage: "testing",
      status: "active",
      successRate: 76,
      lastRun: {
        timestamp: "5 hours ago",
        outcome: "partial",
      },
      config: {
        id: "agent-004",
        name: "Customer Segmentation",
        description: "Analyzes and segments customers",
        trigger: {
          type: "schedule",
          value: "0 2 * * 0",
        },
        actions: [
          {
            type: "analyze_customers",
            config: { metrics: ["ltv", "frequency", "recency"] },
          },
          {
            type: "assign_segments",
            config: { algorithm: "kmeans", clusters: 4 },
          },
        ],
        settings: {
          timeout: 180,
          retries: 1,
          priority: "low",
        },
      },
      performance: {
        totalRuns: 25,
        successfulRuns: 19,
        failedRuns: 6,
        avgDuration: 15240,
        lastWeekRuns: [
          { day: "Mon", runs: 0, success: 0, failure: 0 },
          { day: "Tue", runs: 0, success: 0, failure: 0 },
          { day: "Wed", runs: 0, success: 0, failure: 0 },
          { day: "Thu", runs: 0, success: 0, failure: 0 },
          { day: "Fri", runs: 0, success: 0, failure: 0 },
          { day: "Sat", runs: 0, success: 0, failure: 0 },
          { day: "Sun", runs: 1, success: 0, failure: 1 },
        ],
      },
      recentRuns: [],
    },
    {
      id: "agent-005",
      name: "Weather Monitor",
      description: "Monitors weather forecasts and suggests schedule changes for outdoor work",
      stage: "development",
      status: "inactive",
      successRate: 62,
      lastRun: {
        timestamp: "2 days ago",
        outcome: "failure",
      },
      config: {
        id: "agent-005",
        name: "Weather Monitor",
        description: "Monitors weather and adjusts schedules",
        trigger: {
          type: "schedule",
          value: "0 */6 * * *",
        },
        actions: [
          {
            type: "fetch_weather",
            config: { service: "openweather", daysAhead: 3 },
          },
          {
            type: "analyze_impact",
            config: { rainThreshold: 50, windThreshold: 25 },
          },
          {
            type: "suggest_reschedule",
            config: { notifyCrews: true },
          },
        ],
        settings: {
          timeout: 45,
          retries: 3,
          priority: "medium",
        },
      },
      performance: {
        totalRuns: 42,
        successfulRuns: 26,
        failedRuns: 16,
        avgDuration: 3120,
        lastWeekRuns: [
          { day: "Mon", runs: 0, success: 0, failure: 0 },
          { day: "Tue", runs: 0, success: 0, failure: 0 },
          { day: "Wed", runs: 0, success: 0, failure: 0 },
          { day: "Thu", runs: 0, success: 0, failure: 0 },
          { day: "Fri", runs: 0, success: 0, failure: 0 },
          { day: "Sat", runs: 0, success: 0, failure: 0 },
          { day: "Sun", runs: 0, success: 0, failure: 0 },
        ],
      },
      recentRuns: [],
    },
    {
      id: "agent-006",
      name: "Quality Assurance",
      description: "Reviews completed jobs and flags quality issues based on photos and customer feedback",
      stage: "development",
      status: "inactive",
      successRate: 0,
      config: {
        id: "agent-006",
        name: "Quality Assurance",
        description: "Automated quality review",
        trigger: {
          type: "event",
          value: "job.completed",
        },
        actions: [
          {
            type: "analyze_photos",
            config: { model: "vision-v2", checkList: ["edges", "debris", "uniformity"] },
          },
          {
            type: "review_feedback",
            config: { sentimentThreshold: 0.7 },
          },
        ],
        settings: {
          timeout: 60,
          retries: 1,
          priority: "low",
        },
      },
      performance: {
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
        avgDuration: 0,
        lastWeekRuns: [
          { day: "Mon", runs: 0, success: 0, failure: 0 },
          { day: "Tue", runs: 0, success: 0, failure: 0 },
          { day: "Wed", runs: 0, success: 0, failure: 0 },
          { day: "Thu", runs: 0, success: 0, failure: 0 },
          { day: "Fri", runs: 0, success: 0, failure: 0 },
          { day: "Sat", runs: 0, success: 0, failure: 0 },
          { day: "Sun", runs: 0, success: 0, failure: 0 },
        ],
      },
      recentRuns: [],
    },
  ]

  // All events for global feed
  const allEvents: AgentEvent[] = agents.flatMap((agent) => agent.recentRuns)

  // Filter agents
  const filteredAgents = agents.filter((agent) => {
    const matchesSearch =
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStage = stageFilter === "all" || agent.stage === stageFilter
    return matchesSearch && matchesStage
  })

  // Group agents by stage
  const groupedAgents = filteredAgents.reduce((acc, agent) => {
    if (!acc[agent.stage]) {
      acc[agent.stage] = []
    }
    acc[agent.stage].push(agent)
    return acc
  }, {} as Record<AgentLifecycleStage, Agent[]>)

  const stageOrder: AgentLifecycleStage[] = ["production", "testing", "development", "archived"]
  const stageLabels = {
    production: "Production",
    testing: "Testing",
    development: "Development",
    archived: "Archived",
  }

  return (
    <WebAppShell
      pageTitle="Agents"
      userRole="ADMIN"
      userName="John Smith"
      userEmail="john@lawnflow.ai"
    >
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold mb-2">Agent Studio</h2>
            <p className="text-muted-foreground">
              Design, test, and deploy AI agents for automation
            </p>
          </div>
          <div className="flex gap-2">
            <WebButton variant="secondary">
              <Activity className="w-4 h-4 mr-2" />
              View Events
            </WebButton>
            <WebButton variant="primary">
              <Plus className="w-4 h-4 mr-2" />
              Create Agent
            </WebButton>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <WebInput
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <WebSelect
            value={stageFilter}
            onChange={(value) => setStageFilter(value as AgentLifecycleStage | "all")}
            options={[
              { value: "all", label: "All Stages" },
              { value: "production", label: "Production" },
              { value: "testing", label: "Testing" },
              { value: "development", label: "Development" },
              { value: "archived", label: "Archived" },
            ]}
          />
        </div>

        {/* Agent Groups */}
        <div className="space-y-8">
          {stageOrder.map((stage) => {
            const stageAgents = groupedAgents[stage] || []
            if (stageAgents.length === 0) return null

            return (
              <div key={stage}>
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-lg font-semibold">{stageLabels[stage]}</h3>
                  <WebBadge variant="neutral" size="sm">
                    {stageAgents.length}
                  </WebBadge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stageAgents.map((agent) => (
                    <WebAgentCard
                      key={agent.id}
                      name={agent.name}
                      description={agent.description}
                      stage={agent.stage}
                      status={agent.status}
                      successRate={agent.successRate}
                      lastRun={agent.lastRun}
                      onViewDetails={() => setSelectedAgent(agent)}
                      onEdit={() => console.log("Edit agent", agent.name)}
                      onTest={() => setTestingAgent(agent)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Global Event Feed Section */}
        {allEvents.length > 0 && (
          <div className="bg-card border border-border rounded-lg">
            <div className="px-6 py-4 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">Recent Events</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Real-time agent execution timeline
                  </p>
                </div>
                <div className="flex gap-2">
                  <WebSelect
                    value={eventFilter.agentId}
                    onChange={(value) =>
                      setEventFilter((prev) => ({ ...prev, agentId: value }))
                    }
                    options={[
                      { value: "all", label: "All Agents" },
                      ...agents.map((a) => ({ value: a.id, label: a.name })),
                    ]}
                  />
                </div>
              </div>
            </div>
            <div className="p-6">
              <WebAgentEventFeed
                events={allEvents}
                loading={false}
                hasMore={false}
                filters={eventFilter}
              />
            </div>
          </div>
        )}
      </div>

      {/* Agent Detail Drawer */}
      <WebContextualDrawer
        open={!!selectedAgent}
        onClose={() => setSelectedAgent(null)}
        title={selectedAgent?.name}
        description={selectedAgent?.description}
        size="lg"
        footer={
          selectedAgent && (
            <div className="flex justify-between items-center">
              <WebButton variant="ghost" onClick={() => setSelectedAgent(null)}>
                Close
              </WebButton>
              <div className="flex gap-2">
                <WebButton variant="secondary" onClick={() => setTestingAgent(selectedAgent)}>
                  <Play className="w-4 h-4 mr-2" />
                  Test Agent
                </WebButton>
                <WebButton variant="secondary">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </WebButton>
              </div>
            </div>
          )
        }
      >
        {selectedAgent && (
          <div className="space-y-6">
            {/* Performance Overview */}
            <div>
              <h3 className="font-semibold mb-4">Performance Overview</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Total Runs</p>
                  </div>
                  <p className="text-2xl font-semibold">{selectedAgent.performance.totalRuns}</p>
                </div>
                <div className="bg-success/10 border border-success/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-success" />
                    <p className="text-xs text-success font-medium">Success Rate</p>
                  </div>
                  <p className="text-2xl font-semibold text-success">
                    {selectedAgent.successRate}%
                  </p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Avg Duration</p>
                  </div>
                  <p className="text-2xl font-semibold">
                    {selectedAgent.performance.avgDuration}ms
                  </p>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="w-4 h-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Failed Runs</p>
                  </div>
                  <p className="text-2xl font-semibold">
                    {selectedAgent.performance.failedRuns}
                  </p>
                </div>
              </div>
            </div>

            {/* Performance Chart */}
            <WebChartContainer
              title="Last 7 Days Activity"
              subtitle="Execution history and outcomes"
            >
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={selectedAgent.performance.lastWeekRuns}>
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
                  <Bar
                    dataKey="success"
                    fill="hsl(var(--lf-success-500))"
                    radius={[4, 4, 0, 0]}
                    name="Success"
                  />
                  <Bar
                    dataKey="failure"
                    fill="hsl(var(--destructive))"
                    radius={[4, 4, 0, 0]}
                    name="Failure"
                  />
                </BarChart>
              </ResponsiveContainer>
            </WebChartContainer>

            {/* Agent Configuration */}
            <WebAgentConfigPanel
              config={selectedAgent.config}
              onEdit={() => console.log("Edit config")}
            />

            {/* Recent Runs Timeline */}
            {selectedAgent.recentRuns.length > 0 && (
              <div>
                <h3 className="font-semibold mb-4">Recent Runs</h3>
                <WebAgentEventFeed
                  events={selectedAgent.recentRuns}
                  loading={false}
                  hasMore={false}
                />
              </div>
            )}
          </div>
        )}
      </WebContextualDrawer>

      {/* Test Execution Panel (Modal could work here) */}
      <WebContextualDrawer
        open={!!testingAgent}
        onClose={() => setTestingAgent(null)}
        title={`Test: ${testingAgent?.name}`}
        description="Execute agent with test data"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <WebButton variant="secondary" onClick={() => setTestingAgent(null)}>
              Cancel
            </WebButton>
            <WebButton variant="primary">
              <Play className="w-4 h-4 mr-2" />
              Run Test
            </WebButton>
          </div>
        }
      >
        {testingAgent && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Test Input (JSON)</label>
              <textarea
                className="w-full h-40 bg-muted rounded-lg p-3 font-mono text-sm border border-border"
                placeholder='{"propertySize": 5000, "serviceType": "mowing"}'
              />
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-2">
                This will execute the agent with your test data. Results will appear in the event
                feed.
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Zap className="w-3 h-3" />
                <span>Estimated runtime: {testingAgent.performance.avgDuration}ms</span>
              </div>
            </div>
          </div>
        )}
      </WebContextualDrawer>
    </WebAppShell>
  )
}
