import * as React from "react"
import { WebAppShell } from "../components/web/app-shell"
import { WebFilteredListLayout } from "../components/web/filtered-list-layout"
import { WebDataTable, DataTableColumn, DataTableAction } from "../components/web/data-table"
import { WebContextualDrawer } from "../components/web/contextual-drawer"
import { WebButton } from "../components/web/button"
import { WebBadge } from "../components/web/badge"
import { WebSLAIndicator } from "../components/web/sla-indicator"
import { WebProgressBar } from "../components/web/progress-bar"
import { TimelineItem } from "../components/web/timeline-item"
import { WebInput } from "../components/web/input"
import { WebSelect } from "../components/web/select"
import { WebTextarea } from "../components/web/textarea"
import {
  Filter,
  Check,
  X,
  Eye,
  AlertCircle,
  User,
  DollarSign,
  Calendar,
  CheckCircle2,
} from "lucide-react"

interface ApprovalItem {
  id: string
  type: "quote" | "expense" | "change-order" | "invoice-adjustment"
  title: string
  submittedBy: string
  amount?: string
  dueDate: string
  slaStatus: "safe" | "warning" | "critical" | "breached"
  slaTimeRemaining?: string
  confidence: number // 0-100
  priority: "high" | "medium" | "low"
  status: "pending" | "approved" | "rejected"
  description: string
  createdAt: string
  timeline: Array<{
    id: string
    title: string
    description: string
    timestamp: string
    status: "completed" | "active" | "pending"
  }>
  reason?: string
  requestDetails: {
    customer?: string
    jobId?: string
    category?: string
    requestedAmount?: string
  }
}

export default function ApprovalsPage() {
  const [selectedRows, setSelectedRows] = React.useState<Set<string>>(new Set())
  const [selectedItem, setSelectedItem] = React.useState<ApprovalItem | null>(null)
  const [showMobileFilters, setShowMobileFilters] = React.useState(false)
  const [rejectReason, setRejectReason] = React.useState("")
  const [showRejectForm, setShowRejectForm] = React.useState(false)

  // Sample approval data
  const approvalItems: ApprovalItem[] = [
    {
      id: "1",
      type: "quote",
      title: "Commercial Landscaping - Downtown Plaza",
      submittedBy: "John Smith",
      amount: "$45,000",
      dueDate: "2026-01-15",
      slaStatus: "warning",
      slaTimeRemaining: "3h remaining",
      confidence: 92,
      priority: "high",
      status: "pending",
      description: "Large commercial project requiring senior approval due to contract value exceeding $40,000.",
      createdAt: "2026-01-12 09:00",
      requestDetails: {
        customer: "ABC Properties Inc.",
        jobId: "J-2024-1234",
        category: "Commercial Landscaping",
        requestedAmount: "$45,000",
      },
      timeline: [
        {
          id: "1",
          title: "Quote created",
          description: "Initial quote prepared by sales team",
          timestamp: "2 days ago",
          status: "completed",
        },
        {
          id: "2",
          title: "Site assessment completed",
          description: "Technical team reviewed site requirements",
          timestamp: "1 day ago",
          status: "completed",
        },
        {
          id: "3",
          title: "Awaiting approval",
          description: "Submitted to owner for final approval",
          timestamp: "4 hours ago",
          status: "active",
        },
      ],
    },
    {
      id: "2",
      type: "expense",
      title: "Equipment Purchase - Commercial Mower",
      submittedBy: "Mike Johnson",
      amount: "$8,500",
      dueDate: "2026-01-14",
      slaStatus: "safe",
      slaTimeRemaining: "1d remaining",
      confidence: 78,
      priority: "medium",
      status: "pending",
      description: "Request to purchase new commercial mower to replace aging equipment.",
      createdAt: "2026-01-11 14:30",
      requestDetails: {
        category: "Equipment",
        requestedAmount: "$8,500",
      },
      timeline: [
        {
          id: "1",
          title: "Expense request submitted",
          description: "Mike Johnson submitted equipment purchase request",
          timestamp: "1 day ago",
          status: "completed",
        },
        {
          id: "2",
          title: "Under review",
          description: "Finance team reviewing purchase justification",
          timestamp: "6 hours ago",
          status: "active",
        },
      ],
    },
    {
      id: "3",
      type: "change-order",
      title: "Scope Change - Additional Mulching",
      submittedBy: "Sarah Williams",
      amount: "+$2,400",
      dueDate: "2026-01-13",
      slaStatus: "critical",
      slaTimeRemaining: "2h overdue",
      confidence: 95,
      priority: "high",
      status: "pending",
      description: "Customer requested additional mulching beds not in original scope.",
      createdAt: "2026-01-10 11:00",
      requestDetails: {
        customer: "Green Valley HOA",
        jobId: "J-2024-0987",
        category: "Scope Change",
        requestedAmount: "+$2,400",
      },
      timeline: [
        {
          id: "1",
          title: "Change order requested",
          description: "Customer requested scope modification",
          timestamp: "2 days ago",
          status: "completed",
        },
        {
          id: "2",
          title: "Cost estimate prepared",
          description: "Team prepared pricing for additional work",
          timestamp: "1 day ago",
          status: "completed",
        },
        {
          id: "3",
          title: "Approval required",
          description: "Waiting for owner approval to proceed",
          timestamp: "1 day ago",
          status: "active",
        },
      ],
    },
    {
      id: "4",
      type: "invoice-adjustment",
      title: "Invoice Credit - Service Issue",
      submittedBy: "Tom Anderson",
      amount: "-$450",
      dueDate: "2026-01-16",
      slaStatus: "safe",
      confidence: 65,
      priority: "medium",
      status: "pending",
      description: "Customer reported service quality issue, requesting partial credit.",
      createdAt: "2026-01-12 16:00",
      requestDetails: {
        customer: "Johnson Residence",
        jobId: "J-2024-0765",
        category: "Service Adjustment",
        requestedAmount: "-$450",
      },
      timeline: [
        {
          id: "1",
          title: "Credit request received",
          description: "Customer service logged complaint",
          timestamp: "6 hours ago",
          status: "completed",
        },
        {
          id: "2",
          title: "Investigation initiated",
          description: "Team reviewing service records",
          timestamp: "4 hours ago",
          status: "active",
        },
      ],
    },
    {
      id: "5",
      type: "quote",
      title: "Spring Fertilization Package",
      submittedBy: "Lisa Chen",
      amount: "$12,800",
      dueDate: "2026-01-17",
      slaStatus: "safe",
      confidence: 88,
      priority: "low",
      status: "pending",
      description: "Multi-property fertilization package for commercial client.",
      createdAt: "2026-01-11 10:30",
      requestDetails: {
        customer: "Park Management Co.",
        category: "Fertilization Services",
        requestedAmount: "$12,800",
      },
      timeline: [
        {
          id: "1",
          title: "Quote requested",
          description: "Customer inquiry via phone",
          timestamp: "2 days ago",
          status: "completed",
        },
        {
          id: "2",
          title: "Quote prepared",
          description: "Package pricing calculated",
          timestamp: "1 day ago",
          status: "completed",
        },
        {
          id: "3",
          title: "Pending approval",
          description: "Awaiting management review",
          timestamp: "1 day ago",
          status: "pending",
        },
      ],
    },
  ]

  // Table columns
  const columns: DataTableColumn<ApprovalItem>[] = [
    {
      id: "sla",
      header: "SLA",
      width: "100px",
      render: (_, row) => (
        <WebSLAIndicator
          status={row.slaStatus}
          timeRemaining={row.slaTimeRemaining}
        />
      ),
    },
    {
      id: "type",
      header: "Type",
      width: "160px",
      render: (_, row) => {
        const typeLabels = {
          quote: "Quote",
          expense: "Expense",
          "change-order": "Change Order",
          "invoice-adjustment": "Invoice Adjustment",
        }
        const typeVariants = {
          quote: "primary" as const,
          expense: "warning" as const,
          "change-order": "success" as const,
          "invoice-adjustment": "neutral" as const,
        }
        return (
          <WebBadge variant="status" status={typeVariants[row.type]} size="sm">
            {typeLabels[row.type]}
          </WebBadge>
        )
      },
    },
    {
      id: "title",
      header: "Title",
      accessor: "title",
      sortable: true,
      render: (value, row) => (
        <div>
          <div className="font-medium text-foreground">{value}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Submitted by {row.submittedBy}
          </div>
        </div>
      ),
    },
    {
      id: "amount",
      header: "Amount",
      width: "120px",
      align: "right",
      render: (_, row) =>
        row.amount ? (
          <span className="font-semibold text-foreground">{row.amount}</span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        ),
    },
    {
      id: "confidence",
      header: "Confidence",
      width: "140px",
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <WebProgressBar value={row.confidence} size="sm" className="flex-1" />
          <span className="text-xs font-medium text-muted-foreground w-8">
            {row.confidence}%
          </span>
        </div>
      ),
    },
    {
      id: "dueDate",
      header: "Due Date",
      accessor: "dueDate",
      sortable: true,
      width: "120px",
      render: (value) => (
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">{value}</span>
        </div>
      ),
    },
  ]

  // Row actions
  const rowActions: DataTableAction<ApprovalItem>[] = [
    {
      id: "view",
      label: "View Details",
      icon: <Eye className="w-4 h-4" />,
      onClick: (row) => setSelectedItem(row),
    },
    {
      id: "approve",
      label: "Quick Approve",
      icon: <Check className="w-4 h-4" />,
      onClick: (row) => handleApprove([row.id]),
    },
    {
      id: "reject",
      label: "Reject",
      icon: <X className="w-4 h-4" />,
      onClick: (row) => {
        setSelectedItem(row)
        setShowRejectForm(true)
      },
      variant: "destructive",
    },
  ]

  // Handle approve
  const handleApprove = (ids: string[]) => {
    console.log("Approving items:", ids)
    // API call would go here
    setSelectedRows(new Set())
    setSelectedItem(null)
  }

  // Handle reject
  const handleReject = (id: string, reason: string) => {
    console.log("Rejecting item:", id, "Reason:", reason)
    // API call would go here
    setSelectedItem(null)
    setShowRejectForm(false)
    setRejectReason("")
  }

  // Filter panel
  const filterPanel = (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium mb-3">Type</h3>
        <div className="space-y-2">
          {[
            { value: "all", label: "All Types" },
            { value: "quote", label: "Quotes" },
            { value: "expense", label: "Expenses" },
            { value: "change-order", label: "Change Orders" },
            { value: "invoice-adjustment", label: "Invoice Adjustments" },
          ].map((option) => (
            <label key={option.value} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="rounded border-border" />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-medium mb-3">Confidence Level</h3>
        <div className="space-y-2">
          <WebInput type="range" min="0" max="100" defaultValue="50" className="w-full" />
          <p className="text-xs text-muted-foreground text-center">Min: 50%</p>
        </div>
      </div>

      <div>
        <h3 className="font-medium mb-3">Amount Range</h3>
        <div className="space-y-2">
          <WebInput type="number" placeholder="Min amount" />
          <WebInput type="number" placeholder="Max amount" />
        </div>
      </div>

      <div>
        <h3 className="font-medium mb-3">SLA Status</h3>
        <div className="space-y-2">
          {[
            { value: "safe", label: "Safe" },
            { value: "warning", label: "Warning" },
            { value: "critical", label: "Critical" },
            { value: "breached", label: "Breached" },
          ].map((option) => (
            <label key={option.value} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="rounded border-border" />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <WebAppShell
      pageTitle="Approvals"
      userRole="OWNER"
      userName="Jane Doe"
      userEmail="jane@lawnflow.ai"
    >
      {/* Bulk Approval Action Bar */}
      {selectedRows.size > 0 && (
        <div className="sticky top-16 z-30 bg-success text-white px-6 py-4 flex items-center justify-between border-b border-white/20 shadow-[var(--elevation-2)]">
          <div className="flex items-center gap-4">
            <AlertCircle className="w-5 h-5" />
            <span className="font-semibold text-lg">{selectedRows.size} items selected for approval</span>
          </div>
          <div className="flex gap-3">
            <WebButton
              variant="secondary"
              size="md"
              onClick={() => setSelectedRows(new Set())}
            >
              Cancel
            </WebButton>
            <WebButton
              variant="ghost"
              size="md"
              className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              onClick={() => {
                if (window.confirm(`Reject ${selectedRows.size} items?`)) {
                  console.log("Bulk reject")
                  setSelectedRows(new Set())
                }
              }}
            >
              <X className="w-4 h-4 mr-2" />
              Bulk Reject
            </WebButton>
            <WebButton
              variant="ghost"
              size="md"
              className="bg-white text-success hover:bg-white/90 font-semibold"
              onClick={() => {
                handleApprove(Array.from(selectedRows))
              }}
            >
              <Check className="w-5 h-5 mr-2" />
              Approve All ({selectedRows.size})
            </WebButton>
          </div>
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
              <h2 className="text-lg font-semibold">
                {approvalItems.length} Items Pending Approval
              </h2>
              <p className="text-sm text-muted-foreground">
                Review and approve business requests
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
            </div>
          </div>

          <WebDataTable
            columns={columns}
            data={approvalItems}
            selectable
            selectedRows={selectedRows}
            onSelectionChange={setSelectedRows}
            onRowClick={(row) => setSelectedItem(row)}
            rowActions={rowActions}
            keyField="id"
          />
        </div>
      </WebFilteredListLayout>

      {/* Approval Detail Drawer */}
      <WebContextualDrawer
        open={!!selectedItem && !showRejectForm}
        onClose={() => setSelectedItem(null)}
        title={selectedItem?.title}
        description={`${selectedItem?.type.replace("-", " ")} • ${selectedItem?.submittedBy}`}
        size="lg"
        footer={
          selectedItem && (
            <div className="flex justify-between items-center">
              <WebButton variant="ghost" onClick={() => setSelectedItem(null)}>
                Close
              </WebButton>
              <div className="flex gap-2">
                <WebButton
                  variant="destructive"
                  onClick={() => setShowRejectForm(true)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Reject
                </WebButton>
                <WebButton
                  variant="primary"
                  onClick={() => handleApprove([selectedItem.id])}
                >
                  <Check className="w-4 h-4 mr-2" />
                  Approve
                </WebButton>
              </div>
            </div>
          )
        }
      >
        {selectedItem && !showRejectForm && (
          <div className="space-y-6">
            {/* Summary */}
            <div>
              <h3 className="font-semibold mb-3">Approval Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <WebBadge variant="status" status="primary" size="sm">
                    {selectedItem.type.replace("-", " ")}
                  </WebBadge>
                </div>
                {selectedItem.amount && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount:</span>
                    <span className="font-semibold text-lg">{selectedItem.amount}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Confidence Score:</span>
                  <div className="flex items-center gap-2">
                    <WebProgressBar value={selectedItem.confidence} size="sm" className="w-24" />
                    <span className="font-medium">{selectedItem.confidence}%</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SLA Status:</span>
                  <WebSLAIndicator
                    status={selectedItem.slaStatus}
                    timeRemaining={selectedItem.slaTimeRemaining}
                    showLabel
                    size="sm"
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Priority:</span>
                  <WebBadge variant="priority" priority={selectedItem.priority} size="sm">
                    {selectedItem.priority}
                  </WebBadge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Due Date:</span>
                  <span className="font-medium">{selectedItem.dueDate}</span>
                </div>
              </div>
            </div>

            {/* Request Details */}
            <div>
              <h3 className="font-semibold mb-3">Request Information</h3>
              <div className="space-y-2 text-sm">
                {selectedItem.requestDetails.customer && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer:</span>
                    <span className="font-medium">{selectedItem.requestDetails.customer}</span>
                  </div>
                )}
                {selectedItem.requestDetails.jobId && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Job ID:</span>
                    <span className="font-medium">{selectedItem.requestDetails.jobId}</span>
                  </div>
                )}
                {selectedItem.requestDetails.category && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Category:</span>
                    <span className="font-medium">{selectedItem.requestDetails.category}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
            </div>

            {/* Timeline */}
            <div>
              <h3 className="font-semibold mb-4">Activity Timeline</h3>
              <div>
                {selectedItem.timeline.map((event, index) => (
                  <TimelineItem
                    key={event.id}
                    title={event.title}
                    description={event.description}
                    timestamp={event.timestamp}
                    status={event.status}
                    showConnector={index < selectedItem.timeline.length - 1}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Reject Form */}
        {selectedItem && showRejectForm && (
          <div className="space-y-6">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-destructive mb-1">Reject Approval</h4>
                  <p className="text-sm text-muted-foreground">
                    Provide a reason for rejecting this request. This will be sent to the submitter.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block font-medium mb-2">Rejection Reason *</label>
              <WebTextarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this request is being rejected..."
                rows={6}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <WebButton
                variant="secondary"
                onClick={() => {
                  setShowRejectForm(false)
                  setRejectReason("")
                }}
              >
                Cancel
              </WebButton>
              <WebButton
                variant="destructive"
                onClick={() => handleReject(selectedItem.id, rejectReason)}
                disabled={!rejectReason.trim()}
              >
                <X className="w-4 h-4 mr-2" />
                Confirm Rejection
              </WebButton>
            </div>
          </div>
        )}
      </WebContextualDrawer>
    </WebAppShell>
  )
}