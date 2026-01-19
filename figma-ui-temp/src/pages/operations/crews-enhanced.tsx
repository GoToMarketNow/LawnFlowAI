import * as React from "react"
import { WebAppShell } from "../../components/web/app-shell"
import { WebPageHeader } from "../../components/web/page-header"
import { WebDataTable, DataTableColumn } from "../../components/web/data-table"
import { WebContextualDrawer } from "../../components/web/contextual-drawer"
import { WebBadge } from "../../components/web/badge"
import { WebButton } from "../../components/web/button"
import {
  Users,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Calendar,
  Clock,
  Award,
  Wrench,
  TrendingUp,
  Phone,
  Mail,
  Briefcase,
} from "lucide-react"

type CrewFlag =
  | "partial_skill_match"
  | "partial_equipment_match"
  | "outside_service_radius"
  | "no_available_capacity"
  | "insufficient_crew_size"
  | "missing_coordinates"

type EligibilityStatus = "fully_eligible" | "conditionally_eligible" | "ineligible"

interface CrewMember {
  id: string
  name: string
  role: string
  yearsExperience: number
  certifications: string[]
}

interface CrewCapacityDay {
  date: string
  available: boolean
  utilization: number // 0-100
  assignedJobs: number
}

interface Crew {
  id: string
  name: string
  leadName: string
  leadPhone: string
  leadEmail: string
  memberCount: number
  members: CrewMember[]
  homeBase: string
  skillMatch: number // 0-100
  equipmentMatch: number // 0-100
  requiredSkills: { name: string; matched: boolean }[]
  requiredEquipment: { name: string; matched: boolean }[]
  distanceFromBase: number // miles
  eligibilityStatus: EligibilityStatus
  flags: CrewFlag[]
  capacityNext7Days: CrewCapacityDay[]
  specialties: string[]
  equipment: string[]
  avgJobRating: number
  jobsCompleted: number
  serviceRadius: number
}

export default function CrewsEnhancedPage() {
  const [selectedCrew, setSelectedCrew] = React.useState<Crew | null>(null)
  // Job context: if viewing crews for a specific job assignment
  const [jobContext, setJobContext] = React.useState<{
    jobId: string
    jobName: string
    laborMinutesRequired: number
  } | null>(null)

  // Mock crew data
  const crews: Crew[] = [
    {
      id: "crew-001",
      name: "Alpha Team",
      leadName: "Mike Rodriguez",
      leadPhone: "(555) 123-4567",
      leadEmail: "mike.r@lawnflow.ai",
      memberCount: 4,
      members: [
        {
          id: "m1",
          name: "Mike Rodriguez",
          role: "Crew Lead",
          yearsExperience: 8,
          certifications: ["Pesticide Applicator", "Tree Care Specialist"],
        },
        {
          id: "m2",
          name: "James Chen",
          role: "Equipment Operator",
          yearsExperience: 5,
          certifications: ["Heavy Equipment", "First Aid"],
        },
        {
          id: "m3",
          name: "Sarah Martinez",
          role: "Landscape Technician",
          yearsExperience: 3,
          certifications: ["Irrigation Specialist"],
        },
        {
          id: "m4",
          name: "Tom Wilson",
          role: "Landscape Technician",
          yearsExperience: 2,
          certifications: [],
        },
      ],
      homeBase: "123 Main St, Anytown, USA",
      skillMatch: 100,
      equipmentMatch: 100,
      requiredSkills: [
        { name: "Pesticide Applicator", matched: true },
        { name: "Tree Care Specialist", matched: true },
        { name: "Irrigation Specialist", matched: true },
      ],
      requiredEquipment: [
        { name: "Mowers", matched: true },
        { name: "Edgers", matched: true },
        { name: "Blowers", matched: true },
        { name: "Truck", matched: true },
      ],
      distanceFromBase: 2.3,
      eligibilityStatus: "fully_eligible",
      flags: [],
      capacityNext7Days: [
        { date: "Mon 1/13", available: true, utilization: 60, assignedJobs: 3 },
        { date: "Tue 1/14", available: true, utilization: 80, assignedJobs: 4 },
        { date: "Wed 1/15", available: true, utilization: 40, assignedJobs: 2 },
        { date: "Thu 1/16", available: true, utilization: 70, assignedJobs: 3 },
        { date: "Fri 1/17", available: true, utilization: 50, assignedJobs: 2 },
        { date: "Mon 1/20", available: true, utilization: 30, assignedJobs: 1 },
        { date: "Tue 1/21", available: true, utilization: 60, assignedJobs: 3 },
      ],
      specialties: ["Commercial Maintenance", "Tree Care", "Irrigation"],
      equipment: ["Mowers (3)", "Edgers (2)", "Blowers (4)", "Truck (2)"],
      avgJobRating: 4.8,
      jobsCompleted: 342,
      serviceRadius: 25,
    },
    {
      id: "crew-002",
      name: "Bravo Squad",
      leadName: "Jennifer Lee",
      leadPhone: "(555) 234-5678",
      leadEmail: "jennifer.l@lawnflow.ai",
      memberCount: 3,
      members: [
        {
          id: "m5",
          name: "Jennifer Lee",
          role: "Crew Lead",
          yearsExperience: 6,
          certifications: ["Pesticide Applicator", "Landscape Design"],
        },
        {
          id: "m6",
          name: "David Park",
          role: "Equipment Operator",
          yearsExperience: 4,
          certifications: ["Heavy Equipment"],
        },
        {
          id: "m7",
          name: "Emily Johnson",
          role: "Landscape Technician",
          yearsExperience: 2,
          certifications: ["First Aid"],
        },
      ],
      homeBase: "456 Elm St, Anytown, USA",
      skillMatch: 67,
      equipmentMatch: 90,
      requiredSkills: [
        { name: "Pesticide Applicator", matched: true },
        { name: "Landscape Design", matched: true },
        { name: "Tree Care Specialist", matched: false },
      ],
      requiredEquipment: [
        { name: "Mowers", matched: true },
        { name: "Edgers", matched: true },
        { name: "Blowers", matched: true },
        { name: "Truck", matched: true },
      ],
      distanceFromBase: 5.7,
      eligibilityStatus: "conditionally_eligible",
      flags: ["partial_skill_match"],
      capacityNext7Days: [
        { date: "Mon 1/13", available: true, utilization: 90, assignedJobs: 4 },
        { date: "Tue 1/14", available: true, utilization: 100, assignedJobs: 5 },
        { date: "Wed 1/15", available: false, utilization: 100, assignedJobs: 5 },
        { date: "Thu 1/16", available: true, utilization: 80, assignedJobs: 4 },
        { date: "Fri 1/17", available: true, utilization: 70, assignedJobs: 3 },
        { date: "Mon 1/20", available: true, utilization: 60, assignedJobs: 3 },
        { date: "Tue 1/21", available: true, utilization: 50, assignedJobs: 2 },
      ],
      specialties: ["Residential Maintenance", "Landscape Installation"],
      equipment: ["Mowers (2)", "Edgers (2)", "Blowers (3)", "Truck (1)"],
      avgJobRating: 4.6,
      jobsCompleted: 287,
      serviceRadius: 20,
    },
    {
      id: "crew-003",
      name: "Charlie Crew",
      leadName: "Robert Thompson",
      leadPhone: "(555) 345-6789",
      leadEmail: "robert.t@lawnflow.ai",
      memberCount: 5,
      members: [
        {
          id: "m8",
          name: "Robert Thompson",
          role: "Crew Lead",
          yearsExperience: 10,
          certifications: ["Pesticide Applicator", "Tree Care Specialist", "Irrigation Master"],
        },
        {
          id: "m9",
          name: "Chris Anderson",
          role: "Equipment Operator",
          yearsExperience: 7,
          certifications: ["Heavy Equipment", "First Aid"],
        },
        {
          id: "m10",
          name: "Lisa Brown",
          role: "Landscape Technician",
          yearsExperience: 4,
          certifications: ["Pesticide Applicator"],
        },
        {
          id: "m11",
          name: "Kevin White",
          role: "Landscape Technician",
          yearsExperience: 3,
          certifications: [],
        },
        {
          id: "m12",
          name: "Michelle Garcia",
          role: "Apprentice",
          yearsExperience: 1,
          certifications: [],
        },
      ],
      homeBase: "789 Oak St, Anytown, USA",
      skillMatch: 100,
      equipmentMatch: 75,
      requiredSkills: [
        { name: "Pesticide Applicator", matched: true },
        { name: "Tree Care Specialist", matched: true },
        { name: "Irrigation Master", matched: true },
      ],
      requiredEquipment: [
        { name: "Mowers", matched: true },
        { name: "Edgers", matched: true },
        { name: "Blowers", matched: true },
        { name: "Truck", matched: true },
        { name: "Aerator", matched: false },
      ],
      distanceFromBase: 8.2,
      eligibilityStatus: "conditionally_eligible",
      flags: ["partial_equipment_match"],
      capacityNext7Days: [
        { date: "Mon 1/13", available: true, utilization: 50, assignedJobs: 2 },
        { date: "Tue 1/14", available: true, utilization: 60, assignedJobs: 3 },
        { date: "Wed 1/15", available: true, utilization: 40, assignedJobs: 2 },
        { date: "Thu 1/16", available: true, utilization: 70, assignedJobs: 3 },
        { date: "Fri 1/17", available: false, utilization: 100, assignedJobs: 0 },
        { date: "Mon 1/20", available: true, utilization: 30, assignedJobs: 1 },
        { date: "Tue 1/21", available: true, utilization: 50, assignedJobs: 2 },
      ],
      specialties: ["Large Commercial", "Athletic Fields", "HOA Maintenance"],
      equipment: ["Mowers (4)", "Edgers (3)", "Blowers (5)", "Truck (2)", "Aerator (1)"],
      avgJobRating: 4.9,
      jobsCompleted: 489,
      serviceRadius: 30,
    },
    {
      id: "crew-004",
      name: "Delta Force",
      leadName: "Alex Turner",
      leadPhone: "(555) 456-7890",
      leadEmail: "alex.t@lawnflow.ai",
      memberCount: 2,
      members: [
        {
          id: "m13",
          name: "Alex Turner",
          role: "Crew Lead",
          yearsExperience: 4,
          certifications: ["Pesticide Applicator"],
        },
        {
          id: "m14",
          name: "Jordan Smith",
          role: "Landscape Technician",
          yearsExperience: 2,
          certifications: [],
        },
      ],
      homeBase: "101 Pine St, Anytown, USA",
      skillMatch: 70,
      equipmentMatch: 80,
      requiredSkills: [
        { name: "Pesticide Applicator", matched: true },
      ],
      requiredEquipment: [
        { name: "Mowers", matched: true },
        { name: "Edgers", matched: true },
        { name: "Blowers", matched: true },
        { name: "Truck", matched: true },
      ],
      distanceFromBase: 32.5,
      eligibilityStatus: "ineligible",
      flags: ["insufficient_crew_size", "outside_service_radius", "partial_skill_match"],
      capacityNext7Days: [
        { date: "Mon 1/13", available: true, utilization: 100, assignedJobs: 3 },
        { date: "Tue 1/14", available: true, utilization: 100, assignedJobs: 3 },
        { date: "Wed 1/15", available: false, utilization: 100, assignedJobs: 0 },
        { date: "Thu 1/16", available: true, utilization: 90, assignedJobs: 2 },
        { date: "Fri 1/17", available: true, utilization: 80, assignedJobs: 2 },
        { date: "Mon 1/20", available: true, utilization: 70, assignedJobs: 2 },
        { date: "Tue 1/21", available: false, utilization: 100, assignedJobs: 0 },
      ],
      specialties: ["Residential Maintenance"],
      equipment: ["Mowers (1)", "Edgers (1)", "Blowers (2)", "Truck (1)"],
      avgJobRating: 4.3,
      jobsCompleted: 156,
      serviceRadius: 15,
    },
  ]

  // Sort crews: fully eligible first, then conditionally eligible, then ineligible
  const sortedCrews = React.useMemo(() => {
    const statusOrder = {
      fully_eligible: 1,
      conditionally_eligible: 2,
      ineligible: 3,
    }
    return [...crews].sort((a, b) => {
      const statusDiff = statusOrder[a.eligibilityStatus] - statusOrder[b.eligibilityStatus]
      if (statusDiff !== 0) return statusDiff
      // Within same eligibility, sort by skill match descending
      return b.skillMatch - a.skillMatch
    })
  }, [])

  // Flag metadata
  const flagMetadata: Record<
    CrewFlag,
    { label: string; icon: React.ReactNode; variant: "critical" | "warning"; explanation: string }
  > = {
    outside_service_radius: {
      label: "Outside service radius",
      icon: <MapPin className="w-4 h-4" />,
      variant: "critical",
      explanation: "This crew would exceed their operational service area, increasing costs and risk.",
    },
    no_available_capacity: {
      label: "No available capacity",
      icon: <Calendar className="w-4 h-4" />,
      variant: "critical",
      explanation: "This crew has no available time slots in the next 7 days.",
    },
    insufficient_crew_size: {
      label: "Insufficient crew size",
      icon: <Users className="w-4 h-4" />,
      variant: "critical",
      explanation: "This crew doesn't have enough members for safe and efficient job completion.",
    },
    partial_skill_match: {
      label: "Partial skill match",
      icon: <Award className="w-4 h-4" />,
      variant: "warning",
      explanation: "This crew is missing some required certifications. Job quality may require additional oversight.",
    },
    partial_equipment_match: {
      label: "Partial equipment match",
      icon: <Wrench className="w-4 h-4" />,
      variant: "warning",
      explanation: "This crew needs to rent or borrow equipment, which may delay job start and increase costs.",
    },
    missing_coordinates: {
      label: "Missing GPS coordinates",
      icon: <MapPin className="w-4 h-4" />,
      variant: "warning",
      explanation: "GPS location data is missing, preventing accurate routing and scheduling.",
    },
  }

  // Eligibility status rendering
  const renderEligibilityStatus = (status: EligibilityStatus) => {
    const config = {
      fully_eligible: {
        label: "Fully Eligible",
        icon: <CheckCircle2 className="w-4 h-4" />,
        color: "text-success",
        bg: "bg-success/10",
        border: "border-success/20",
      },
      conditionally_eligible: {
        label: "Conditionally Eligible",
        icon: <AlertCircle className="w-4 h-4" />,
        color: "text-warning",
        bg: "bg-warning/10",
        border: "border-warning/20",
      },
      ineligible: {
        label: "Ineligible",
        icon: <AlertTriangle className="w-4 h-4" />,
        color: "text-destructive",
        bg: "bg-destructive/10",
        border: "border-destructive/20",
      },
    }

    const { label, icon, color, bg, border } = config[status]

    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border ${bg} ${border}`}>
        <span className={color}>{icon}</span>
        <span className={`text-sm font-medium ${color}`}>{label}</span>
      </div>
    )
  }

  // Render flags with tooltips
  const renderFlags = (flags: CrewFlag[]) => {
    if (flags.length === 0) return <span className="text-xs text-muted-foreground">—</span>

    // Sort critical flags first
    const sortedFlags = [...flags].sort((a, b) => {
      const aIsCritical = flagMetadata[a].variant === "critical"
      const bIsCritical = flagMetadata[b].variant === "critical"
      if (aIsCritical && !bIsCritical) return -1
      if (!aIsCritical && bIsCritical) return 1
      return 0
    })

    return (
      <div className="flex items-center gap-1">
        {sortedFlags.map((flag) => {
          const { label, icon, variant } = flagMetadata[flag]
          const colorClass = variant === "critical" ? "text-destructive" : "text-warning"

          return (
            <div
              key={flag}
              className={`${colorClass} cursor-help`}
              title={label}
              aria-label={label}
            >
              {icon}
            </div>
          )
        })}
      </div>
    )
  }

  // Render progress bar
  const renderProgressBar = (value: number, showPercentage = true) => {
    const getColorClass = () => {
      if (value === 100) return "bg-success"
      if (value >= 80) return "bg-primary"
      if (value >= 60) return "bg-warning"
      return "bg-destructive"
    }

    return (
      <div className="flex items-center gap-2 min-w-[120px]">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full ${getColorClass()} transition-all`}
            style={{ width: `${value}%` }}
          />
        </div>
        {showPercentage && (
          <span className="text-xs font-medium text-muted-foreground w-8 text-right">
            {value}%
          </span>
        )}
      </div>
    )
  }

  // Render capacity bars
  const renderCapacityBars = (capacityDays: CrewCapacityDay[]) => {
    return (
      <div className="flex gap-0.5">
        {capacityDays.map((day, index) => {
          const isAvailable = day.available
          const utilization = day.utilization

          const getBarColor = () => {
            if (!isAvailable) return "bg-muted"
            if (utilization >= 100) return "bg-destructive"
            if (utilization >= 80) return "bg-warning"
            if (utilization >= 50) return "bg-primary"
            return "bg-success"
          }

          return (
            <div
              key={index}
              className="group relative"
              title={`${day.date}: ${isAvailable ? `${utilization}% utilized (${day.assignedJobs} jobs)` : "Unavailable"}`}
            >
              <div className={`w-3 h-8 rounded-sm ${getBarColor()}`} />
            </div>
          )
        })}
      </div>
    )
  }

  // Table columns
  const columns: DataTableColumn<Crew>[] = [
    {
      id: "name",
      header: "Crew Name",
      accessor: "name",
      sortable: true,
      width: "200px",
      render: (value, row) => (
        <div>
          <div className="font-medium text-foreground">{value}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            <div className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {row.memberCount} members
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "skillMatch",
      header: "Skill Match",
      width: "160px",
      render: (_, row) => renderProgressBar(row.skillMatch),
    },
    {
      id: "equipmentMatch",
      header: "Equipment Match",
      width: "180px",
      render: (_, row) => renderProgressBar(row.equipmentMatch),
    },
    {
      id: "capacity",
      header: "Capacity (7d)",
      width: "120px",
      render: (_, row) => renderCapacityBars(row.capacityNext7Days),
    },
    {
      id: "distance",
      header: "Distance",
      width: "100px",
      align: "right",
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1">
          <MapPin className="w-3 h-3 text-muted-foreground" />
          <span className="text-sm font-medium">{row.distanceFromBase} mi</span>
        </div>
      ),
    },
    {
      id: "eligibility",
      header: "Eligibility",
      width: "180px",
      render: (_, row) => renderEligibilityStatus(row.eligibilityStatus),
    },
    {
      id: "flags",
      header: "Flags",
      width: "120px",
      render: (_, row) => renderFlags(row.flags),
    },
  ]

  const hasCriticalFlags = (crew: Crew | null) => {
    if (!crew) return false
    return crew.flags.some(f => flagMetadata[f].variant === "critical")
  }

  return (
    <WebAppShell
      pageTitle="Crew Intelligence"
      userRole="ADMIN"
      userName="John Smith"
      userEmail="john@lawnflow.ai"
    >
      <div className="p-6">
        <WebPageHeader
          title="Crews"
          description="Availability, capability, and performance intelligence"
        />

        <div className="mt-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                {sortedCrews.length} crews • Sorted by eligibility
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-success" />
                <span>Fully Eligible</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-warning" />
                <span>Conditionally Eligible</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <span>Ineligible</span>
              </div>
            </div>
          </div>

          <WebDataTable
            columns={columns}
            data={sortedCrews}
            keyField="id"
            onRowClick={(crew) => setSelectedCrew(crew)}
          />
        </div>
      </div>

      {/* Enhanced Crew Intelligence Detail Drawer */}
      <WebContextualDrawer
        open={!!selectedCrew}
        onClose={() => {
          setSelectedCrew(null)
          setJobContext(null)
        }}
        title={selectedCrew?.name || ""}
        size="lg"
        footer={
          selectedCrew && (
            <div className="flex justify-between items-center gap-3">
              <WebButton 
                variant="ghost" 
                onClick={() => {
                  setSelectedCrew(null)
                  setJobContext(null)
                }}
              >
                Close
              </WebButton>
              {jobContext ? (
                <div className="flex gap-2">
                  <WebButton variant="secondary">
                    Adjust Eligibility Thresholds
                  </WebButton>
                  <WebButton 
                    variant="primary"
                    disabled={hasCriticalFlags(selectedCrew)}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Assign Crew
                  </WebButton>
                </div>
              ) : (
                <div className="flex gap-2">
                  <WebButton variant="secondary">
                    <Phone className="w-4 h-4 mr-2" />
                    Call Lead
                  </WebButton>
                  <WebButton variant="secondary">
                    <Calendar className="w-4 h-4 mr-2" />
                    View Schedule
                  </WebButton>
                </div>
              )}
            </div>
          )
        }
      >
        {selectedCrew && (
          <div className="space-y-6">
            {/* 1. Header Section */}
            <div className="pb-4 border-b border-border">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Users className="w-4 h-4" />
                    <span>{selectedCrew.memberCount} members</span>
                    <span className="text-muted-foreground/50">•</span>
                    <MapPin className="w-4 h-4" />
                    <span>{selectedCrew.homeBase}</span>
                  </div>
                </div>
                <div>
                  {renderEligibilityStatus(selectedCrew.eligibilityStatus)}
                </div>
              </div>

              {jobContext && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Briefcase className="w-4 h-4 text-primary" />
                    <span className="font-medium text-primary">
                      Viewing for Job: {jobContext.jobName}
                    </span>
                    <span className="text-muted-foreground">
                      ({jobContext.laborMinutesRequired} min required)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Capability Match Section */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Award className="w-4 h-4 text-primary" />
                Capability Match
              </h3>
              
              <div className="space-y-4">
                {/* Skill Match */}
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Skill Match</span>
                    <span className="text-sm font-semibold">{selectedCrew.skillMatch}%</span>
                  </div>
                  {renderProgressBar(selectedCrew.skillMatch, false)}
                  
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground mb-2 font-medium">Required Skills</p>
                        <div className="space-y-1">
                          {selectedCrew.requiredSkills.map((skill, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              {skill.matched ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                              ) : (
                                <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                              )}
                              <span className={skill.matched ? "text-foreground" : "text-muted-foreground line-through"}>
                                {skill.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="bg-muted/50 rounded-md p-2">
                        <p className="text-xs font-medium mb-1">Why this matters:</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {selectedCrew.skillMatch === 100
                            ? "This crew has all required certifications and expertise to complete the job safely and effectively."
                            : selectedCrew.skillMatch >= 80
                            ? "This crew has most required skills. Missing skills may require supervision or additional training."
                            : "This crew lacks critical skills for optimal job execution. Consider alternative crews or additional resources."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Equipment Match */}
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Equipment Match</span>
                    <span className="text-sm font-semibold">{selectedCrew.equipmentMatch}%</span>
                  </div>
                  {renderProgressBar(selectedCrew.equipmentMatch, false)}
                  
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground mb-2 font-medium">Required Equipment</p>
                        <div className="space-y-1">
                          {selectedCrew.requiredEquipment.map((equip, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              {equip.matched ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                              ) : (
                                <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                              )}
                              <span className={equip.matched ? "text-foreground" : "text-muted-foreground line-through"}>
                                {equip.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="bg-muted/50 rounded-md p-2">
                        <p className="text-xs font-medium mb-1">Why this matters:</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {selectedCrew.equipmentMatch === 100
                            ? "This crew has all necessary equipment ready to start work immediately with no delays."
                            : selectedCrew.equipmentMatch >= 80
                            ? "This crew has most equipment. Missing items may need to be rented or borrowed, potentially causing delays."
                            : "This crew lacks critical equipment. Significant additional resources required before job start."}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Capacity Forecast Section */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Capacity Forecast (Next 7 Business Days)
              </h3>
              
              <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                {selectedCrew.capacityNext7Days.map((day, index) => {
                  // Daily capacity is 8 hours = 480 minutes
                  const dailyCapacityMinutes = 480
                  const usedMinutes = Math.round((day.utilization / 100) * dailyCapacityMinutes)
                  const remainingMinutes = dailyCapacityMinutes - usedMinutes
                  const canAccommodateJob = jobContext 
                    ? remainingMinutes >= jobContext.laborMinutesRequired 
                    : false

                  return (
                    <div 
                      key={index} 
                      className={`p-3 rounded-lg border ${
                        canAccommodateJob 
                          ? "bg-success/5 border-success/20" 
                          : day.available 
                          ? "bg-muted/30 border-border" 
                          : "bg-destructive/5 border-destructive/20"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium w-20">{day.date}</span>
                          {canAccommodateJob && (
                            <WebBadge variant="status" status="success" size="sm">
                              Can Fit Job
                            </WebBadge>
                          )}
                          {!day.available && (
                            <WebBadge variant="status" status="overdue" size="sm">
                              Unavailable
                            </WebBadge>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">
                            {day.available ? `${remainingMinutes} min` : "0 min"} remaining
                          </p>
                          <p className="text-xs text-muted-foreground">
                            of {dailyCapacityMinutes} min daily capacity
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              !day.available 
                                ? "bg-destructive" 
                                : day.utilization >= 100 
                                ? "bg-destructive" 
                                : day.utilization >= 80 
                                ? "bg-warning" 
                                : "bg-success"
                            }`}
                            style={{ width: `${Math.min(day.utilization, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-16 text-right">
                          {day.utilization}% used
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {jobContext && (
                <div className="mt-3 bg-primary/10 border border-primary/20 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">
                    <strong className="text-primary">Job Requirement:</strong> {jobContext.laborMinutesRequired} minutes of labor needed. 
                    Days highlighted in green have sufficient remaining capacity.
                  </p>
                </div>
              )}
            </div>

            {/* 4. Distance & Routing Section */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                Distance & Service Radius
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-card border border-border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Distance from Home Base</p>
                  <p className="text-2xl font-semibold">{selectedCrew.distanceFromBase} mi</p>
                  {selectedCrew.distanceFromBase > selectedCrew.serviceRadius && (
                    <div className="mt-2 flex items-center gap-1 text-destructive">
                      <AlertTriangle className="w-3 h-3" />
                      <span className="text-xs">Outside service radius</span>
                    </div>
                  )}
                </div>
                <div className="bg-card border border-border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Service Radius</p>
                  <p className="text-2xl font-semibold">{selectedCrew.serviceRadius} mi</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Max operational distance
                  </p>
                </div>
              </div>

              <div className="mt-3 bg-muted/50 rounded-lg p-3">
                <p className="text-xs font-medium mb-1">Why this matters:</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {selectedCrew.distanceFromBase <= selectedCrew.serviceRadius
                    ? `This crew is within their ${selectedCrew.serviceRadius}-mile service radius, ensuring efficient travel times and fuel costs.`
                    : `This crew is ${(selectedCrew.distanceFromBase - selectedCrew.serviceRadius).toFixed(1)} miles beyond their service radius, which may result in increased travel time, higher fuel costs, and crew fatigue.`}
                </p>
              </div>
            </div>

            {/* 5. Flags & Risk Indicators */}
            {selectedCrew.flags.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  Flags & Risk Indicators
                </h3>
                
                <div className="space-y-3">
                  {/* Critical Flags */}
                  {selectedCrew.flags.filter(f => flagMetadata[f].variant === "critical").length > 0 && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                      <p className="text-sm font-semibold text-destructive mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Critical Issues
                      </p>
                      <div className="space-y-2">
                        {selectedCrew.flags
                          .filter(f => flagMetadata[f].variant === "critical")
                          .map((flag) => {
                            const { label, icon, explanation } = flagMetadata[flag]
                            return (
                              <div key={flag} className="bg-card/50 rounded-md p-2">
                                <div className="flex items-start gap-2">
                                  <span className="text-destructive mt-0.5">{icon}</span>
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-destructive">{label}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{explanation}</p>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}

                  {/* Advisory Flags */}
                  {selectedCrew.flags.filter(f => flagMetadata[f].variant === "warning").length > 0 && (
                    <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
                      <p className="text-sm font-semibold text-warning mb-2 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Advisory Warnings
                      </p>
                      <div className="space-y-2">
                        {selectedCrew.flags
                          .filter(f => flagMetadata[f].variant === "warning")
                          .map((flag) => {
                            const { label, icon, explanation } = flagMetadata[flag]
                            return (
                              <div key={flag} className="bg-card/50 rounded-md p-2">
                                <div className="flex items-start gap-2">
                                  <span className="text-warning mt-0.5">{icon}</span>
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-warning">{label}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{explanation}</p>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* No Flags - All Clear */}
            {selectedCrew.flags.length === 0 && (
              <div className="bg-success/10 border border-success/20 rounded-lg p-4">
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="w-5 h-5" />
                  <div>
                    <p className="font-semibold">No Issues Detected</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      This crew meets all requirements with no flags or warnings.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Assignment Disabled Explanation */}
            {jobContext && hasCriticalFlags(selectedCrew) && (
              <div className="bg-muted border border-border rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium text-muted-foreground">Assignment Blocked</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      This crew cannot be assigned due to critical flags. Resolve the issues above or adjust eligibility thresholds to proceed.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Team Performance */}
            <div>
              <h3 className="font-semibold mb-3">Performance & Experience</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <p className="text-xs text-muted-foreground">Average Rating</p>
                  </div>
                  <p className="text-3xl font-semibold">{selectedCrew.avgJobRating}</p>
                  <p className="text-xs text-muted-foreground mt-1">out of 5.0</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    <p className="text-xs text-muted-foreground">Jobs Completed</p>
                  </div>
                  <p className="text-3xl font-semibold">{selectedCrew.jobsCompleted}</p>
                  <p className="text-xs text-muted-foreground mt-1">lifetime total</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </WebContextualDrawer>
    </WebAppShell>
  )
}
