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

export default function CrewsPage() {
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
      skillMatch: 85,
      equipmentMatch: 90,
      requiredSkills: [
        { name: "Pesticide Applicator", matched: true },
        { name: "Landscape Design", matched: true },
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
    {
      id: "crew-005",
      name: "Echo Team",
      leadName: "Maria Santos",
      leadPhone: "(555) 567-8901",
      leadEmail: "maria.s@lawnflow.ai",
      memberCount: 4,
      members: [
        {
          id: "m15",
          name: "Maria Santos",
          role: "Crew Lead",
          yearsExperience: 7,
          certifications: ["Pesticide Applicator", "Irrigation Specialist"],
        },
        {
          id: "m16",
          name: "Carlos Diaz",
          role: "Equipment Operator",
          yearsExperience: 5,
          certifications: ["Heavy Equipment"],
        },
        {
          id: "m17",
          name: "Anna Kim",
          role: "Landscape Technician",
          yearsExperience: 3,
          certifications: ["First Aid"],
        },
        {
          id: "m18",
          name: "Mark Johnson",
          role: "Landscape Technician",
          yearsExperience: 2,
          certifications: [],
        },
      ],
      homeBase: "202 Maple St, Anytown, USA",
      skillMatch: 90,
      equipmentMatch: 85,
      requiredSkills: [
        { name: "Pesticide Applicator", matched: true },
        { name: "Irrigation Specialist", matched: true },
      ],
      requiredEquipment: [
        { name: "Mowers", matched: true },
        { name: "Edgers", matched: true },
        { name: "Blowers", matched: true },
        { name: "Truck", matched: true },
      ],
      distanceFromBase: 4.1,
      eligibilityStatus: "conditionally_eligible",
      flags: ["partial_equipment_match"],
      capacityNext7Days: [
        { date: "Mon 1/13", available: false, utilization: 100, assignedJobs: 0 },
        { date: "Tue 1/14", available: false, utilization: 100, assignedJobs: 0 },
        { date: "Wed 1/15", available: false, utilization: 100, assignedJobs: 0 },
        { date: "Thu 1/16", available: false, utilization: 100, assignedJobs: 0 },
        { date: "Fri 1/17", available: false, utilization: 100, assignedJobs: 0 },
        { date: "Mon 1/20", available: false, utilization: 100, assignedJobs: 0 },
        { date: "Tue 1/21", available: false, utilization: 100, assignedJobs: 0 },
      ],
      specialties: ["Commercial Maintenance", "Irrigation Systems"],
      equipment: ["Mowers (2)", "Edgers (2)", "Blowers (4)", "Truck (2)"],
      avgJobRating: 4.7,
      jobsCompleted: 298,
      serviceRadius: 25,
    },
    {
      id: "crew-006",
      name: "Foxtrot Unit",
      leadName: "Daniel Wright",
      leadPhone: "(555) 678-9012",
      leadEmail: "daniel.w@lawnflow.ai",
      memberCount: 3,
      members: [
        {
          id: "m19",
          name: "Daniel Wright",
          role: "Crew Lead",
          yearsExperience: 5,
          certifications: ["Pesticide Applicator"],
        },
        {
          id: "m20",
          name: "Sophie Davis",
          role: "Equipment Operator",
          yearsExperience: 3,
          certifications: ["First Aid"],
        },
        {
          id: "m21",
          name: "Ryan Miller",
          role: "Landscape Technician",
          yearsExperience: 1,
          certifications: [],
        },
      ],
      homeBase: "303 Birch St, Anytown, USA",
      skillMatch: 100,
      equipmentMatch: 100,
      requiredSkills: [
        { name: "Pesticide Applicator", matched: true },
      ],
      requiredEquipment: [
        { name: "Mowers", matched: true },
        { name: "Edgers", matched: true },
        { name: "Blowers", matched: true },
        { name: "Truck", matched: true },
      ],
      distanceFromBase: 1.8,
      eligibilityStatus: "fully_eligible",
      flags: [],
      capacityNext7Days: [
        { date: "Mon 1/13", available: true, utilization: 70, assignedJobs: 3 },
        { date: "Tue 1/14", available: true, utilization: 60, assignedJobs: 2 },
        { date: "Wed 1/15", available: true, utilization: 50, assignedJobs: 2 },
        { date: "Thu 1/16", available: true, utilization: 80, assignedJobs: 3 },
        { date: "Fri 1/17", available: true, utilization: 40, assignedJobs: 1 },
        { date: "Mon 1/20", available: true, utilization: 60, assignedJobs: 2 },
        { date: "Tue 1/21", available: true, utilization: 70, assignedJobs: 3 },
      ],
      specialties: ["Residential Maintenance", "Seasonal Cleanup"],
      equipment: ["Mowers (2)", "Edgers (2)", "Blowers (3)", "Truck (1)"],
      avgJobRating: 4.5,
      jobsCompleted: 203,
      serviceRadius: 20,
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
    { label: string; icon: React.ReactNode; variant: "critical" | "warning" }
  > = {
    outside_service_radius: {
      label: "Outside service radius",
      icon: <MapPin className="w-4 h-4" />,
      variant: "critical",
    },
    no_available_capacity: {
      label: "No available capacity",
      icon: <Calendar className="w-4 h-4" />,
      variant: "critical",
    },
    insufficient_crew_size: {
      label: "Insufficient crew size",
      icon: <Users className="w-4 h-4" />,
      variant: "critical",
    },
    partial_skill_match: {
      label: "Partial skill match",
      icon: <Award className="w-4 h-4" />,
      variant: "warning",
    },
    partial_equipment_match: {
      label: "Partial equipment match",
      icon: <Wrench className="w-4 h-4" />,
      variant: "warning",
    },
    missing_coordinates: {
      label: "Missing GPS coordinates",
      icon: <MapPin className="w-4 h-4" />,
      variant: "warning",
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
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border ${bg} ${border}`}>
        <span className={color}>{icon}</span>
        <span className={`text-xs font-medium ${color}`}>{label}</span>
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

      {/* Crew Detail Drawer */}
      <WebContextualDrawer
        open={!!selectedCrew}
        onClose={() => setSelectedCrew(null)}
        title={selectedCrew?.name || ""}
        description={`${selectedCrew?.memberCount} members • ${selectedCrew?.jobsCompleted} jobs completed`}
        size="lg"
        footer={
          selectedCrew && (
            <div className="flex justify-between items-center">
              <WebButton variant="ghost" onClick={() => setSelectedCrew(null)}>
                Close
              </WebButton>
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
            </div>
          )
        }
      >
        {selectedCrew && (
          <div className="space-y-6">
            {/* Eligibility Summary */}
            <div>
              <h3 className="font-semibold mb-3">Eligibility Status</h3>
              <div className="space-y-3">
                {renderEligibilityStatus(selectedCrew.eligibilityStatus)}

                {selectedCrew.flags.length > 0 && (
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Active Flags</h4>
                    {selectedCrew.flags.map((flag) => {
                      const { label, icon, variant } = flagMetadata[flag]
                      const colorClass =
                        variant === "critical" ? "text-destructive" : "text-warning"

                      return (
                        <div key={flag} className="flex items-center gap-2">
                          <span className={colorClass}>{icon}</span>
                          <span className="text-sm">{label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Capability Metrics */}
            <div>
              <h3 className="font-semibold mb-3">Capability Metrics</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Skill Match</span>
                    <span className="text-sm font-semibold">{selectedCrew.skillMatch}%</span>
                  </div>
                  {renderProgressBar(selectedCrew.skillMatch, false)}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Equipment Match</span>
                    <span className="text-sm font-semibold">{selectedCrew.equipmentMatch}%</span>
                  </div>
                  {renderProgressBar(selectedCrew.equipmentMatch, false)}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Distance from Base</p>
                    <p className="text-lg font-semibold">{selectedCrew.distanceFromBase} mi</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Service Radius</p>
                    <p className="text-lg font-semibold">{selectedCrew.serviceRadius} mi</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Capacity Overview */}
            <div>
              <h3 className="font-semibold mb-3">Next 7 Business Days</h3>
              <div className="space-y-2">
                {selectedCrew.capacityNext7Days.map((day, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-muted-foreground w-16">
                      {day.date}
                    </span>
                    <div className="flex-1">
                      {renderProgressBar(day.utilization, false)}
                    </div>
                    <span className="text-xs text-muted-foreground w-20 text-right">
                      {day.available
                        ? `${day.utilization}% (${day.assignedJobs} jobs)`
                        : "Unavailable"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Crew Lead Contact */}
            <div>
              <h3 className="font-semibold mb-3">Crew Lead</h3>
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{selectedCrew.leadName}</p>
                    <p className="text-xs text-muted-foreground">Crew Lead</p>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <a
                      href={`tel:${selectedCrew.leadPhone}`}
                      className="text-primary hover:underline"
                    >
                      {selectedCrew.leadPhone}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <a
                      href={`mailto:${selectedCrew.leadEmail}`}
                      className="text-primary hover:underline"
                    >
                      {selectedCrew.leadEmail}
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Team Members */}
            <div>
              <h3 className="font-semibold mb-3">Team Members</h3>
              <div className="space-y-2">
                {selectedCrew.members.map((member) => (
                  <div key={member.id} className="bg-muted/50 rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.role}</p>
                      </div>
                      <WebBadge variant="status" status="neutral" size="sm">
                        {member.yearsExperience}y exp
                      </WebBadge>
                    </div>
                    {member.certifications.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {member.certifications.map((cert, idx) => (
                          <WebBadge
                            key={idx}
                            variant="status"
                            status="primary"
                            size="sm"
                          >
                            {cert}
                          </WebBadge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Specialties */}
            <div>
              <h3 className="font-semibold mb-3">Specialties</h3>
              <div className="flex flex-wrap gap-2">
                {selectedCrew.specialties.map((specialty, idx) => (
                  <WebBadge key={idx} variant="status" status="active" size="sm">
                    {specialty}
                  </WebBadge>
                ))}
              </div>
            </div>

            {/* Equipment */}
            <div>
              <h3 className="font-semibold mb-3">Equipment</h3>
              <div className="grid grid-cols-2 gap-2">
                {selectedCrew.equipment.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <Wrench className="w-4 h-4 text-muted-foreground" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance */}
            <div>
              <h3 className="font-semibold mb-3">Performance</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <p className="text-xs text-muted-foreground">Avg Rating</p>
                  </div>
                  <p className="text-2xl font-semibold">{selectedCrew.avgJobRating}</p>
                  <p className="text-xs text-muted-foreground mt-1">out of 5.0</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    <p className="text-xs text-muted-foreground">Jobs Completed</p>
                  </div>
                  <p className="text-2xl font-semibold">{selectedCrew.jobsCompleted}</p>
                  <p className="text-xs text-muted-foreground mt-1">lifetime</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </WebContextualDrawer>
    </WebAppShell>
  )
}