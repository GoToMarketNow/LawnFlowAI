import * as React from "react"
import { WebAppShell } from "../components/web/app-shell"
import { WebTabbedLayout } from "../components/web/tabbed-layout"
import { WebDataTable, DataTableColumn, DataTableAction } from "../components/web/data-table"
import { WebContextualDrawer } from "../components/web/contextual-drawer"
import { WebButton } from "../components/web/button"
import { WebBadge } from "../components/web/badge"
import { WebStatusIndicator } from "../components/web/status-indicator"
import { TimelineItem } from "../components/web/timeline-item"
import { WebCrewRecommendationCard, CrewRecommendation } from "../components/web/crew-recommendation"
import { WebModal } from "../components/web/modal"
import {
  Eye,
  Edit,
  X,
  Users,
  Mail,
  Phone,
  MapPin,
  Calendar,
  DollarSign,
  FileText,
  AlertCircle,
  CheckCircle,
} from "lucide-react"

type JobStatus = "new" | "assigned" | "in-progress" | "completed" | "paid" | "cancelled"

interface Job {
  id: string
  jobId: string
  customer: {
    name: string
    email: string
    phone: string
    address: string
  }
  service: string
  serviceType: "mowing" | "landscaping" | "fertilization" | "cleanup" | "other"
  crew?: string
  date: string
  scheduledTime?: string
  status: JobStatus
  amount: string
  priority: "high" | "medium" | "low"
  notes?: string
  propertySize?: string
  estimatedDuration?: string
  specialInstructions?: string
  timeline: Array<{
    id: string
    title: string
    description: string
    timestamp: string
    status: "completed" | "active" | "pending"
  }>
}

export default function JobsPage() {
  const [selectedJob, setSelectedJob] = React.useState<Job | null>(null)
  const [selectedCrew, setSelectedCrew] = React.useState<string | null>(null)
  const [showAssignModal, setShowAssignModal] = React.useState(false)
  const [showCancelModal, setShowCancelModal] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState("all")

  // Sample job data
  const allJobs: Job[] = [
    {
      id: "1",
      jobId: "J-2024-1234",
      customer: {
        name: "ABC Properties Inc.",
        email: "contact@abcproperties.com",
        phone: "(555) 123-4567",
        address: "123 Business Park Dr, Suite 100",
      },
      service: "Weekly Lawn Maintenance",
      serviceType: "mowing",
      crew: "Crew Alpha",
      date: "2026-01-15",
      scheduledTime: "09:00 AM",
      status: "in-progress",
      amount: "$450",
      priority: "high",
      propertySize: "2.5 acres",
      estimatedDuration: "3 hours",
      notes: "Commercial property with multiple buildings",
      timeline: [
        {
          id: "1",
          title: "Job created",
          description: "Recurring service scheduled",
          timestamp: "3 days ago",
          status: "completed",
        },
        {
          id: "2",
          title: "Crew assigned",
          description: "Crew Alpha assigned to job",
          timestamp: "2 days ago",
          status: "completed",
        },
        {
          id: "3",
          title: "Job started",
          description: "Crew arrived on site",
          timestamp: "2 hours ago",
          status: "active",
        },
      ],
    },
    {
      id: "2",
      jobId: "J-2024-1235",
      customer: {
        name: "Sarah Johnson",
        email: "sarah.j@email.com",
        phone: "(555) 234-5678",
        address: "456 Maple Avenue",
      },
      service: "Spring Cleanup",
      serviceType: "cleanup",
      date: "2026-01-16",
      scheduledTime: "10:00 AM",
      status: "new",
      amount: "$280",
      priority: "medium",
      propertySize: "0.5 acres",
      estimatedDuration: "2 hours",
      specialInstructions: "Please avoid flower beds near front entrance",
      timeline: [
        {
          id: "1",
          title: "Job requested",
          description: "Customer requested spring cleanup service",
          timestamp: "1 day ago",
          status: "completed",
        },
        {
          id: "2",
          title: "Quote approved",
          description: "Customer approved $280 quote",
          timestamp: "4 hours ago",
          status: "completed",
        },
        {
          id: "3",
          title: "Awaiting crew assignment",
          description: "Pending crew assignment",
          timestamp: "4 hours ago",
          status: "active",
        },
      ],
    },
    {
      id: "3",
      jobId: "J-2024-1236",
      customer: {
        name: "Green Valley HOA",
        email: "board@greenvalleyhoa.org",
        phone: "(555) 345-6789",
        address: "789 Valley Road",
      },
      service: "Common Area Maintenance",
      serviceType: "mowing",
      crew: "Crew Beta",
      date: "2026-01-15",
      scheduledTime: "08:00 AM",
      status: "assigned",
      amount: "$650",
      priority: "high",
      propertySize: "5 acres",
      estimatedDuration: "4 hours",
      notes: "Multiple common areas and entrance landscaping",
      timeline: [
        {
          id: "1",
          title: "Job scheduled",
          description: "Weekly maintenance scheduled",
          timestamp: "1 week ago",
          status: "completed",
        },
        {
          id: "2",
          title: "Crew assigned",
          description: "Crew Beta assigned to job",
          timestamp: "1 day ago",
          status: "completed",
        },
        {
          id: "3",
          title: "Scheduled for tomorrow",
          description: "Job starts at 8:00 AM",
          timestamp: "1 day ago",
          status: "pending",
        },
      ],
    },
    {
      id: "4",
      jobId: "J-2024-1237",
      customer: {
        name: "Mike Wilson",
        email: "mike.wilson@email.com",
        phone: "(555) 456-7890",
        address: "321 Oak Street",
      },
      service: "Fertilization Treatment",
      serviceType: "fertilization",
      crew: "Crew Charlie",
      date: "2026-01-10",
      scheduledTime: "02:00 PM",
      status: "completed",
      amount: "$180",
      priority: "low",
      propertySize: "0.3 acres",
      estimatedDuration: "1 hour",
      timeline: [
        {
          id: "1",
          title: "Job created",
          description: "Seasonal fertilization scheduled",
          timestamp: "1 week ago",
          status: "completed",
        },
        {
          id: "2",
          title: "Crew assigned",
          description: "Crew Charlie assigned",
          timestamp: "5 days ago",
          status: "completed",
        },
        {
          id: "3",
          title: "Job completed",
          description: "Service completed successfully",
          timestamp: "2 days ago",
          status: "completed",
        },
      ],
    },
    {
      id: "5",
      jobId: "J-2024-1238",
      customer: {
        name: "Park Management Co.",
        email: "info@parkmanagement.com",
        phone: "(555) 567-8901",
        address: "654 Corporate Blvd",
      },
      service: "Landscape Installation",
      serviceType: "landscaping",
      crew: "Crew Alpha",
      date: "2026-01-08",
      scheduledTime: "07:00 AM",
      status: "paid",
      amount: "$3,200",
      priority: "high",
      propertySize: "1 acre",
      estimatedDuration: "8 hours",
      notes: "New mulch beds and seasonal plantings",
      timeline: [
        {
          id: "1",
          title: "Quote approved",
          description: "Customer approved landscape design",
          timestamp: "2 weeks ago",
          status: "completed",
        },
        {
          id: "2",
          title: "Job completed",
          description: "Installation completed",
          timestamp: "4 days ago",
          status: "completed",
        },
        {
          id: "3",
          title: "Payment received",
          description: "Invoice paid in full",
          timestamp: "1 day ago",
          status: "completed",
        },
      ],
    },
    {
      id: "6",
      jobId: "J-2024-1239",
      customer: {
        name: "Martinez Family",
        email: "martinez@email.com",
        phone: "(555) 678-9012",
        address: "987 Pine Lane",
      },
      service: "Bi-weekly Mowing",
      serviceType: "mowing",
      date: "2026-01-17",
      scheduledTime: "01:00 PM",
      status: "new",
      amount: "$120",
      priority: "medium",
      propertySize: "0.4 acres",
      estimatedDuration: "1.5 hours",
      timeline: [
        {
          id: "1",
          title: "Job created",
          description: "Recurring service scheduled",
          timestamp: "6 hours ago",
          status: "completed",
        },
        {
          id: "2",
          title: "Pending assignment",
          description: "Awaiting crew assignment",
          timestamp: "6 hours ago",
          status: "active",
        },
      ],
    },
  ]

  // Crew recommendations
  const crewRecommendations: CrewRecommendation[] = [
    {
      id: "crew-alpha",
      name: "Crew Alpha",
      members: ["John Smith", "Mike Johnson"],
      score: 95,
      matchReasons: ["Service expertise", "Availability", "Proximity"],
      travelTime: "12 min",
      currentLocation: "Downtown area",
      estimatedArrival: "10:45 AM",
      availability: "available",
    },
    {
      id: "crew-beta",
      name: "Crew Beta",
      members: ["Sarah Williams", "Tom Anderson"],
      score: 88,
      matchReasons: ["Equipment match", "Customer history"],
      travelTime: "18 min",
      currentLocation: "Westside",
      estimatedArrival: "11:00 AM",
      availability: "available",
    },
    {
      id: "crew-charlie",
      name: "Crew Charlie",
      members: ["Lisa Chen", "David Martinez"],
      score: 82,
      matchReasons: ["Availability", "Experience"],
      travelTime: "25 min",
      currentLocation: "Eastside",
      estimatedArrival: "11:15 AM",
      availability: "limited",
    },
    {
      id: "crew-delta",
      name: "Crew Delta",
      members: ["Robert Taylor", "Emily Davis"],
      score: 65,
      matchReasons: ["Experience"],
      travelTime: "35 min",
      currentLocation: "Northside",
      availability: "unavailable",
    },
  ]

  // Filter jobs by status
  const getFilteredJobs = (status: string) => {
    if (status === "all") return allJobs
    return allJobs.filter((job) => job.status === status)
  }

  // Table columns
  const columns: DataTableColumn<Job>[] = [
    {
      id: "jobId",
      header: "Job ID",
      accessor: "jobId",
      width: "120px",
      render: (value) => <span className="font-mono text-sm font-medium">{value}</span>,
    },
    {
      id: "customer",
      header: "Customer",
      accessor: "customer",
      sortable: true,
      render: (value) => (
        <div>
          <div className="font-medium text-foreground">{value.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{value.address}</div>
        </div>
      ),
    },
    {
      id: "service",
      header: "Service",
      accessor: "service",
      render: (value, row) => (
        <div>
          <div className="font-medium text-sm">{value}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {row.propertySize && `${row.propertySize} • `}
            {row.estimatedDuration}
          </div>
        </div>
      ),
    },
    {
      id: "crew",
      header: "Crew",
      width: "140px",
      render: (_, row) =>
        row.crew ? (
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{row.crew}</span>
          </div>
        ) : (
          <WebBadge variant="status" status="neutral" size="sm">
            Unassigned
          </WebBadge>
        ),
    },
    {
      id: "date",
      header: "Date",
      accessor: "date",
      sortable: true,
      width: "140px",
      render: (value, row) => (
        <div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-muted-foreground" />
            <span className="text-sm">{value}</span>
          </div>
          {row.scheduledTime && (
            <div className="text-xs text-muted-foreground mt-0.5">{row.scheduledTime}</div>
          )}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      width: "130px",
      render: (_, row) => {
        const statusConfig: Record<JobStatus, { label: string; status: any }> = {
          new: { label: "New", status: "pending" },
          assigned: { label: "Assigned", status: "primary" },
          "in-progress": { label: "In Progress", status: "active" },
          completed: { label: "Completed", status: "success" },
          paid: { label: "Paid", status: "success" },
          cancelled: { label: "Cancelled", status: "destructive" },
        }
        const config = statusConfig[row.status]
        return (
          <WebBadge variant="status" status={config.status} size="sm">
            {config.label}
          </WebBadge>
        )
      },
    },
    {
      id: "amount",
      header: "Amount",
      width: "100px",
      align: "right",
      render: (_, row) => <span className="font-semibold">{row.amount}</span>,
    },
  ]

  // Row actions
  const rowActions: DataTableAction<Job>[] = [
    {
      id: "view",
      label: "View Details",
      icon: <Eye className="w-4 h-4" />,
      onClick: (row) => setSelectedJob(row),
    },
    {
      id: "assign",
      label: "Assign Crew",
      icon: <Users className="w-4 h-4" />,
      onClick: (row) => {
        setSelectedJob(row)
        setShowAssignModal(true)
      },
      hidden: (row) => row.status === "completed" || row.status === "paid" || row.status === "cancelled",
    },
    {
      id: "edit",
      label: "Edit",
      icon: <Edit className="w-4 h-4" />,
      onClick: (row) => console.log("Edit job", row.jobId),
      hidden: (row) => row.status === "completed" || row.status === "paid",
    },
    {
      id: "cancel",
      label: "Cancel Job",
      icon: <X className="w-4 h-4" />,
      onClick: (row) => {
        setSelectedJob(row)
        setShowCancelModal(true)
      },
      variant: "destructive",
      hidden: (row) => row.status === "completed" || row.status === "paid" || row.status === "cancelled",
    },
  ]

  // Create tabs
  const tabs = [
    {
      id: "all",
      label: "All Jobs",
      badge: allJobs.length,
      content: (
        <div className="p-6">
          <WebDataTable
            columns={columns}
            data={getFilteredJobs("all")}
            onRowClick={(row) => setSelectedJob(row)}
            rowActions={rowActions}
            keyField="id"
          />
        </div>
      ),
    },
    {
      id: "new",
      label: "New",
      badge: getFilteredJobs("new").length,
      content: (
        <div className="p-6">
          <WebDataTable
            columns={columns}
            data={getFilteredJobs("new")}
            onRowClick={(row) => setSelectedJob(row)}
            rowActions={rowActions}
            keyField="id"
          />
        </div>
      ),
    },
    {
      id: "assigned",
      label: "Assigned",
      badge: getFilteredJobs("assigned").length,
      content: (
        <div className="p-6">
          <WebDataTable
            columns={columns}
            data={getFilteredJobs("assigned")}
            onRowClick={(row) => setSelectedJob(row)}
            rowActions={rowActions}
            keyField="id"
          />
        </div>
      ),
    },
    {
      id: "in-progress",
      label: "In Progress",
      badge: getFilteredJobs("in-progress").length,
      content: (
        <div className="p-6">
          <WebDataTable
            columns={columns}
            data={getFilteredJobs("in-progress")}
            onRowClick={(row) => setSelectedJob(row)}
            rowActions={rowActions}
            keyField="id"
          />
        </div>
      ),
    },
    {
      id: "completed",
      label: "Completed",
      badge: getFilteredJobs("completed").length,
      content: (
        <div className="p-6">
          <WebDataTable
            columns={columns}
            data={getFilteredJobs("completed")}
            onRowClick={(row) => setSelectedJob(row)}
            rowActions={rowActions}
            keyField="id"
          />
        </div>
      ),
    },
    {
      id: "paid",
      label: "Paid",
      badge: getFilteredJobs("paid").length,
      content: (
        <div className="p-6">
          <WebDataTable
            columns={columns}
            data={getFilteredJobs("paid")}
            onRowClick={(row) => setSelectedJob(row)}
            rowActions={rowActions}
            keyField="id"
          />
        </div>
      ),
    },
  ]

  const handleAssignCrew = () => {
    if (selectedCrew) {
      console.log("Assigning crew", selectedCrew, "to job", selectedJob?.jobId)
      setShowAssignModal(false)
      setSelectedCrew(null)
      setSelectedJob(null)
    }
  }

  const handleCancelJob = () => {
    console.log("Cancelling job", selectedJob?.jobId)
    setShowCancelModal(false)
    setSelectedJob(null)
  }

  return (
    <WebAppShell
      pageTitle="Jobs"
      userRole="ADMIN"
      userName="John Smith"
      userEmail="john@lawnflow.ai"
    >
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold mb-2">Jobs</h2>
            <p className="text-muted-foreground">Manage and schedule service jobs</p>
          </div>
          <WebButton variant="primary">Create New Job</WebButton>
        </div>

        {/* Tabbed Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <WebTabbedLayout tabs={tabs} defaultTab="all" onTabChange={setActiveTab} />
        </div>
      </div>

      {/* Job Detail Drawer */}
      <WebContextualDrawer
        open={!!selectedJob && !showAssignModal}
        onClose={() => setSelectedJob(null)}
        title={selectedJob?.jobId}
        description={selectedJob?.service}
        size="lg"
        footer={
          selectedJob && (
            <div className="flex justify-between items-center">
              <WebButton variant="ghost" onClick={() => setSelectedJob(null)}>
                Close
              </WebButton>
              <div className="flex gap-2">
                {selectedJob.status !== "completed" &&
                  selectedJob.status !== "paid" &&
                  selectedJob.status !== "cancelled" && (
                    <>
                      <WebButton
                        variant="destructive"
                        onClick={() => setShowCancelModal(true)}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Cancel Job
                      </WebButton>
                      <WebButton variant="secondary" onClick={() => console.log("Edit job")}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </WebButton>
                      <WebButton
                        variant="primary"
                        onClick={() => setShowAssignModal(true)}
                      >
                        <Users className="w-4 h-4 mr-2" />
                        {selectedJob.crew ? "Reassign" : "Assign"} Crew
                      </WebButton>
                    </>
                  )}
              </div>
            </div>
          )
        }
      >
        {selectedJob && (
          <div className="space-y-6">
            {/* Customer Info */}
            <div>
              <h3 className="font-semibold mb-3">Customer Information</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <Users className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs">Customer</p>
                    <p className="font-medium text-foreground">{selectedJob.customer.name}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs">Email</p>
                    <a
                      href={`mailto:${selectedJob.customer.email}`}
                      className="text-primary hover:underline"
                    >
                      {selectedJob.customer.email}
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs">Phone</p>
                    <a
                      href={`tel:${selectedJob.customer.phone}`}
                      className="text-primary hover:underline"
                    >
                      {selectedJob.customer.phone}
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-xs">Service Address</p>
                    <p className="text-foreground">{selectedJob.customer.address}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Job Details */}
            <div>
              <h3 className="font-semibold mb-3">Job Details</h3>
              <div className="bg-muted/50 rounded-lg p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Service</span>
                  <span className="font-medium">{selectedJob.service}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Scheduled Date & Time</span>
                  <span className="font-medium">
                    {selectedJob.date} {selectedJob.scheduledTime && `at ${selectedJob.scheduledTime}`}
                  </span>
                </div>
                {selectedJob.crew && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Assigned Crew</span>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{selectedJob.crew}</span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <WebBadge variant="status" status="active" size="sm">
                    {selectedJob.status}
                  </WebBadge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Priority</span>
                  <WebBadge variant="priority" priority={selectedJob.priority} size="sm">
                    {selectedJob.priority}
                  </WebBadge>
                </div>
                {selectedJob.propertySize && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Property Size</span>
                    <span className="font-medium">{selectedJob.propertySize}</span>
                  </div>
                )}
                {selectedJob.estimatedDuration && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estimated Duration</span>
                    <span className="font-medium">{selectedJob.estimatedDuration}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="text-muted-foreground font-medium">Job Amount</span>
                  <span className="text-lg font-semibold">{selectedJob.amount}</span>
                </div>
              </div>
            </div>

            {/* Notes & Instructions */}
            {(selectedJob.notes || selectedJob.specialInstructions) && (
              <div>
                <h3 className="font-semibold mb-3">Notes & Instructions</h3>
                <div className="space-y-2">
                  {selectedJob.notes && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Job Notes</p>
                      <p className="text-sm text-foreground">{selectedJob.notes}</p>
                    </div>
                  )}
                  {selectedJob.specialInstructions && (
                    <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
                      <p className="text-xs text-warning mb-1 font-medium flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Special Instructions
                      </p>
                      <p className="text-sm text-foreground">{selectedJob.specialInstructions}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div>
              <h3 className="font-semibold mb-4">Job Timeline</h3>
              <div>
                {selectedJob.timeline.map((event, index) => (
                  <TimelineItem
                    key={event.id}
                    title={event.title}
                    description={event.description}
                    timestamp={event.timestamp}
                    status={event.status}
                    showConnector={index < selectedJob.timeline.length - 1}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </WebContextualDrawer>

      {/* Assign Crew Modal */}
      <WebModal
        open={showAssignModal}
        onClose={() => {
          setShowAssignModal(false)
          setSelectedCrew(null)
        }}
        title="Assign Crew"
        description={`Select a crew for ${selectedJob?.jobId}`}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <WebButton
              variant="secondary"
              onClick={() => {
                setShowAssignModal(false)
                setSelectedCrew(null)
              }}
            >
              Cancel
            </WebButton>
            <WebButton
              variant="primary"
              onClick={handleAssignCrew}
              disabled={!selectedCrew}
            >
              <Users className="w-4 h-4 mr-2" />
              Assign Crew
            </WebButton>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Job Summary */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-semibold mb-2">Job Details</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Service</p>
                <p className="font-medium">{selectedJob?.service}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Date & Time</p>
                <p className="font-medium">
                  {selectedJob?.date} {selectedJob?.scheduledTime}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Location</p>
                <p className="font-medium">{selectedJob?.customer.address}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Duration</p>
                <p className="font-medium">{selectedJob?.estimatedDuration}</p>
              </div>
            </div>
          </div>

          {/* Crew Recommendations */}
          <div>
            <h4 className="font-semibold mb-3">Recommended Crews</h4>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {crewRecommendations.map((crew, index) => (
                <WebCrewRecommendationCard
                  key={crew.id}
                  crew={crew}
                  rank={index + 1}
                  isSelected={selectedCrew === crew.id}
                  onSelect={() => setSelectedCrew(crew.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </WebModal>

      {/* Cancel Job Modal */}
      <WebModal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel Job"
        description="Are you sure you want to cancel this job?"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <WebButton variant="secondary" onClick={() => setShowCancelModal(false)}>
              Keep Job
            </WebButton>
            <WebButton variant="destructive" onClick={handleCancelJob}>
              <X className="w-4 h-4 mr-2" />
              Cancel Job
            </WebButton>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-destructive mb-1">Warning</h4>
                <p className="text-sm text-muted-foreground">
                  Cancelling this job will notify the customer and remove it from the schedule.
                  This action cannot be undone.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-sm">
            <p className="font-semibold mb-2">Job: {selectedJob?.jobId}</p>
            <p className="text-muted-foreground">Customer: {selectedJob?.customer.name}</p>
            <p className="text-muted-foreground">Service: {selectedJob?.service}</p>
            <p className="text-muted-foreground">
              Scheduled: {selectedJob?.date} {selectedJob?.scheduledTime}
            </p>
          </div>
        </div>
      </WebModal>
    </WebAppShell>
  )
}
