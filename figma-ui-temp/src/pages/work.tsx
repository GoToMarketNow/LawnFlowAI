import * as React from "react"
import { WebAppShell } from "../components/web/app-shell"
import { WebFilteredListLayout } from "../components/web/filtered-list-layout"
import { WebDataTable, DataTableColumn, DataTableAction } from "../components/web/data-table"
import { WebContextualDrawer } from "../components/web/contextual-drawer"
import { WebButton } from "../components/web/button"
import { WebBadge } from "../components/web/badge"
import { WebSLAIndicator } from "../components/web/sla-indicator"
import { TimelineItem } from "../components/web/timeline-item"
import { WebInput } from "../components/web/input"
import { WebSelect } from "../components/web/select"
import {
  Filter,
  Check,
  UserPlus,
  Eye,
  Trash2,
  MessageSquare,
  FileText,
  Clock,
  User,
} from "lucide-react"

interface WorkItem {
  id: string
  type: "quote" | "job" | "service-request" | "follow-up"
  title: string
  customer: string
  assignedTo?: string
  dueDate: string
  slaStatus: "safe" | "warning" | "critical" | "breached"
  slaTimeRemaining?: string
  priority: "high" | "medium" | "low"
  status: "pending" | "active" | "completed"
  description: string
  createdAt: string
  timeline: Array<{
    id: string
    title: string
    description: string
    timestamp: string
    status: "completed" | "active" | "pending"
  }>
}

export default function WorkPage() {
  const [selectedRows, setSelectedRows] = React.useState<Set<string>>(new Set())
  const [selectedItem, setSelectedItem] = React.useState<WorkItem | null>(null)
  const [showMobileFilters, setShowMobileFilters] = React.useState(false)
  const [filters, setFilters] = React.useState({
    type: "all",
    sla: "all",
    assigned: "all",
  })

  // Sample data
  const workItems: WorkItem[] = [
    {
      id: "1",
      type: "quote",
      title: "Spring Cleanup - Downtown Plaza",
      customer: "ABC Properties Inc.",
      assignedTo: "John Smith",
      dueDate: "2026-01-15",
      slaStatus: "warning",
      slaTimeRemaining: "2h remaining",
      priority: "high",
      status: "pending",
      description: "Commercial property requesting spring cleanup service including mulching and bed preparation.",
      createdAt: "2026-01-12 09:00",
      timeline: [
        {
          id: "1",
          title: "Quote requested",
          description: "Customer submitted quote request via web form",
          timestamp: "2 days ago",
          status: "completed",
        },
        {
          id: "2",
          title: "Site visit scheduled",
          description: "Scheduled for Jan 14 at 10:00 AM",
          timestamp: "1 day ago",
          status: "completed",
        },
        {
          id: "3",
          title: "Awaiting quote approval",
          description: "Quote sent to customer for review",
          timestamp: "4 hours ago",
          status: "active",
        },
      ],
    },
    {
      id: "2",
      type: "job",
      title: "Weekly Mowing - Residential",
      customer: "Sarah Johnson",
      dueDate: "2026-01-13",
      slaStatus: "breached",
      slaTimeRemaining: "1d overdue",
      priority: "high",
      status: "active",
      description: "Weekly mowing service needs crew assignment for this week.",
      createdAt: "2026-01-10 14:30",
      timeline: [
        {
          id: "1",
          title: "Job created",
          description: "Recurring service job auto-created",
          timestamp: "2 days ago",
          status: "completed",
        },
        {
          id: "2",
          title: "Awaiting assignment",
          description: "Needs crew assignment for this week",
          timestamp: "2 days ago",
          status: "active",
        },
      ],
    },
    {
      id: "3",
      type: "service-request",
      title: "Emergency Tree Removal",
      customer: "Mike Wilson",
      assignedTo: "Tree Team",
      dueDate: "2026-01-12",
      slaStatus: "safe",
      slaTimeRemaining: "4h remaining",
      priority: "high",
      status: "active",
      description: "Emergency request for fallen tree removal after storm.",
      createdAt: "2026-01-12 06:00",
      timeline: [
        {
          id: "1",
          title: "Service request received",
          description: "Emergency call logged",
          timestamp: "6 hours ago",
          status: "completed",
        },
        {
          id: "2",
          title: "Crew dispatched",
          description: "Tree Team assigned and en route",
          timestamp: "5 hours ago",
          status: "completed",
        },
        {
          id: "3",
          title: "Work in progress",
          description: "Crew on site working",
          timestamp: "3 hours ago",
          status: "active",
        },
      ],
    },
    {
      id: "4",
      type: "follow-up",
      title: "Quote Follow-up - Landscaping Project",
      customer: "Green Valley HOA",
      assignedTo: "Sales Team",
      dueDate: "2026-01-14",
      slaStatus: "safe",
      priority: "medium",
      status: "pending",
      description: "Follow up on $15k landscaping proposal sent 5 days ago.",
      createdAt: "2026-01-07 11:00",
      timeline: [
        {
          id: "1",
          title: "Quote sent",
          description: "Comprehensive landscaping proposal delivered",
          timestamp: "5 days ago",
          status: "completed",
        },
        {
          id: "2",
          title: "Follow-up scheduled",
          description: "Scheduled to call customer",
          timestamp: "2 days ago",
          status: "pending",
        },
      ],
    },
    {
      id: "5",
      type: "job",
      title: "Fertilization Service - Multiple Properties",
      customer: "Park Management Co.",
      assignedTo: "Lawn Care Team",
      dueDate: "2026-01-16",
      slaStatus: "safe",
      priority: "low",
      status: "pending",
      description: "Scheduled fertilization for 8 properties in the district.",
      createdAt: "2026-01-08 09:30",
      timeline: [
        {
          id: "1",
          title: "Service scheduled",
          description: "Customer booked recurring fertilization",
          timestamp: "4 days ago",
          status: "completed",
        },
        {
          id: "2",
          title: "Materials ordered",
          description: "Fertilizer and supplies ordered",
          timestamp: "3 days ago",
          status: "completed",
        },
        {
          id: "3",
          title: "Ready for execution",
          description: "All materials received, ready to start",
          timestamp: "1 day ago",
          status: "pending",
        },
      ],
    },
  ]

  // Table columns
  const columns: DataTableColumn<WorkItem>[] = [
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
      width: "140px",
      render: (_, row) => {
        const typeLabels = {
          quote: "Quote",
          job: "Job",
          "service-request": "Service Request",
          "follow-up": "Follow-up",
        }
        const typeVariants = {
          quote: "primary" as const,
          job: "success" as const,
          "service-request": "warning" as const,
          "follow-up": "neutral" as const,
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
            Created {row.createdAt}
          </div>
        </div>
      ),
    },
    {
      id: "customer",
      header: "Customer",
      accessor: "customer",
      sortable: true,
      width: "200px",
      render: (value) => (
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-muted-foreground" />
          <span>{value}</span>
        </div>
      ),
    },
    {
      id: "assigned",
      header: "Assigned",
      width: "150px",
      render: (_, row) =>
        row.assignedTo ? (
          <span className="text-sm">{row.assignedTo}</span>
        ) : (
          <span className="text-sm text-muted-foreground italic">Unassigned</span>
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
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">{value}</span>
        </div>
      ),
    },
  ]

  // Row actions
  const rowActions: DataTableAction<WorkItem>[] = [
    {
      id: "view",
      label: "View Details",
      icon: <Eye className="w-4 h-4" />,
      onClick: (row) => setSelectedItem(row),
    },
    {
      id: "assign",
      label: "Assign",
      icon: <UserPlus className="w-4 h-4" />,
      onClick: (row) => console.log("Assign", row),
    },
    {
      id: "delete",
      label: "Delete",
      icon: <Trash2 className="w-4 h-4" />,
      onClick: (row) => console.log("Delete", row),
      variant: "destructive",
    },
  ]

  // Filter panel
  const filterPanel = (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium mb-3">Type</h3>
        <div className="space-y-2">
          {[
            { value: "all", label: "All Types" },
            { value: "quote", label: "Quotes" },
            { value: "job", label: "Jobs" },
            { value: "service-request", label: "Service Requests" },
            { value: "follow-up", label: "Follow-ups" },
          ].map((option) => (
            <label key={option.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="type"
                value={option.value}
                checked={filters.type === option.value}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                className="rounded-full border-border"
              />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-medium mb-3">SLA Status</h3>
        <div className="space-y-2">
          {[
            { value: "all", label: "All" },
            { value: "safe", label: "Safe" },
            { value: "warning", label: "Warning" },
            { value: "critical", label: "Critical" },
            { value: "breached", label: "Breached" },
          ].map((option) => (
            <label key={option.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-border"
              />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-medium mb-3">Assignment</h3>
        <WebSelect
          options={[
            { value: "all", label: "All" },
            { value: "assigned", label: "Assigned" },
            { value: "unassigned", label: "Unassigned" },
          ]}
        />
      </div>

      <div>
        <h3 className="font-medium mb-3">Date Range</h3>
        <div className="space-y-2">
          <WebInput type="date" placeholder="From" />
          <WebInput type="date" placeholder="To" />
        </div>
      </div>
    </div>
  )

  // Get primary action for drawer
  const getPrimaryAction = (item: WorkItem) => {
    switch (item.type) {
      case "quote":
        return { label: "Approve Quote", icon: <Check className="w-4 h-4" /> }
      case "job":
        return { label: "Assign Crew", icon: <UserPlus className="w-4 h-4" /> }
      case "service-request":
        return { label: "Resolve", icon: <Check className="w-4 h-4" /> }
      case "follow-up":
        return { label: "Mark Complete", icon: <Check className="w-4 h-4" /> }
    }
  }

  return (
    <WebAppShell
      pageTitle="Work Queue"
      userRole="ADMIN"
      userName="John Smith"
      userEmail="john@lawnflow.ai"
    >
      {/* Bulk Action Bar */}
      {selectedRows.size > 0 && (
        <div className="sticky top-16 z-30 bg-primary text-primary-foreground px-6 py-3 flex items-center justify-between border-b border-primary-foreground/20">
          <div className="flex items-center gap-4">
            <span className="font-medium">{selectedRows.size} items selected</span>
            <div className="flex gap-2">
              <WebButton variant="secondary" size="sm">
                <UserPlus className="w-4 h-4 mr-2" />
                Bulk Assign
              </WebButton>
              <WebButton variant="secondary" size="sm">
                <Check className="w-4 h-4 mr-2" />
                Bulk Approve
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
              <h2 className="text-lg font-semibold">
                {workItems.length} Items
              </h2>
              <p className="text-sm text-muted-foreground">
                Manage quotes, jobs, and service requests
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
                Create New
              </WebButton>
            </div>
          </div>

          <WebDataTable
            columns={columns}
            data={workItems}
            selectable
            selectedRows={selectedRows}
            onSelectionChange={setSelectedRows}
            onRowClick={(row) => setSelectedItem(row)}
            rowActions={rowActions}
            keyField="id"
          />
        </div>
      </WebFilteredListLayout>

      {/* Item Detail Drawer */}
      <WebContextualDrawer
        open={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title={selectedItem?.title}
        description={selectedItem?.customer}
        size="lg"
        footer={
          selectedItem && (
            <div className="flex justify-between items-center">
              <WebButton
                variant="ghost"
                onClick={() => setSelectedItem(null)}
              >
                Close
              </WebButton>
              <div className="flex gap-2">
                <WebButton variant="secondary">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Add Note
                </WebButton>
                <WebButton variant="primary">
                  {getPrimaryAction(selectedItem).icon}
                  <span className="ml-2">{getPrimaryAction(selectedItem).label}</span>
                </WebButton>
              </div>
            </div>
          )
        }
      >
        {selectedItem && (
          <div className="space-y-6">
            {/* Summary */}
            <div>
              <h3 className="font-semibold mb-3">Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <WebBadge variant="status" status="primary" size="sm">
                    {selectedItem.type.replace("-", " ")}
                  </WebBadge>
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
                  <span className="text-muted-foreground">Assigned:</span>
                  <span className="font-medium">
                    {selectedItem.assignedTo || "Unassigned"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Due Date:</span>
                  <span className="font-medium">{selectedItem.dueDate}</span>
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-sm text-muted-foreground">
                {selectedItem.description}
              </p>
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
      </WebContextualDrawer>
    </WebAppShell>
  )
}