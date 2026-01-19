import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { useLocation } from "wouter"
import { AuthenticatedWebAppShell } from "@/components/web/authenticated-shell"
import { WebPageHeader } from "@/components/web/page-header"
import { WebDataTable, DataTableColumn, DataTableAction } from "@/components/web/data-table"
import { WebTabbedLayout, Tab } from "@/components/web/tabbed-layout"
import { WebBadge } from "@/components/web/badge"
import { WebContextualDrawer } from "@/components/web/contextual-drawer"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import {
  Eye,
  Edit,
  Users,
  Phone,
  MapPin,
  Calendar,
  Plus,
} from "lucide-react"

// Types matching the API schema
interface Job {
  id: number
  conversationId?: number
  businessId?: number
  customerName: string
  customerPhone: string
  customerAddress?: string
  serviceType: string
  scheduledDate?: string
  estimatedPrice?: number
  status: string
  notes?: string
  customerNotes?: string
  accessInstructions?: string
  whatWereDoing?: string
  timeWindow?: string
  createdAt: string
  updatedAt: string
}

function formatCurrency(cents: number | undefined): string {
  if (!cents) return "-"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(cents / 100)
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return "-"
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function getStatusBadgeVariant(status: string): "pending" | "active" | "completed" | "cancelled" {
  switch (status) {
    case "completed":
      return "completed"
    case "in_progress":
    case "scheduled":
      return "active"
    case "cancelled":
      return "cancelled"
    default:
      return "pending"
  }
}

function JobsDataTable({
  jobs,
  onRowClick,
  emptyMessage
}: {
  jobs: Job[]
  onRowClick: (job: Job) => void
  emptyMessage: string
}) {
  // Table columns
  const columns: DataTableColumn<Job>[] = [
    {
      id: "id",
      header: "Job ID",
      accessor: (job) => `J-${job.id}`,
      width: "100px",
      render: (value) => <span className="font-mono text-sm font-medium">{value}</span>,
    },
    {
      id: "customer",
      header: "Customer",
      accessor: "customerName",
      sortable: true,
      render: (_, job) => (
        <div>
          <div className="font-medium text-foreground">{job.customerName}</div>
          {job.customerAddress && (
            <div className="text-xs text-muted-foreground mt-0.5">{job.customerAddress}</div>
          )}
        </div>
      ),
    },
    {
      id: "service",
      header: "Service",
      accessor: "serviceType",
      sortable: true,
    },
    {
      id: "scheduledDate",
      header: "Date",
      accessor: (job) => formatDate(job.scheduledDate),
      sortable: true,
    },
    {
      id: "amount",
      header: "Amount",
      accessor: (job) => formatCurrency(job.estimatedPrice),
      align: "right",
    },
    {
      id: "status",
      header: "Status",
      accessor: "status",
      sortable: true,
      render: (value) => (
        <WebBadge variant="status" status={getStatusBadgeVariant(value as string)}>
          {(value as string).replace("_", " ")}
        </WebBadge>
      ),
    },
  ]

  // Row actions
  const actions: DataTableAction<Job>[] = [
    {
      id: "view",
      label: "View Details",
      icon: <Eye className="w-4 h-4" />,
      onClick: onRowClick,
    },
    {
      id: "edit",
      label: "Edit Job",
      icon: <Edit className="w-4 h-4" />,
      onClick: (job) => console.log("Edit job", job.id),
    },
  ]

  return (
    <WebDataTable
      columns={columns}
      data={jobs}
      actions={actions}
      searchable
      searchPlaceholder="Search jobs..."
      onRowClick={onRowClick}
      emptyState={{
        title: "No jobs found",
        description: emptyMessage,
      }}
    />
  )
}

export default function FigmaJobsPage() {
  const [, setLocation] = useLocation()
  const [selectedJob, setSelectedJob] = React.useState<Job | null>(null)

  // Fetch jobs from API
  const { data: jobs, isLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    staleTime: 30000,
  })

  // Filter jobs by status
  const getFilteredJobs = (status: string): Job[] => {
    if (!jobs) return []
    if (status === "all") return jobs
    return jobs.filter((job) => job.status === status)
  }

  // Get counts for tabs
  const getCounts = () => {
    if (!jobs) return { all: 0, pending: 0, scheduled: 0, in_progress: 0, completed: 0 }
    return {
      all: jobs.length,
      pending: jobs.filter((j) => j.status === "pending").length,
      scheduled: jobs.filter((j) => j.status === "scheduled").length,
      in_progress: jobs.filter((j) => j.status === "in_progress").length,
      completed: jobs.filter((j) => j.status === "completed").length,
    }
  }

  const counts = getCounts()

  // Tab configuration with content
  const tabs: Tab[] = [
    {
      id: "all",
      label: "All Jobs",
      badge: counts.all,
      content: <JobsDataTable jobs={getFilteredJobs("all")} onRowClick={setSelectedJob} emptyMessage="Create your first job to get started" />
    },
    {
      id: "pending",
      label: "Pending",
      badge: counts.pending,
      content: <JobsDataTable jobs={getFilteredJobs("pending")} onRowClick={setSelectedJob} emptyMessage="No pending jobs" />
    },
    {
      id: "scheduled",
      label: "Scheduled",
      badge: counts.scheduled,
      content: <JobsDataTable jobs={getFilteredJobs("scheduled")} onRowClick={setSelectedJob} emptyMessage="No scheduled jobs" />
    },
    {
      id: "in_progress",
      label: "In Progress",
      badge: counts.in_progress,
      content: <JobsDataTable jobs={getFilteredJobs("in_progress")} onRowClick={setSelectedJob} emptyMessage="No jobs in progress" />
    },
    {
      id: "completed",
      label: "Completed",
      badge: counts.completed,
      content: <JobsDataTable jobs={getFilteredJobs("completed")} onRowClick={setSelectedJob} emptyMessage="No completed jobs" />
    },
  ]

  return (
    <AuthenticatedWebAppShell pageTitle="Jobs">
      <div className="h-full flex flex-col">
        <WebPageHeader
          title="Jobs"
          subtitle="Manage and track all service jobs"
          breadcrumbs={[
            { label: "Home", href: "/home" },
            { label: "Jobs" },
          ]}
          actions={
            <Button onClick={() => setLocation("/quote-builder")}>
              <Plus className="w-4 h-4 mr-2" />
              New Job
            </Button>
          }
        />

        <div className="flex-1 p-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <WebTabbedLayout tabs={tabs} />
          )}
        </div>

        {/* Job Details Drawer */}
        <WebContextualDrawer
          open={!!selectedJob}
          onClose={() => setSelectedJob(null)}
          title={selectedJob ? `Job #J-${selectedJob.id}` : "Job Details"}
        >
          {selectedJob && (
            <div className="space-y-6">
              {/* Customer Info */}
              <div className="space-y-3">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Customer Information
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="font-medium text-foreground">{selectedJob.customerName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    {selectedJob.customerPhone}
                  </div>
                  {selectedJob.customerAddress && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4 mt-0.5" />
                      {selectedJob.customerAddress}
                    </div>
                  )}
                </div>
              </div>

              {/* Job Details */}
              <div className="space-y-3">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Job Details
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Service</span>
                    <p className="font-medium">{selectedJob.serviceType}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status</span>
                    <p>
                      <WebBadge
                        variant="status"
                        status={getStatusBadgeVariant(selectedJob.status)}
                      >
                        {selectedJob.status.replace("_", " ")}
                      </WebBadge>
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Scheduled</span>
                    <p className="font-medium">{formatDate(selectedJob.scheduledDate)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Amount</span>
                    <p className="font-medium">{formatCurrency(selectedJob.estimatedPrice)}</p>
                  </div>
                  {selectedJob.timeWindow && (
                    <div>
                      <span className="text-muted-foreground">Time Window</span>
                      <p className="font-medium">{selectedJob.timeWindow}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              {(selectedJob.notes || selectedJob.whatWereDoing) && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">Notes</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedJob.whatWereDoing || selectedJob.notes}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button variant="outline" className="flex-1">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button className="flex-1">
                  View Full Details
                </Button>
              </div>
            </div>
          )}
        </WebContextualDrawer>
      </div>
    </AuthenticatedWebAppShell>
  )
}
