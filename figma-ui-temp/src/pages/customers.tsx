import * as React from "react"
import { WebAppShell } from "../components/web/app-shell"
import { WebFilteredListLayout } from "../components/web/filtered-list-layout"
import { WebDataTable, DataTableColumn, DataTableAction } from "../components/web/data-table"
import { WebContextualDrawer } from "../components/web/contextual-drawer"
import { WebButton } from "../components/web/button"
import { WebBadge } from "../components/web/badge"
import { WebCustomerHealthBadge, CustomerHealthStatus } from "../components/web/customer-health-badge"
import { TimelineItem } from "../components/web/timeline-item"
import { WebInput } from "../components/web/input"
import { WebSelect } from "../components/web/select"
import { WebModal } from "../components/web/modal"
import { WebTextarea } from "../components/web/textarea"
import {
  Filter,
  MessageSquare,
  FileText,
  Eye,
  Briefcase,
  Mail,
  Phone,
  MapPin,
  DollarSign,
  Calendar,
  Star,
  TrendingUp,
  User,
  Bot,
  Trash2,
  CheckCircle,
  Gift,
} from "lucide-react"

interface Customer {
  id: string
  name: string
  type: "residential" | "commercial"
  email: string
  phone: string
  address: string
  healthStatus: CustomerHealthStatus
  healthScore: number
  ltv: string // Lifetime value
  lastContact: string
  totalJobs: number
  activeJobs: number
  satisfaction: number // 0-5 stars
  since: string
  billingInfo: {
    paymentMethod: string
    nextBilling: string
    outstandingBalance: string
  }
  services: Array<{
    id: string
    name: string
    frequency: string
    lastService: string
    nextScheduled: string
  }>
  timeline: Array<{
    id: string
    title: string
    description: string
    timestamp: string
    status: "completed" | "active" | "pending"
  }>
  aiNotes: Array<{
    id: string
    date: string
    note: string
    confidence: "high" | "medium" | "low"
  }>
  tags: string[]
}

export default function CustomersPage() {
  const [selectedRows, setSelectedRows] = React.useState<Set<string>>(new Set())
  const [selectedCustomer, setSelectedCustomer] = React.useState<Customer | null>(null)
  const [showMobileFilters, setShowMobileFilters] = React.useState(false)
  const [showUpsellModal, setShowUpsellModal] = React.useState(false)
  const [showAgentModal, setShowAgentModal] = React.useState(false)
  const [upsellCustomer, setUpsellCustomer] = React.useState<Customer | null>(null)
  const [agentInstructions, setAgentInstructions] = React.useState("")

  const handleActivateUpsellAgent = (customer: Customer) => {
    console.log(`Activating upsell agent for ${customer.name} with instructions:`, agentInstructions)
    setShowAgentModal(false)
    setAgentInstructions("")
  }

  // Sample customer data
  const customers: Customer[] = [
    {
      id: "1",
      name: "ABC Properties Inc.",
      type: "commercial",
      email: "contact@abcproperties.com",
      phone: "(555) 123-4567",
      address: "123 Business Park Dr, Suite 100",
      healthStatus: "excellent",
      healthScore: 95,
      ltv: "$124,500",
      lastContact: "2 days ago",
      totalJobs: 48,
      activeJobs: 3,
      satisfaction: 5,
      since: "2022-03-15",
      billingInfo: {
        paymentMethod: "Net 30 - ACH",
        nextBilling: "2026-02-01",
        outstandingBalance: "$0",
      },
      services: [
        {
          id: "1",
          name: "Weekly Lawn Maintenance",
          frequency: "Weekly",
          lastService: "2026-01-10",
          nextScheduled: "2026-01-17",
        },
        {
          id: "2",
          name: "Seasonal Landscaping",
          frequency: "Quarterly",
          lastService: "2025-12-15",
          nextScheduled: "2026-03-15",
        },
      ],
      timeline: [
        {
          id: "1",
          title: "Service completed",
          description: "Weekly maintenance - All properties",
          timestamp: "2 days ago",
          status: "completed",
        },
        {
          id: "2",
          title: "Invoice paid",
          description: "December invoice - $4,250",
          timestamp: "5 days ago",
          status: "completed",
        },
        {
          id: "3",
          title: "Quote approved",
          description: "Spring landscaping project",
          timestamp: "1 week ago",
          status: "completed",
        },
      ],
      aiNotes: [
        {
          id: "1",
          date: "2026-01-10",
          note: "Customer consistently pays on time and rarely requests changes. High-value account with growth potential. Consider upselling irrigation services.",
          confidence: "high",
        },
        {
          id: "2",
          date: "2025-12-15",
          note: "Property manager expressed interest in expanding services to additional locations. Schedule follow-up meeting in Q1 2026.",
          confidence: "high",
        },
      ],
      tags: ["VIP", "Commercial", "High-Value"],
    },
    {
      id: "2",
      name: "Sarah Johnson",
      type: "residential",
      email: "sarah.j@email.com",
      phone: "(555) 234-5678",
      address: "456 Maple Avenue",
      healthStatus: "good",
      healthScore: 82,
      ltv: "$8,450",
      lastContact: "1 week ago",
      totalJobs: 24,
      activeJobs: 1,
      satisfaction: 4.5,
      since: "2023-05-20",
      billingInfo: {
        paymentMethod: "Credit Card - Auto",
        nextBilling: "2026-01-20",
        outstandingBalance: "$0",
      },
      services: [
        {
          id: "1",
          name: "Bi-weekly Mowing",
          frequency: "Bi-weekly",
          lastService: "2026-01-08",
          nextScheduled: "2026-01-22",
        },
      ],
      timeline: [
        {
          id: "1",
          title: "Service completed",
          description: "Bi-weekly mowing service",
          timestamp: "4 days ago",
          status: "completed",
        },
        {
          id: "2",
          title: "Payment processed",
          description: "Auto-payment successful",
          timestamp: "1 week ago",
          status: "completed",
        },
      ],
      aiNotes: [
        {
          id: "1",
          date: "2026-01-08",
          note: "Customer satisfaction remains high. Reliable payment history. Good candidate for seasonal service upsells.",
          confidence: "high",
        },
      ],
      tags: ["Residential", "Auto-Pay"],
    },
    {
      id: "3",
      name: "Green Valley HOA",
      type: "commercial",
      email: "board@greenvalleyhoa.org",
      phone: "(555) 345-6789",
      address: "789 Valley Road",
      healthStatus: "at-risk",
      healthScore: 58,
      ltv: "$45,200",
      lastContact: "3 weeks ago",
      totalJobs: 36,
      activeJobs: 2,
      satisfaction: 3.5,
      since: "2021-08-10",
      billingInfo: {
        paymentMethod: "Check - Net 60",
        nextBilling: "2026-02-15",
        outstandingBalance: "$2,450",
      },
      services: [
        {
          id: "1",
          name: "Common Area Maintenance",
          frequency: "Weekly",
          lastService: "2026-01-09",
          nextScheduled: "2026-01-16",
        },
      ],
      timeline: [
        {
          id: "1",
          title: "Payment overdue",
          description: "Invoice #2025-12 - $2,450 (15 days overdue)",
          timestamp: "2 weeks ago",
          status: "pending",
        },
        {
          id: "2",
          title: "Service complaint",
          description: "Board member reported missed area",
          timestamp: "3 weeks ago",
          status: "completed",
        },
      ],
      aiNotes: [
        {
          id: "1",
          date: "2026-01-05",
          note: "ALERT: Payment delays increasing. Recent service complaints. Recommend immediate follow-up call with board president to address concerns.",
          confidence: "high",
        },
        {
          id: "2",
          date: "2025-12-20",
          note: "Customer may be evaluating alternative providers. Consider offering service review meeting to reinforce value.",
          confidence: "medium",
        },
      ],
      tags: ["HOA", "Payment-Risk"],
    },
    {
      id: "4",
      name: "Mike Wilson",
      type: "residential",
      email: "mike.wilson@email.com",
      phone: "(555) 456-7890",
      address: "321 Oak Street",
      healthStatus: "good",
      healthScore: 78,
      ltv: "$5,680",
      lastContact: "4 days ago",
      totalJobs: 18,
      activeJobs: 1,
      satisfaction: 4,
      since: "2024-03-01",
      billingInfo: {
        paymentMethod: "Credit Card",
        nextBilling: "2026-01-25",
        outstandingBalance: "$0",
      },
      services: [
        {
          id: "1",
          name: "Weekly Lawn Care",
          frequency: "Weekly",
          lastService: "2026-01-11",
          nextScheduled: "2026-01-18",
        },
      ],
      timeline: [
        {
          id: "1",
          title: "Emergency service",
          description: "Tree removal after storm",
          timestamp: "4 days ago",
          status: "completed",
        },
        {
          id: "2",
          title: "Service scheduled",
          description: "Regular weekly maintenance",
          timestamp: "1 week ago",
          status: "completed",
        },
      ],
      aiNotes: [
        {
          id: "1",
          date: "2026-01-08",
          note: "Customer recently requested emergency service and was satisfied with response time. Good opportunity to discuss tree care packages.",
          confidence: "medium",
        },
      ],
      tags: ["Residential"],
    },
    {
      id: "5",
      name: "Park Management Co.",
      type: "commercial",
      email: "info@parkmanagement.com",
      phone: "(555) 567-8901",
      address: "654 Corporate Blvd",
      healthStatus: "excellent",
      healthScore: 92,
      ltv: "$89,300",
      lastContact: "1 day ago",
      totalJobs: 52,
      activeJobs: 4,
      satisfaction: 4.8,
      since: "2021-01-10",
      billingInfo: {
        paymentMethod: "ACH - Net 30",
        nextBilling: "2026-02-01",
        outstandingBalance: "$0",
      },
      services: [
        {
          id: "1",
          name: "Multi-Property Maintenance",
          frequency: "Weekly",
          lastService: "2026-01-11",
          nextScheduled: "2026-01-18",
        },
        {
          id: "2",
          name: "Fertilization Program",
          frequency: "Quarterly",
          lastService: "2025-12-10",
          nextScheduled: "2026-03-10",
        },
      ],
      timeline: [
        {
          id: "1",
          title: "Quote requested",
          description: "Spring fertilization package",
          timestamp: "1 day ago",
          status: "active",
        },
        {
          id: "2",
          title: "Service completed",
          description: "All 8 properties serviced",
          timestamp: "3 days ago",
          status: "completed",
        },
      ],
      aiNotes: [
        {
          id: "1",
          date: "2026-01-11",
          note: "Excellent long-term customer with consistent growth. Recently inquired about adding 3 more properties. High retention probability.",
          confidence: "high",
        },
      ],
      tags: ["VIP", "Commercial", "Multi-Location"],
    },
  ]

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
      render: (value) => (
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3 h-3 text-muted-foreground" />
          <span className="text-sm">{value}</span>
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
          <div className="text-xs text-muted-foreground">
            {row.activeJobs} active
          </div>
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
      onClick: (row) => setSelectedCustomer(row),
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
    {
      id: "delete",
      label: "Delete",
      icon: <Trash2 className="w-4 h-4" />,
      onClick: (row) => console.log("Delete", row.name),
      variant: "destructive",
    },
  ]

  // Filter panel
  const filterPanel = (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium mb-3">Customer Type</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="rounded border-border" defaultChecked />
            <span className="text-sm">Residential</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="rounded border-border" defaultChecked />
            <span className="text-sm">Commercial</span>
          </label>
        </div>
      </div>

      <div>
        <h3 className="font-medium mb-3">Health Status</h3>
        <div className="space-y-2">
          {[
            { value: "excellent", label: "Excellent" },
            { value: "good", label: "Good" },
            { value: "fair", label: "Fair" },
            { value: "at-risk", label: "At Risk" },
            { value: "critical", label: "Critical" },
          ].map((option) => (
            <label key={option.value} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="rounded border-border" defaultChecked />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-medium mb-3">Lifetime Value</h3>
        <WebSelect
          options={[
            { value: "all", label: "All" },
            { value: "high", label: "High (>$50k)" },
            { value: "medium", label: "Medium ($10k-$50k)" },
            { value: "low", label: "Low (<$10k)" },
          ]}
        />
      </div>

      <div>
        <h3 className="font-medium mb-3">Tags</h3>
        <div className="space-y-2">
          {["VIP", "Commercial", "Auto-Pay", "Payment-Risk"].map((tag) => (
            <label key={tag} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="rounded border-border" />
              <span className="text-sm">{tag}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <WebAppShell
      pageTitle="Customers"
      userRole="ADMIN"
      userName="John Smith"
      userEmail="john@lawnflow.ai"
    >
      {/* Bulk Action Bar */}
      {selectedRows.size > 0 && (
        <div className="sticky top-16 z-30 bg-primary text-primary-foreground px-6 py-3 flex items-center justify-between border-b border-primary-foreground/20">
          <div className="flex items-center gap-4">
            <span className="font-medium">{selectedRows.size} customers selected</span>
            <div className="flex gap-2">
              <WebButton variant="secondary" size="sm">
                <MessageSquare className="w-4 h-4 mr-2" />
                Send Message
              </WebButton>
              <WebButton variant="secondary" size="sm">
                <FileText className="w-4 h-4 mr-2" />
                Export
              </WebButton>
            </div>
          </div>
          <WebButton
            variant="ghost"
            size="sm"
            onClick={() => setSelectedRows(new Set())}
          >
            Clear Selection
          </WebButton>
        </div>
      )}

      <WebFilteredListLayout
        filterPanel={filterPanel}
        showMobileFilters={showMobileFilters}
        onCloseMobileFilters={() => setShowMobileFilters(false)}
      >
        <div className="p-6">
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">{customers.length} Customers</h2>
              <p className="text-sm text-muted-foreground">
                Manage customer relationships and profiles
              </p>
            </div>
            <div className="flex gap-2">
              <WebButton
                variant="secondary"
                size="sm"
                onClick={() => setShowMobileFilters(true)}
                className="lg:hidden"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </WebButton>
              <WebButton variant="primary" size="sm">
                Add Customer
              </WebButton>
            </div>
          </div>

          <WebDataTable
            columns={columns}
            data={customers}
            selectable
            selectedRows={selectedRows}
            onSelectionChange={setSelectedRows}
            onRowClick={(row) => setSelectedCustomer(row)}
            rowActions={rowActions}
            keyField="id"
          />
        </div>
      </WebFilteredListLayout>

      {/* Customer Profile Drawer */}
      <WebContextualDrawer
        open={!!selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        title={selectedCustomer?.name}
        description={`Customer since ${selectedCustomer?.since}`}
        size="lg"
        footer={
          selectedCustomer && (
            <div className="flex justify-between items-center">
              <WebButton variant="ghost" onClick={() => setSelectedCustomer(null)}>
                Close
              </WebButton>
              <div className="flex gap-2">
                <WebButton variant="secondary">
                  <FileText className="w-4 h-4 mr-2" />
                  Add Note
                </WebButton>
                <WebButton variant="secondary">
                  <Briefcase className="w-4 h-4 mr-2" />
                  View Jobs
                </WebButton>
                <WebButton variant="primary">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Send Message
                </WebButton>
              </div>
            </div>
          )
        }
      >
        {selectedCustomer && (
          <div className="space-y-6">
            {/* Contact Info */}
            <div>
              <h3 className="font-semibold mb-3">Contact Information</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs">Email</p>
                    <a href={`mailto:${selectedCustomer.email}`} className="text-primary hover:underline">
                      {selectedCustomer.email}
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs">Phone</p>
                    <a href={`tel:${selectedCustomer.phone}`} className="text-primary hover:underline">
                      {selectedCustomer.phone}
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs">Address</p>
                    <p className="text-foreground">{selectedCustomer.address}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Health */}
            <div>
              <h3 className="font-semibold mb-3">Customer Health</h3>
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Health Score</span>
                  <WebCustomerHealthBadge
                    status={selectedCustomer.healthStatus}
                    score={selectedCustomer.healthScore}
                    showLabel
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Lifetime Value</span>
                  <span className="text-lg font-semibold">{selectedCustomer.ltv}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Last Contact</span>
                  <span className="font-medium">{selectedCustomer.lastContact}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Satisfaction</span>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "w-4 h-4",
                          i < Math.floor(selectedCustomer.satisfaction)
                            ? "fill-warning text-warning"
                            : i < selectedCustomer.satisfaction
                            ? "fill-warning/50 text-warning"
                            : "text-muted-foreground/30"
                        )}
                      />
                    ))}
                    <span className="text-sm font-medium ml-1">
                      {selectedCustomer.satisfaction.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Services & Billing */}
            <div>
              <h3 className="font-semibold mb-3">Services & Billing</h3>
              <div className="space-y-4">
                {/* Active Services */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Active Services</h4>
                  <div className="space-y-2">
                    {selectedCustomer.services.map((service) => (
                      <div key={service.id} className="bg-muted/50 rounded-lg p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium text-sm">{service.name}</p>
                            <p className="text-xs text-muted-foreground">{service.frequency}</p>
                          </div>
                          <WebBadge variant="status" status="active" size="sm">
                            Active
                          </WebBadge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">Last Service</p>
                            <p className="font-medium">{service.lastService}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Next Scheduled</p>
                            <p className="font-medium">{service.nextScheduled}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Billing Info */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Billing</h4>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payment Method</span>
                      <span className="font-medium">{selectedCustomer.billingInfo.paymentMethod}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Next Billing</span>
                      <span className="font-medium">{selectedCustomer.billingInfo.nextBilling}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Outstanding</span>
                      <span className={cn(
                        "font-semibold",
                        selectedCustomer.billingInfo.outstandingBalance !== "$0" 
                          ? "text-destructive" 
                          : "text-success"
                      )}>
                        {selectedCustomer.billingInfo.outstandingBalance}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Notes */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Bot className="w-4 h-4 text-primary" />
                <h3 className="font-semibold">AI Insights</h3>
                <WebBadge variant="status" status="primary" size="sm">
                  Read-only
                </WebBadge>
              </div>
              <div className="space-y-3">
                {selectedCustomer.aiNotes.map((note) => (
                  <div key={note.id} className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs text-muted-foreground">{note.date}</span>
                      <WebBadge 
                        variant="confidence" 
                        confidence={note.confidence}
                        size="sm"
                      >
                        {note.confidence} confidence
                      </WebBadge>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{note.note}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Interaction Timeline */}
            <div>
              <h3 className="font-semibold mb-4">Interaction Timeline</h3>
              <div>
                {selectedCustomer.timeline.map((event, index) => (
                  <TimelineItem
                    key={event.id}
                    title={event.title}
                    description={event.description}
                    timestamp={event.timestamp}
                    status={event.status}
                    showConnector={index < selectedCustomer.timeline.length - 1}
                  />
                ))}
              </div>
            </div>

            {/* Tags */}
            {selectedCustomer.tags.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedCustomer.tags.map((tag) => (
                    <WebBadge key={tag} variant="status" status="neutral" size="sm">
                      {tag}
                    </WebBadge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </WebContextualDrawer>

      {/* Upsell Modal */}
      <WebModal
        open={showUpsellModal}
        onClose={() => setShowUpsellModal(false)}
        title="Upsell Opportunity"
        description="Select a customer to upsell additional services."
      >
        <div className="space-y-4">
          <WebSelect
            options={customers.map((customer) => ({
              value: customer.id,
              label: customer.name,
            }))}
            onChange={(value) => setUpsellCustomer(customers.find((c) => c.id === value) || null)}
          />
          <WebButton
            variant="primary"
            size="sm"
            onClick={() => setShowAgentModal(true)}
            disabled={!upsellCustomer}
          >
            Activate Upsell Agent
          </WebButton>
        </div>
      </WebModal>

      {/* Agent Instructions Modal */}
      <WebModal
        open={showAgentModal}
        onClose={() => setShowAgentModal(false)}
        title="Agent Instructions"
        description="Provide instructions for the upsell agent."
      >
        <div className="space-y-4">
          <WebTextarea
            placeholder="Enter instructions for the upsell agent..."
            value={agentInstructions}
            onChange={(e) => setAgentInstructions(e.target.value)}
          />
          <WebButton
            variant="primary"
            size="sm"
            onClick={() => handleActivateUpsellAgent(upsellCustomer!)}
          >
            Activate Agent
          </WebButton>
        </div>
      </WebModal>
    </WebAppShell>
  )
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ")
}