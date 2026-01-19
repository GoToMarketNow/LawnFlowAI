import * as React from "react"
import { WebAppShell } from "../../components/web/app-shell"
import { WebPageHeader } from "../../components/web/page-header"
import { WebDataTable, DataTableColumn } from "../../components/web/data-table"
import { WebFilterPanel } from "../../components/web/filter-panel"
import { WebCrewMemberDrawer, CrewMemberData } from "../../components/web/crew-member-drawer"
import { WebBadge } from "../../components/web/badge"
import { WebButton } from "../../components/web/button"
import { WebEmptyState } from "../../components/web/empty-state"
import {
  Plus,
  QrCode,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  User,
  Users,
  Award,
  FileText,
  Clock,
  Shield,
  Edit,
  Trash2,
} from "lucide-react"

type MemberStatus = "active" | "invited" | "pending" | "inactive"
type PayType = "hourly" | "daily" | "per_job" | "percentage"

interface Alert {
  type: "payroll" | "emergency_contact" | "skills" | "profile_incomplete" | "compliance"
  message: string
  severity: "critical" | "warning"
}

interface CrewMember {
  id: string
  firstName: string
  lastName: string
  fullName: string
  phone: string
  email: string
  avatar?: string
  status: MemberStatus
  crewAssignment: string | null // Crew ID or null if unassigned
  crewName: string | null
  payType: PayType
  baseRate: number
  skills: string[]
  certifications: string[]
  lastActive: Date
  dateAdded: Date
  alerts: Alert[]
  // Extended profile
  address?: string
  emergencyContact?: {
    name: string
    phone: string
    relationship: string
  }
  documents: {
    w9: boolean
    i9: boolean
    license: boolean
  }
  availability: string[]
  yearsExperience: number
  notes?: string
}

export default function CrewMembersPage() {
  const [selectedMember, setSelectedMember] = React.useState<CrewMember | null>(null)
  const [showInviteModal, setShowInviteModal] = React.useState(false)
  
  // Filter states
  const [statusFilter, setStatusFilter] = React.useState<MemberStatus[]>([])
  const [crewFilter, setCrewFilter] = React.useState<string[]>([])
  const [payTypeFilter, setPayTypeFilter] = React.useState<PayType[]>([])
  const [skillFilter, setSkillFilter] = React.useState<string[]>([])
  const [complianceFilter, setComplianceFilter] = React.useState<string[]>([])
  const [recentlyAddedFilter, setRecentlyAddedFilter] = React.useState<string | null>(null)

  // Mock crew members data
  const allMembers: CrewMember[] = [
    {
      id: "cm-001",
      firstName: "Mike",
      lastName: "Rodriguez",
      fullName: "Mike Rodriguez",
      phone: "(555) 123-4567",
      email: "mike.r@lawnflow.ai",
      status: "active",
      crewAssignment: "crew-001",
      crewName: "Alpha Team",
      payType: "hourly",
      baseRate: 28.50,
      skills: ["Pesticide Application", "Tree Care", "Equipment Operation", "Irrigation"],
      certifications: ["Pesticide Applicator", "Tree Care Specialist"],
      lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      dateAdded: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 180 days ago
      alerts: [],
      address: "123 Main St, Anytown, USA 12345",
      emergencyContact: {
        name: "Maria Rodriguez",
        phone: "(555) 123-9999",
        relationship: "Spouse",
      },
      documents: {
        w9: true,
        i9: true,
        license: true,
      },
      availability: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      yearsExperience: 8,
      notes: "Crew lead with excellent safety record. Prefers commercial properties.",
    },
    {
      id: "cm-002",
      firstName: "Sarah",
      lastName: "Martinez",
      fullName: "Sarah Martinez",
      phone: "(555) 234-5678",
      email: "sarah.m@lawnflow.ai",
      status: "active",
      crewAssignment: "crew-001",
      crewName: "Alpha Team",
      payType: "daily",
      baseRate: 200,
      skills: ["Irrigation", "Landscape Design", "Planting"],
      certifications: ["Irrigation Specialist"],
      lastActive: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
      dateAdded: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
      alerts: [
        {
          type: "emergency_contact",
          message: "Missing emergency contact information",
          severity: "warning",
        },
      ],
      address: "456 Elm St, Anytown, USA 12345",
      documents: {
        w9: true,
        i9: true,
        license: false,
      },
      availability: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      yearsExperience: 3,
    },
    {
      id: "cm-003",
      firstName: "James",
      lastName: "Chen",
      fullName: "James Chen",
      phone: "(555) 345-6789",
      email: "james.c@lawnflow.ai",
      status: "active",
      crewAssignment: "crew-002",
      crewName: "Bravo Squad",
      payType: "per_job",
      baseRate: 150,
      skills: ["Heavy Equipment", "Mowing", "Edging", "Cleanup"],
      certifications: ["Heavy Equipment", "First Aid"],
      lastActive: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      dateAdded: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
      alerts: [],
      address: "789 Oak Ave, Anytown, USA 12345",
      emergencyContact: {
        name: "Linda Chen",
        phone: "(555) 345-9999",
        relationship: "Mother",
      },
      documents: {
        w9: true,
        i9: true,
        license: true,
      },
      availability: ["Mon", "Wed", "Fri", "Sat"],
      yearsExperience: 5,
    },
    {
      id: "cm-004",
      firstName: "David",
      lastName: "Park",
      fullName: "David Park",
      phone: "(555) 456-7890",
      email: "david.p@lawnflow.ai",
      status: "invited",
      crewAssignment: null,
      crewName: null,
      payType: "hourly",
      baseRate: 22.00,
      skills: [],
      certifications: [],
      lastActive: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      dateAdded: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      alerts: [
        {
          type: "profile_incomplete",
          message: "Profile not yet completed",
          severity: "warning",
        },
        {
          type: "payroll",
          message: "W-9 form needed",
          severity: "critical",
        },
      ],
      documents: {
        w9: false,
        i9: false,
        license: false,
      },
      availability: [],
      yearsExperience: 0,
    },
    {
      id: "cm-005",
      firstName: "Emily",
      lastName: "Johnson",
      fullName: "Emily Johnson",
      phone: "(555) 567-8901",
      email: "emily.j@lawnflow.ai",
      status: "active",
      crewAssignment: "crew-002",
      crewName: "Bravo Squad",
      payType: "percentage",
      baseRate: 15, // 15% of job value
      skills: ["Landscape Design", "Customer Service", "Quality Control"],
      certifications: ["Landscape Design"],
      lastActive: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      dateAdded: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      alerts: [],
      address: "321 Pine St, Anytown, USA 12345",
      emergencyContact: {
        name: "Robert Johnson",
        phone: "(555) 567-9999",
        relationship: "Father",
      },
      documents: {
        w9: true,
        i9: true,
        license: true,
      },
      availability: ["Tue", "Wed", "Thu", "Fri", "Sat"],
      yearsExperience: 2,
    },
    {
      id: "cm-006",
      firstName: "Tom",
      lastName: "Wilson",
      fullName: "Tom Wilson",
      phone: "(555) 678-9012",
      email: "tom.w@lawnflow.ai",
      status: "pending",
      crewAssignment: null,
      crewName: null,
      payType: "hourly",
      baseRate: 18.00,
      skills: ["Mowing", "Edging"],
      certifications: [],
      lastActive: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
      dateAdded: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      alerts: [
        {
          type: "payroll",
          message: "Missing W-9 form",
          severity: "critical",
        },
        {
          type: "emergency_contact",
          message: "Missing emergency contact",
          severity: "warning",
        },
        {
          type: "skills",
          message: "No certifications on file",
          severity: "warning",
        },
      ],
      documents: {
        w9: false,
        i9: true,
        license: false,
      },
      availability: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      yearsExperience: 1,
    },
    {
      id: "cm-007",
      firstName: "Lisa",
      lastName: "Brown",
      fullName: "Lisa Brown",
      phone: "(555) 789-0123",
      email: "lisa.b@lawnflow.ai",
      status: "inactive",
      crewAssignment: null,
      crewName: null,
      payType: "hourly",
      baseRate: 25.00,
      skills: ["Pesticide Application", "Fertilization", "Weed Control"],
      certifications: ["Pesticide Applicator"],
      lastActive: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
      dateAdded: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // 1 year ago
      alerts: [],
      address: "654 Maple Dr, Anytown, USA 12345",
      emergencyContact: {
        name: "John Brown",
        phone: "(555) 789-9999",
        relationship: "Spouse",
      },
      documents: {
        w9: true,
        i9: true,
        license: true,
      },
      availability: [],
      yearsExperience: 4,
      notes: "On leave - will return in spring season.",
    },
  ]

  // Apply filters
  const filteredMembers = React.useMemo(() => {
    return allMembers.filter((member) => {
      // Status filter
      if (statusFilter.length > 0 && !statusFilter.includes(member.status)) {
        return false
      }

      // Crew filter
      if (crewFilter.length > 0) {
        if (!member.crewAssignment || !crewFilter.includes(member.crewAssignment)) {
          return false
        }
      }

      // Pay type filter
      if (payTypeFilter.length > 0 && !payTypeFilter.includes(member.payType)) {
        return false
      }

      // Skill filter
      if (skillFilter.length > 0) {
        const hasSkill = skillFilter.some((skill) => member.skills.includes(skill))
        if (!hasSkill) return false
      }

      // Compliance filter
      if (complianceFilter.length > 0) {
        if (complianceFilter.includes("missing_w9") && member.documents.w9) return false
        if (complianceFilter.includes("missing_emergency_contact") && member.emergencyContact) return false
      }

      // Recently added filter
      if (recentlyAddedFilter) {
        const daysAgo = recentlyAddedFilter === "7" ? 7 : 30
        const cutoffDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
        if (member.dateAdded < cutoffDate) return false
      }

      return true
    })
  }, [allMembers, statusFilter, crewFilter, payTypeFilter, skillFilter, complianceFilter, recentlyAddedFilter])

  // Status badge rendering
  const renderStatus = (status: MemberStatus) => {
    const config = {
      active: { label: "Active", status: "success" as const },
      invited: { label: "Invited", status: "pending" as const },
      pending: { label: "Pending", status: "warning" as const },
      inactive: { label: "Inactive", status: "neutral" as const },
    }
    const { label, status: badgeStatus } = config[status]
    return <WebBadge variant="status" status={badgeStatus} size="sm">{label}</WebBadge>
  }

  // Pay type formatting
  const formatPayRate = (payType: PayType, baseRate: number) => {
    switch (payType) {
      case "hourly":
        return `$${baseRate.toFixed(2)}/hr`
      case "daily":
        return `$${baseRate.toFixed(0)}/day`
      case "per_job":
        return `$${baseRate.toFixed(0)}/job`
      case "percentage":
        return `${baseRate}% of job`
      default:
        return `$${baseRate}`
    }
  }

  // Relative time formatting
  const formatRelativeTime = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays}d ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
    return `${Math.floor(diffDays / 30)}mo ago`
  }

  // Alert icons
  const renderAlertIcons = (alerts: Alert[]) => {
    if (alerts.length === 0) return null

    return (
      <div className="flex items-center gap-1">
        {alerts.map((alert, idx) => (
          <div
            key={idx}
            className={`${
              alert.severity === "critical" ? "text-destructive" : "text-warning"
            }`}
            title={alert.message}
          >
            {alert.severity === "critical" ? (
              <AlertTriangle className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
          </div>
        ))}
      </div>
    )
  }

  // Table columns
  const columns: DataTableColumn<CrewMember>[] = [
    {
      id: "name",
      header: "Name",
      width: "240px",
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
            {row.firstName[0]}{row.lastName[0]}
          </div>
          <div>
            <div className="font-medium text-foreground">{row.fullName}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Phone className="w-3 h-3" />
              {row.phone}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      width: "100px",
      render: (_, row) => renderStatus(row.status),
    },
    {
      id: "crew",
      header: "Crew Assignment",
      width: "140px",
      render: (_, row) => (
        <div className="text-sm">
          {row.crewName ? (
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-primary" />
              <span className="font-medium">{row.crewName}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">Unassigned</span>
          )}
        </div>
      ),
    },
    {
      id: "payType",
      header: "Pay Type",
      width: "100px",
      render: (_, row) => (
        <div className="text-sm">
          {row.payType === "hourly" && "Hourly"}
          {row.payType === "daily" && "Daily"}
          {row.payType === "per_job" && "Per Job"}
          {row.payType === "percentage" && "% of Job"}
        </div>
      ),
    },
    {
      id: "rate",
      header: "Base Rate",
      width: "120px",
      align: "right",
      render: (_, row) => (
        <div className="text-sm font-medium">{formatPayRate(row.payType, row.baseRate)}</div>
      ),
    },
    {
      id: "skills",
      header: "Skills",
      width: "200px",
      render: (_, row) => (
        <div className="flex flex-wrap gap-1">
          {row.skills.slice(0, 2).map((skill, idx) => (
            <WebBadge key={idx} variant="status" status="primary" size="sm">
              {skill}
            </WebBadge>
          ))}
          {row.skills.length > 2 && (
            <WebBadge variant="status" status="neutral" size="sm">
              +{row.skills.length - 2}
            </WebBadge>
          )}
          {row.skills.length === 0 && (
            <span className="text-xs text-muted-foreground">No skills listed</span>
          )}
        </div>
      ),
    },
    {
      id: "lastActive",
      header: "Last Active",
      width: "100px",
      render: (_, row) => (
        <div className="text-sm text-muted-foreground">{formatRelativeTime(row.lastActive)}</div>
      ),
    },
    {
      id: "alerts",
      header: "Alerts",
      width: "80px",
      align: "center",
      render: (_, row) => renderAlertIcons(row.alerts),
    },
  ]

  const hasFilters = 
    statusFilter.length > 0 ||
    crewFilter.length > 0 ||
    payTypeFilter.length > 0 ||
    skillFilter.length > 0 ||
    complianceFilter.length > 0 ||
    recentlyAddedFilter !== null

  const clearFilters = () => {
    setStatusFilter([])
    setCrewFilter([])
    setPayTypeFilter([])
    setSkillFilter([])
    setComplianceFilter([])
    setRecentlyAddedFilter(null)
  }

  return (
    <WebAppShell
      pageTitle="Crew Members"
      userRole="ADMIN"
      userName="John Smith"
      userEmail="john@lawnflow.ai"
    >
      <div className="flex flex-col h-full">
        <div className="p-6 border-b border-border">
          <WebPageHeader
            title="Crew Members"
            description="Onboard, pay, assign, and manage skills"
            actions={
              <div className="flex items-center gap-3">
                <WebButton
                  variant="secondary"
                  onClick={() => setShowInviteModal(true)}
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  Invite via Mobile Link
                </WebButton>
                <WebButton variant="primary">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Crew Member
                </WebButton>
              </div>
            }
          />
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left Filter Panel */}
          <div className="w-60 border-r border-border overflow-y-auto bg-muted/30">
            <WebFilterPanel title="Filters">
              {/* Status Filter */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Status</p>
                <div className="space-y-1.5">
                  {[
                    { value: "active" as MemberStatus, label: "Active" },
                    { value: "invited" as MemberStatus, label: "Invited" },
                    { value: "pending" as MemberStatus, label: "Pending" },
                    { value: "inactive" as MemberStatus, label: "Inactive" },
                  ].map((option) => (
                    <label key={option.value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={statusFilter.includes(option.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setStatusFilter([...statusFilter, option.value])
                          } else {
                            setStatusFilter(statusFilter.filter((s) => s !== option.value))
                          }
                        }}
                        className="rounded border-border"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Pay Type Filter */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Pay Type</p>
                <div className="space-y-1.5">
                  {[
                    { value: "hourly" as PayType, label: "Hourly" },
                    { value: "daily" as PayType, label: "Daily" },
                    { value: "per_job" as PayType, label: "Per Job" },
                    { value: "percentage" as PayType, label: "% of Job" },
                  ].map((option) => (
                    <label key={option.value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={payTypeFilter.includes(option.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setPayTypeFilter([...payTypeFilter, option.value])
                          } else {
                            setPayTypeFilter(payTypeFilter.filter((p) => p !== option.value))
                          }
                        }}
                        className="rounded border-border"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Compliance Filter */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Compliance</p>
                <div className="space-y-1.5">
                  {[
                    { value: "missing_w9", label: "Missing W-9" },
                    { value: "missing_emergency_contact", label: "Missing Emergency Contact" },
                  ].map((option) => (
                    <label key={option.value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={complianceFilter.includes(option.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setComplianceFilter([...complianceFilter, option.value])
                          } else {
                            setComplianceFilter(complianceFilter.filter((c) => c !== option.value))
                          }
                        }}
                        className="rounded border-border"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Recently Added Filter */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Recently Added</p>
                <div className="space-y-1.5">
                  {[
                    { value: "7", label: "Last 7 days" },
                    { value: "30", label: "Last 30 days" },
                  ].map((option) => (
                    <label key={option.value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="recently_added"
                        checked={recentlyAddedFilter === option.value}
                        onChange={() => setRecentlyAddedFilter(option.value)}
                        className="rounded-full border-border"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {hasFilters && (
                <div className="pt-2">
                  <WebButton variant="ghost" size="sm" onClick={clearFilters} className="w-full">
                    Clear All Filters
                  </WebButton>
                </div>
              )}
            </WebFilterPanel>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-auto">
            {allMembers.length === 0 ? (
              // No crew members at all
              <div className="h-full flex items-center justify-center p-6">
                <WebEmptyState
                  variant="no-data"
                  title="No crew members yet"
                  description="Get started by adding your first crew member or send them a mobile invite link"
                  actions={
                    <div className="flex gap-3">
                      <WebButton variant="secondary" onClick={() => setShowInviteModal(true)}>
                        <QrCode className="w-4 h-4 mr-2" />
                        Invite via Mobile Link
                      </WebButton>
                      <WebButton variant="primary">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Crew Member
                      </WebButton>
                    </div>
                  }
                />
              </div>
            ) : filteredMembers.length === 0 ? (
              // Filtered to zero results
              <div className="h-full flex items-center justify-center p-6">
                <WebEmptyState
                  variant="no-results"
                  title="No crew members match your filters"
                  description="Try adjusting your filter criteria to see more results"
                  actions={
                    <WebButton variant="secondary" onClick={clearFilters}>
                      Clear All Filters
                    </WebButton>
                  }
                />
              </div>
            ) : (
              <div className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {filteredMembers.length} of {allMembers.length} crew members
                    {hasFilters && " (filtered)"}
                  </p>
                </div>
                <WebDataTable
                  columns={columns}
                  data={filteredMembers}
                  keyField="id"
                  onRowClick={(member) => setSelectedMember(member)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Crew Member Detail Drawer */}
      <WebCrewMemberDrawer
        open={!!selectedMember}
        onClose={() => setSelectedMember(null)}
        data={selectedMember as CrewMemberData}
      />

      {/* Invite Modal (placeholder) */}
      {showInviteModal && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center"
          onClick={() => setShowInviteModal(false)}
        >
          <div
            className="bg-card border border-border rounded-lg p-6 max-w-md mx-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold mb-2">Invite via Mobile Link</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Generate a QR code or link for crew members to complete onboarding on their mobile device
            </p>
            <div className="bg-muted/30 rounded-lg p-8 flex items-center justify-center mb-4">
              <QrCode className="w-32 h-32 text-muted-foreground" />
            </div>
            <div className="bg-muted rounded-md p-3 mb-4">
              <code className="text-xs">https://mobile.lawnflow.ai/join/abc123</code>
            </div>
            <div className="flex justify-end gap-2">
              <WebButton variant="ghost" onClick={() => setShowInviteModal(false)}>
                Close
              </WebButton>
              <WebButton variant="primary">
                Copy Link
              </WebButton>
            </div>
          </div>
        </div>
      )}
    </WebAppShell>
  )
}