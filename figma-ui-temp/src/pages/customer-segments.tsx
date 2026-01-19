import * as React from "react"
import { WebAppShell } from "../components/web/app-shell"
import { WebDataTable, DataTableColumn, DataTableAction } from "../components/web/data-table"
import { WebButton } from "../components/web/button"
import { WebBadge } from "../components/web/badge"
import { WebSegmentCard, SegmentVariant } from "../components/web/segment-card"
import { WebCustomerHealthBadge, CustomerHealthStatus } from "../components/web/customer-health-badge"
import {
  Eye,
  MessageSquare,
  Briefcase,
  Mail,
  DollarSign,
  Calendar,
  Star,
  Download,
  Filter as FilterIcon,
} from "lucide-react"

interface Customer {
  id: string
  name: string
  type: "residential" | "commercial"
  email: string
  segment: SegmentVariant
  healthStatus: CustomerHealthStatus
  healthScore: number
  ltv: string
  lastContact: string
  totalJobs: number
  activeJobs: number
  satisfaction: number
  since: string
  lastPurchase?: string
  daysSinceContact?: number
}

interface Segment {
  id: SegmentVariant
  title: string
  count: number
  criteria: string
  trend?: {
    value: string
    direction: "up" | "down" | "neutral"
  }
}

export default function CustomerSegmentsPage() {
  const [selectedSegment, setSelectedSegment] = React.useState<SegmentVariant | null>(null)
  const [selectedRows, setSelectedRows] = React.useState<Set<string>>(new Set())

  // Sample customer data
  const allCustomers: Customer[] = [
    // High-Value Customers
    {
      id: "1",
      name: "ABC Properties Inc.",
      type: "commercial",
      email: "contact@abcproperties.com",
      segment: "high-value",
      healthStatus: "excellent",
      healthScore: 95,
      ltv: "$124,500",
      lastContact: "2 days ago",
      totalJobs: 48,
      activeJobs: 3,
      satisfaction: 5,
      since: "2022-03-15",
      daysSinceContact: 2,
    },
    {
      id: "5",
      name: "Park Management Co.",
      type: "commercial",
      email: "info@parkmanagement.com",
      segment: "high-value",
      healthStatus: "excellent",
      healthScore: 92,
      ltv: "$89,300",
      lastContact: "1 day ago",
      totalJobs: 52,
      activeJobs: 4,
      satisfaction: 4.8,
      since: "2021-01-10",
      daysSinceContact: 1,
    },
    {
      id: "13",
      name: "Downtown Business District",
      type: "commercial",
      email: "admin@downtownbd.org",
      segment: "high-value",
      healthStatus: "good",
      healthScore: 88,
      ltv: "$67,800",
      lastContact: "3 days ago",
      totalJobs: 38,
      activeJobs: 2,
      satisfaction: 4.5,
      since: "2022-06-01",
      daysSinceContact: 3,
    },

    // At-Risk Customers
    {
      id: "3",
      name: "Green Valley HOA",
      type: "commercial",
      email: "board@greenvalleyhoa.org",
      segment: "at-risk",
      healthStatus: "at-risk",
      healthScore: 58,
      ltv: "$45,200",
      lastContact: "3 weeks ago",
      totalJobs: 36,
      activeJobs: 2,
      satisfaction: 3.5,
      since: "2021-08-10",
      daysSinceContact: 21,
    },
    {
      id: "14",
      name: "Riverside Apartments",
      type: "commercial",
      email: "mgmt@riverside.com",
      segment: "at-risk",
      healthStatus: "at-risk",
      healthScore: 62,
      ltv: "$32,400",
      lastContact: "2 weeks ago",
      totalJobs: 28,
      activeJobs: 1,
      satisfaction: 3.2,
      since: "2022-11-20",
      daysSinceContact: 14,
    },
    {
      id: "15",
      name: "Thompson Residence",
      type: "residential",
      email: "thompson@email.com",
      segment: "at-risk",
      healthStatus: "fair",
      healthScore: 55,
      ltv: "$6,200",
      lastContact: "4 weeks ago",
      totalJobs: 15,
      activeJobs: 0,
      satisfaction: 3,
      since: "2023-04-15",
      daysSinceContact: 28,
    },

    // New Customers
    {
      id: "16",
      name: "Martinez Family",
      type: "residential",
      email: "martinez@email.com",
      segment: "new",
      healthStatus: "good",
      healthScore: 75,
      ltv: "$1,200",
      lastContact: "1 day ago",
      totalJobs: 3,
      activeJobs: 1,
      satisfaction: 4.5,
      since: "2025-12-15",
      daysSinceContact: 1,
    },
    {
      id: "17",
      name: "Tech Startup Campus",
      type: "commercial",
      email: "facilities@techstartup.com",
      segment: "new",
      healthStatus: "good",
      healthScore: 78,
      ltv: "$8,500",
      lastContact: "2 days ago",
      totalJobs: 4,
      activeJobs: 2,
      satisfaction: 5,
      since: "2025-12-01",
      daysSinceContact: 2,
    },
    {
      id: "18",
      name: "Chen Residence",
      type: "residential",
      email: "chen@email.com",
      segment: "new",
      healthStatus: "good",
      healthScore: 72,
      ltv: "$980",
      lastContact: "3 days ago",
      totalJobs: 2,
      activeJobs: 1,
      satisfaction: 4,
      since: "2026-01-05",
      daysSinceContact: 3,
    },
    {
      id: "19",
      name: "Oak Street Condos",
      type: "commercial",
      email: "hoa@oakstreet.com",
      segment: "new",
      healthStatus: "excellent",
      healthScore: 82,
      ltv: "$5,400",
      lastContact: "1 day ago",
      totalJobs: 3,
      activeJobs: 1,
      satisfaction: 5,
      since: "2025-12-20",
      daysSinceContact: 1,
    },

    // Dormant Customers
    {
      id: "20",
      name: "Peterson Residence",
      type: "residential",
      email: "peterson@email.com",
      segment: "dormant",
      healthStatus: "fair",
      healthScore: 45,
      ltv: "$4,800",
      lastContact: "4 months ago",
      totalJobs: 12,
      activeJobs: 0,
      satisfaction: 3.5,
      since: "2023-03-10",
      lastPurchase: "2025-09-15",
      daysSinceContact: 120,
    },
    {
      id: "21",
      name: "Westside Shopping Plaza",
      type: "commercial",
      email: "ops@westsideplaza.com",
      segment: "dormant",
      healthStatus: "fair",
      healthScore: 48,
      ltv: "$28,600",
      lastContact: "3 months ago",
      totalJobs: 24,
      activeJobs: 0,
      satisfaction: 3.8,
      since: "2022-05-20",
      lastPurchase: "2025-10-10",
      daysSinceContact: 90,
    },
    {
      id: "22",
      name: "Garcia Family",
      type: "residential",
      email: "garcia@email.com",
      segment: "dormant",
      healthStatus: "fair",
      healthScore: 42,
      ltv: "$3,200",
      lastContact: "5 months ago",
      totalJobs: 8,
      activeJobs: 0,
      satisfaction: 3,
      since: "2023-08-01",
      lastPurchase: "2025-08-20",
      daysSinceContact: 150,
    },

    // Churned Customers
    {
      id: "23",
      name: "Old Mill Apartments",
      type: "commercial",
      email: "mgmt@oldmill.com",
      segment: "churned",
      healthStatus: "critical",
      healthScore: 15,
      ltv: "$18,900",
      lastContact: "8 months ago",
      totalJobs: 18,
      activeJobs: 0,
      satisfaction: 2,
      since: "2021-11-15",
      lastPurchase: "2025-05-10",
      daysSinceContact: 240,
    },
    {
      id: "24",
      name: "Anderson Residence",
      type: "residential",
      email: "anderson@email.com",
      segment: "churned",
      healthStatus: "critical",
      healthScore: 18,
      ltv: "$2,400",
      lastContact: "7 months ago",
      totalJobs: 6,
      activeJobs: 0,
      satisfaction: 2.5,
      since: "2023-02-01",
      lastPurchase: "2025-06-15",
      daysSinceContact: 210,
    },

    // Additional customers for variety
    {
      id: "2",
      name: "Sarah Johnson",
      type: "residential",
      email: "sarah.j@email.com",
      segment: "high-value",
      healthStatus: "good",
      healthScore: 82,
      ltv: "$8,450",
      lastContact: "1 week ago",
      totalJobs: 24,
      activeJobs: 1,
      satisfaction: 4.5,
      since: "2023-05-20",
      daysSinceContact: 7,
    },
    {
      id: "4",
      name: "Mike Wilson",
      type: "residential",
      email: "mike.wilson@email.com",
      segment: "high-value",
      healthStatus: "good",
      healthScore: 78,
      ltv: "$5,680",
      lastContact: "4 days ago",
      totalJobs: 18,
      activeJobs: 1,
      satisfaction: 4,
      since: "2024-03-01",
      daysSinceContact: 4,
    },
  ]

  // Calculate segment counts
  const segments: Segment[] = [
    {
      id: "high-value",
      title: "High-Value Customers",
      count: allCustomers.filter((c) => c.segment === "high-value").length,
      criteria: "LTV > $50k or consistent high-value transactions",
      trend: { value: "+2", direction: "up" },
    },
    {
      id: "at-risk",
      title: "At-Risk Customers",
      count: allCustomers.filter((c) => c.segment === "at-risk").length,
      criteria: "Declining satisfaction, payment delays, or service complaints",
      trend: { value: "+1", direction: "up" },
    },
    {
      id: "new",
      title: "New Customers",
      count: allCustomers.filter((c) => c.segment === "new").length,
      criteria: "Customer since < 3 months",
      trend: { value: "+4", direction: "up" },
    },
    {
      id: "dormant",
      title: "Dormant Customers",
      count: allCustomers.filter((c) => c.segment === "dormant").length,
      criteria: "No activity in 90+ days",
      trend: { value: "-2", direction: "down" },
    },
    {
      id: "churned",
      title: "Churned Customers",
      count: allCustomers.filter((c) => c.segment === "churned").length,
      criteria: "No activity in 180+ days",
      trend: { value: "→ 0", direction: "neutral" },
    },
  ]

  // Filter customers by selected segment
  const filteredCustomers = selectedSegment
    ? allCustomers.filter((c) => c.segment === selectedSegment)
    : allCustomers

  // Table columns
  const columns: DataTableColumn<Customer>[] = [
    {
      id: "customer",
      header: "Customer",
      accessor: "name",
      sortable: true,
      render: (value, row) => (
        <div>
          <div className="font-medium text-foreground">{value}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            <div className="flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {row.email}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "segment",
      header: "Segment",
      width: "140px",
      render: (_, row) => {
        const segmentLabels: Record<SegmentVariant, string> = {
          "high-value": "High-Value",
          "at-risk": "At-Risk",
          new: "New",
          dormant: "Dormant",
          churned: "Churned",
        }
        const segmentColors: Record<SegmentVariant, any> = {
          "high-value": "success",
          "at-risk": "warning",
          new: "primary",
          dormant: "neutral",
          churned: "destructive",
        }
        return (
          <WebBadge variant="status" status={segmentColors[row.segment]} size="sm">
            {segmentLabels[row.segment]}
          </WebBadge>
        )
      },
    },
    {
      id: "health",
      header: "Health",
      width: "140px",
      render: (_, row) => (
        <WebCustomerHealthBadge
          status={row.healthStatus}
          score={row.healthScore}
          showLabel
          size="sm"
        />
      ),
    },
    {
      id: "ltv",
      header: "LTV",
      width: "120px",
      sortable: true,
      align: "right",
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1">
          <DollarSign className="w-3 h-3 text-muted-foreground" />
          <span className="font-semibold">{row.ltv}</span>
        </div>
      ),
    },
    {
      id: "lastContact",
      header: "Last Contact",
      accessor: "lastContact",
      width: "130px",
      render: (value, row) => (
        <div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-muted-foreground" />
            <span className="text-sm">{value}</span>
          </div>
          {row.daysSinceContact !== undefined && row.daysSinceContact > 30 && (
            <div className="text-xs text-destructive mt-0.5">
              {row.daysSinceContact} days
            </div>
          )}
        </div>
      ),
    },
    {
      id: "jobs",
      header: "Jobs",
      width: "100px",
      align: "center",
      render: (_, row) => (
        <div className="text-center">
          <div className="font-semibold text-foreground">{row.totalJobs}</div>
          <div className="text-xs text-muted-foreground">{row.activeJobs} active</div>
        </div>
      ),
    },
    {
      id: "satisfaction",
      header: "Satisfaction",
      width: "120px",
      render: (_, row) => (
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={cn(
                "w-3.5 h-3.5",
                i < Math.floor(row.satisfaction)
                  ? "fill-warning text-warning"
                  : i < row.satisfaction
                  ? "fill-warning/50 text-warning"
                  : "text-muted-foreground/30"
              )}
            />
          ))}
          <span className="text-xs text-muted-foreground ml-1">
            {row.satisfaction.toFixed(1)}
          </span>
        </div>
      ),
    },
  ]

  // Row actions
  const rowActions: DataTableAction<Customer>[] = [
    {
      id: "view",
      label: "View Profile",
      icon: <Eye className="w-4 h-4" />,
      onClick: (row) => console.log("View profile", row.name),
    },
    {
      id: "message",
      label: "Send Message",
      icon: <MessageSquare className="w-4 h-4" />,
      onClick: (row) => console.log("Send message to", row.name),
    },
    {
      id: "jobs",
      label: "View Jobs",
      icon: <Briefcase className="w-4 h-4" />,
      onClick: (row) => console.log("View jobs for", row.name),
    },
  ]

  return (
    <WebAppShell
      pageTitle="Customer Segments"
      userRole="ADMIN"
      userName="John Smith"
      userEmail="john@lawnflow.ai"
    >
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Page Header */}
        <div>
          <h2 className="text-2xl font-semibold mb-2">Customer Segments</h2>
          <p className="text-muted-foreground">
            Analyze and manage customers by behavioral segments
          </p>
        </div>

        {/* Segment Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {segments.map((segment) => (
            <WebSegmentCard
              key={segment.id}
              variant={segment.id}
              title={segment.title}
              count={segment.count}
              criteria={segment.criteria}
              trend={segment.trend}
              isActive={selectedSegment === segment.id}
              onClick={() => setSelectedSegment(selectedSegment === segment.id ? null : segment.id)}
            />
          ))}
        </div>

        {/* Table Section */}
        <div className="bg-card border border-border rounded-lg">
          {/* Table Header */}
          <div className="px-6 py-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">
                  {selectedSegment
                    ? segments.find((s) => s.id === selectedSegment)?.title
                    : "All Customers"}
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? "s" : ""}
                  {selectedSegment && " in this segment"}
                </p>
              </div>
              <div className="flex gap-2">
                {selectedSegment && (
                  <WebButton
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedSegment(null)}
                  >
                    Clear Filter
                  </WebButton>
                )}
                <WebButton variant="secondary" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </WebButton>
                {selectedSegment === "at-risk" && (
                  <WebButton variant="primary" size="sm">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Engagement Campaign
                  </WebButton>
                )}
                {selectedSegment === "dormant" && (
                  <WebButton variant="primary" size="sm">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Win-Back Campaign
                  </WebButton>
                )}
              </div>
            </div>
          </div>

          {/* Bulk Action Bar */}
          {selectedRows.size > 0 && (
            <div className="px-6 py-3 bg-primary/5 border-b border-border">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {selectedRows.size} customer{selectedRows.size !== 1 ? "s" : ""} selected
                </span>
                <div className="flex gap-2">
                  <WebButton variant="secondary" size="sm">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Send Message
                  </WebButton>
                  <WebButton variant="secondary" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Export Selected
                  </WebButton>
                  <WebButton
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedRows(new Set())}
                  >
                    Clear
                  </WebButton>
                </div>
              </div>
            </div>
          )}

          {/* Data Table */}
          <div className="p-6">
            <WebDataTable
              columns={columns}
              data={filteredCustomers}
              selectable
              selectedRows={selectedRows}
              onSelectionChange={setSelectedRows}
              onRowClick={(row) => console.log("View customer", row.name)}
              rowActions={rowActions}
              keyField="id"
            />
          </div>
        </div>

        {/* Segment Insights */}
        {selectedSegment && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-lg p-6">
              <h4 className="font-semibold mb-2">Average LTV</h4>
              <p className="text-2xl font-semibold text-foreground">
                {selectedSegment === "high-value" && "$71,682"}
                {selectedSegment === "at-risk" && "$27,933"}
                {selectedSegment === "new" && "$4,020"}
                {selectedSegment === "dormant" && "$12,200"}
                {selectedSegment === "churned" && "$10,650"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Per customer in segment</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-6">
              <h4 className="font-semibold mb-2">Avg Satisfaction</h4>
              <div className="flex items-center gap-2 mb-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "w-5 h-5",
                      (selectedSegment === "high-value" && i < 4.6) ||
                      (selectedSegment === "at-risk" && i < 3.2) ||
                      (selectedSegment === "new" && i < 4.4) ||
                      (selectedSegment === "dormant" && i < 3.4) ||
                      (selectedSegment === "churned" && i < 2.3)
                        ? "fill-warning text-warning"
                        : "text-muted-foreground/30"
                    )}
                  />
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedSegment === "high-value" && "4.6 / 5.0"}
                {selectedSegment === "at-risk" && "3.2 / 5.0"}
                {selectedSegment === "new" && "4.4 / 5.0"}
                {selectedSegment === "dormant" && "3.4 / 5.0"}
                {selectedSegment === "churned" && "2.3 / 5.0"}
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-6">
              <h4 className="font-semibold mb-2">Recommended Action</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {selectedSegment === "high-value" &&
                  "Maintain regular touchpoints and explore upsell opportunities"}
                {selectedSegment === "at-risk" &&
                  "Immediate outreach to address concerns and prevent churn"}
                {selectedSegment === "new" && "Focus on onboarding and building trust"}
                {selectedSegment === "dormant" && "Re-engagement campaign with special offers"}
                {selectedSegment === "churned" && "Win-back campaign or exit survey"}
              </p>
            </div>
          </div>
        )}
      </div>
    </WebAppShell>
  )
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ")
}
