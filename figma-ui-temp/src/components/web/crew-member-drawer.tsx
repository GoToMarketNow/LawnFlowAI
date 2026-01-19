import * as React from "react"
import { cn } from "../ui/utils"
import { WebButton } from "./button"
import { WebBadge } from "./badge"
import { WebContextualDrawer } from "./contextual-drawer"
import {
  User,
  Phone,
  Mail,
  MapPin,
  Globe,
  Calendar,
  Users,
  Award,
  DollarSign,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Edit,
  UserX,
  QrCode,
  Send,
  ChevronDown,
  ChevronUp,
  FileText,
  Shield,
  TrendingUp,
  Wrench,
} from "lucide-react"

type MemberStatus = "active" | "invited" | "pending" | "inactive"
type PayType = "hourly" | "daily" | "per_job" | "percentage"
type PaymentMethod = "ach" | "check" | "cash"
type SkillProficiency = "beginner" | "intermediate" | "expert"

interface EmergencyContact {
  name: string
  relationship: string
  phone: string
}

interface Certification {
  name: string
  expiryDate?: string
}

interface CrewInfo {
  id: string
  name: string
  leader: string
  size: number
  serviceArea: string
}

interface Skill {
  name: string
  proficiency: SkillProficiency
}

interface PayrollSetup {
  payType: PayType
  // Hourly specific
  hourlyRate?: number
  overtimeEligible?: boolean
  // Daily specific
  dayRate?: number
  // Per job specific
  jobRateDefault?: number
  perServiceOverrides?: { service: string; rate: number }[]
  // Percentage specific
  percentRate?: number
  eligibleServices?: string[]
  // Common
  paymentMethod: PaymentMethod
  w9Collected: boolean
}

export interface CrewMemberData {
  id: string
  firstName: string
  lastName: string
  fullName: string
  status: MemberStatus
  phone: string
  email?: string
  address?: string
  preferredLanguage: string
  startDate: string
  notes?: string
  emergencyContact?: EmergencyContact
  crewAssignment?: CrewInfo
  allowTemporaryAssignment: boolean
  skills: Skill[]
  certifications: Certification[]
  payrollSetup: PayrollSetup
}

export interface WebCrewMemberDrawerProps {
  open: boolean
  onClose: () => void
  member: CrewMemberData | null
  onSave?: (member: CrewMemberData) => void
  onDeactivate?: (memberId: string) => void
  onResendInvite?: (memberId: string) => void
  availableCrews?: CrewInfo[]
}

const WebCrewMemberDrawer = React.forwardRef<HTMLDivElement, WebCrewMemberDrawerProps>(
  ({ open, onClose, member, onSave, onDeactivate, onResendInvite, availableCrews = [] }, ref) => {
    const [editedMember, setEditedMember] = React.useState<CrewMemberData | null>(null)
    const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
      new Set(["contact", "emergency", "crew", "skills", "payroll"])
    )
    const [showCrewChangeConfirm, setShowCrewChangeConfirm] = React.useState(false)
    const [pendingCrewChange, setPendingCrewChange] = React.useState<string | null>(null)

    // Initialize edited member when drawer opens
    React.useEffect(() => {
      if (member) {
        setEditedMember({ ...member })
      }
    }, [member])

    if (!member || !editedMember) return null

    const toggleSection = (section: string) => {
      setExpandedSections((prev) => {
        const next = new Set(prev)
        if (next.has(section)) {
          next.delete(section)
        } else {
          next.add(section)
        }
        return next
      })
    }

    const handleSave = () => {
      onSave?.(editedMember)
      onClose()
    }

    const handleCrewChange = (crewId: string) => {
      if (crewId === editedMember.crewAssignment?.id) return
      setPendingCrewChange(crewId)
      setShowCrewChangeConfirm(true)
    }

    const confirmCrewChange = () => {
      if (pendingCrewChange) {
        const newCrew = availableCrews.find((c) => c.id === pendingCrewChange)
        if (newCrew) {
          setEditedMember({ ...editedMember, crewAssignment: newCrew })
        }
      }
      setShowCrewChangeConfirm(false)
      setPendingCrewChange(null)
    }

    const renderStatus = (status: MemberStatus) => {
      const config = {
        active: { label: "Active", status: "success" as const },
        invited: { label: "Invited", status: "pending" as const },
        pending: { label: "Pending", status: "warning" as const },
        inactive: { label: "Inactive", status: "neutral" as const },
      }
      const { label, status: badgeStatus } = config[status]
      return <WebBadge variant="status" status={badgeStatus}>{label}</WebBadge>
    }

    const hasValidPayroll = () => {
      const { payType, hourlyRate, dayRate, jobRateDefault, percentRate, w9Collected } = editedMember.payrollSetup
      
      if (!w9Collected) return false
      
      switch (payType) {
        case "hourly":
          return !!hourlyRate && hourlyRate > 0
        case "daily":
          return !!dayRate && dayRate > 0
        case "per_job":
          return !!jobRateDefault && jobRateDefault > 0
        case "percentage":
          return !!percentRate && percentRate > 0
        default:
          return false
      }
    }

    const proficiencyColors = {
      beginner: "neutral" as const,
      intermediate: "pending" as const,
      expert: "success" as const,
    }

    return (
      <>
        <WebContextualDrawer
          ref={ref}
          open={open}
          onClose={onClose}
          size="lg"
          title=""
          description=""
        >
          <div className="space-y-4">
            {/* Header Section - Always Visible */}
            <div className="border-b border-border pb-4">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-semibold flex-shrink-0">
                  {member.firstName[0]}{member.lastName[0]}
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-semibold mb-1">{member.fullName}</h2>
                  <div className="flex items-center gap-2 mb-3">
                    {renderStatus(member.status)}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <WebButton variant="secondary" size="sm">
                      <Edit className="w-3.5 h-3.5 mr-1.5" />
                      Edit Profile
                    </WebButton>
                    {member.status === "invited" && (
                      <WebButton
                        variant="secondary"
                        size="sm"
                        onClick={() => onResendInvite?.(member.id)}
                      >
                        <Send className="w-3.5 h-3.5 mr-1.5" />
                        Resend Invite
                      </WebButton>
                    )}
                    <WebButton variant="secondary" size="sm">
                      <QrCode className="w-3.5 h-3.5 mr-1.5" />
                      Print QR
                    </WebButton>
                    <WebButton
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeactivate?.(member.id)}
                    >
                      <UserX className="w-3.5 h-3.5 mr-1.5" />
                      {member.status === "inactive" ? "Reactivate" : "Deactivate"}
                    </WebButton>
                  </div>
                </div>
              </div>
            </div>

            {/* 1. Contact Info Section */}
            <div className="border border-border rounded-lg">
              <button
                onClick={() => toggleSection("contact")}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold">Contact Information</h3>
                </div>
                {expandedSections.has("contact") ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>

              {expandedSections.has("contact") && (
                <div className="p-4 pt-0 space-y-4">
                  {/* Phone - Required */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">
                      Phone <span className="text-destructive">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <input
                        type="tel"
                        value={editedMember.phone}
                        onChange={(e) =>
                          setEditedMember({ ...editedMember, phone: e.target.value })
                        }
                        className="flex-1 px-3 py-2 bg-input-background border border-border rounded-md text-sm"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>

                  {/* Email - Optional */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Email (optional)</label>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <input
                        type="email"
                        value={editedMember.email || ""}
                        onChange={(e) =>
                          setEditedMember({ ...editedMember, email: e.target.value })
                        }
                        className="flex-1 px-3 py-2 bg-input-background border border-border rounded-md text-sm"
                        placeholder="member@email.com"
                      />
                    </div>
                  </div>

                  {/* Address - Optional */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Address (optional)</label>
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground mt-2.5" />
                      <textarea
                        value={editedMember.address || ""}
                        onChange={(e) =>
                          setEditedMember({ ...editedMember, address: e.target.value })
                        }
                        className="flex-1 px-3 py-2 bg-input-background border border-border rounded-md text-sm"
                        rows={2}
                        placeholder="123 Main St, City, State 12345"
                      />
                    </div>
                  </div>

                  {/* Preferred Language */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Preferred Language</label>
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      <select
                        value={editedMember.preferredLanguage}
                        onChange={(e) =>
                          setEditedMember({ ...editedMember, preferredLanguage: e.target.value })
                        }
                        className="flex-1 px-3 py-2 bg-input-background border border-border rounded-md text-sm"
                      >
                        <option value="English">English</option>
                        <option value="Spanish">Spanish</option>
                        <option value="French">French</option>
                        <option value="Portuguese">Portuguese</option>
                      </select>
                    </div>
                  </div>

                  {/* Start Date */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Start Date</label>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <input
                        type="date"
                        value={editedMember.startDate}
                        onChange={(e) =>
                          setEditedMember({ ...editedMember, startDate: e.target.value })
                        }
                        className="flex-1 px-3 py-2 bg-input-background border border-border rounded-md text-sm"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Notes</label>
                    <textarea
                      value={editedMember.notes || ""}
                      onChange={(e) =>
                        setEditedMember({ ...editedMember, notes: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm"
                      rows={3}
                      placeholder="Any additional notes about this crew member..."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 2. Emergency Contact Section */}
            <div className="border border-border rounded-lg">
              <button
                onClick={() => toggleSection("emergency")}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold">Emergency Contact</h3>
                  {!editedMember.emergencyContact && (
                    <WebBadge variant="status" status="warning" size="sm">
                      Missing
                    </WebBadge>
                  )}
                </div>
                {expandedSections.has("emergency") ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>

              {expandedSections.has("emergency") && (
                <div className="p-4 pt-0 space-y-4">
                  {!editedMember.emergencyContact && (
                    <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 mb-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-warning mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-warning">
                            No emergency contact on file
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            It's highly recommended to collect emergency contact information for safety purposes.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Contact Name</label>
                    <input
                      type="text"
                      value={editedMember.emergencyContact?.name || ""}
                      onChange={(e) =>
                        setEditedMember({
                          ...editedMember,
                          emergencyContact: {
                            ...editedMember.emergencyContact,
                            name: e.target.value,
                            phone: editedMember.emergencyContact?.phone || "",
                            relationship: editedMember.emergencyContact?.relationship || "",
                          },
                        })
                      }
                      className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm"
                      placeholder="Full name"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Relationship</label>
                    <select
                      value={editedMember.emergencyContact?.relationship || ""}
                      onChange={(e) =>
                        setEditedMember({
                          ...editedMember,
                          emergencyContact: {
                            ...editedMember.emergencyContact,
                            name: editedMember.emergencyContact?.name || "",
                            phone: editedMember.emergencyContact?.phone || "",
                            relationship: e.target.value,
                          },
                        })
                      }
                      className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm"
                    >
                      <option value="">Select relationship</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Parent">Parent</option>
                      <option value="Sibling">Sibling</option>
                      <option value="Child">Child</option>
                      <option value="Friend">Friend</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Phone Number</label>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <input
                        type="tel"
                        value={editedMember.emergencyContact?.phone || ""}
                        onChange={(e) =>
                          setEditedMember({
                            ...editedMember,
                            emergencyContact: {
                              ...editedMember.emergencyContact,
                              name: editedMember.emergencyContact?.name || "",
                              relationship: editedMember.emergencyContact?.relationship || "",
                              phone: e.target.value,
                            },
                          })
                        }
                        className="flex-1 px-3 py-2 bg-input-background border border-border rounded-md text-sm"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Crew Assignment Section */}
            <div className="border border-border rounded-lg">
              <button
                onClick={() => toggleSection("crew")}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold">Crew Assignment</h3>
                  {!editedMember.crewAssignment && (
                    <WebBadge variant="status" status="neutral" size="sm">
                      Unassigned
                    </WebBadge>
                  )}
                </div>
                {expandedSections.has("crew") ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>

              {expandedSections.has("crew") && (
                <div className="p-4 pt-0 space-y-4">
                  {/* Current Crew Selection */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Current Crew</label>
                    <select
                      value={editedMember.crewAssignment?.id || ""}
                      onChange={(e) => handleCrewChange(e.target.value)}
                      className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm"
                    >
                      <option value="">Unassigned</option>
                      {availableCrews.map((crew) => (
                        <option key={crew.id} value={crew.id}>
                          {crew.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Crew Details */}
                  {editedMember.crewAssignment && (
                    <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Crew Leader</span>
                        <span className="text-sm font-medium">
                          {editedMember.crewAssignment.leader}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Crew Size</span>
                        <span className="text-sm font-medium">
                          {editedMember.crewAssignment.size} members
                        </span>
                      </div>
                      <div className="flex items-start justify-between">
                        <span className="text-xs text-muted-foreground">Service Area</span>
                        <span className="text-sm font-medium text-right">
                          {editedMember.crewAssignment.serviceArea}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Temporary Assignment Toggle */}
                  <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                    <input
                      type="checkbox"
                      id="temp-assignment"
                      checked={editedMember.allowTemporaryAssignment}
                      onChange={(e) =>
                        setEditedMember({
                          ...editedMember,
                          allowTemporaryAssignment: e.target.checked,
                        })
                      }
                      className="mt-0.5 w-4 h-4 rounded border-border"
                    />
                    <div className="flex-1">
                      <label
                        htmlFor="temp-assignment"
                        className="text-sm font-medium cursor-pointer block"
                      >
                        Allow temporary assignment
                      </label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Enables quick reassignment for daily scheduling without changing primary crew
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Skills & Certifications Section */}
            <div className="border border-border rounded-lg">
              <button
                onClick={() => toggleSection("skills")}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold">Skills & Certifications</h3>
                  <WebBadge variant="status" status="neutral" size="sm">
                    {editedMember.skills.length} skills
                  </WebBadge>
                </div>
                {expandedSections.has("skills") ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>

              {expandedSections.has("skills") && (
                <div className="p-4 pt-0 space-y-4">
                  {/* Info Banner */}
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <TrendingUp className="w-4 h-4 text-primary mt-0.5" />
                      <p className="text-xs text-muted-foreground">
                        Skills drive crew eligibility for jobs and agent recommendations. More skilled members get priority assignments.
                      </p>
                    </div>
                  </div>

                  {/* Skills List */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Skills</label>
                    <div className="space-y-2">
                      {editedMember.skills.map((skill, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Wrench className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm flex-1">{skill.name}</span>
                          <select
                            value={skill.proficiency}
                            onChange={(e) => {
                              const newSkills = [...editedMember.skills]
                              newSkills[idx].proficiency = e.target.value as SkillProficiency
                              setEditedMember({ ...editedMember, skills: newSkills })
                            }}
                            className="px-2 py-1 text-xs bg-input-background border border-border rounded-md"
                          >
                            <option value="beginner">Beginner</option>
                            <option value="intermediate">Intermediate</option>
                            <option value="expert">Expert</option>
                          </select>
                          <WebBadge
                            variant="status"
                            status={proficiencyColors[skill.proficiency]}
                            size="sm"
                          >
                            {skill.proficiency}
                          </WebBadge>
                        </div>
                      ))}
                    </div>
                    <WebButton variant="ghost" size="sm" className="mt-2">
                      + Add Skill
                    </WebButton>
                  </div>

                  {/* Certifications */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Certifications</label>
                    <div className="space-y-2">
                      {editedMember.certifications.map((cert, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 bg-muted/30 rounded-md"
                        >
                          <div className="flex items-center gap-2">
                            <Award className="w-3.5 h-3.5 text-success" />
                            <span className="text-sm">{cert.name}</span>
                          </div>
                          {cert.expiryDate && (
                            <span className="text-xs text-muted-foreground">
                              Expires: {new Date(cert.expiryDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    <WebButton variant="ghost" size="sm" className="mt-2">
                      + Add Certification
                    </WebButton>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Payroll Setup Section */}
            <div className="border border-border rounded-lg">
              <button
                onClick={() => toggleSection("payroll")}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold">Payroll Setup</h3>
                  {!hasValidPayroll() && (
                    <WebBadge variant="status" status="warning" size="sm">
                      Incomplete
                    </WebBadge>
                  )}
                </div>
                {expandedSections.has("payroll") ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>

              {expandedSections.has("payroll") && (
                <div className="p-4 pt-0 space-y-4">
                  {/* Warning Banner */}
                  {!hasValidPayroll() && (
                    <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-warning mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-warning">
                            Payroll setup incomplete
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Member needs pay type, rate, and W-9 form to receive payment.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pay Type Selector */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">
                      Pay Type <span className="text-destructive">*</span>
                    </label>
                    <select
                      value={editedMember.payrollSetup.payType}
                      onChange={(e) =>
                        setEditedMember({
                          ...editedMember,
                          payrollSetup: {
                            ...editedMember.payrollSetup,
                            payType: e.target.value as PayType,
                          },
                        })
                      }
                      className="w-full px-3 py-2 bg-input-background border border-border rounded-md text-sm"
                    >
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="per_job">Per Job</option>
                      <option value="percentage">% of Job</option>
                    </select>
                  </div>

                  {/* Dynamic Fields Based on Pay Type */}
                  {editedMember.payrollSetup.payType === "hourly" && (
                    <>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">
                          Hourly Rate <span className="text-destructive">*</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={editedMember.payrollSetup.hourlyRate || ""}
                            onChange={(e) =>
                              setEditedMember({
                                ...editedMember,
                                payrollSetup: {
                                  ...editedMember.payrollSetup,
                                  hourlyRate: parseFloat(e.target.value),
                                },
                              })
                            }
                            className="flex-1 px-3 py-2 bg-input-background border border-border rounded-md text-sm"
                            placeholder="25.00"
                          />
                          <span className="text-sm text-muted-foreground">/hr</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                        <input
                          type="checkbox"
                          id="overtime"
                          checked={editedMember.payrollSetup.overtimeEligible || false}
                          onChange={(e) =>
                            setEditedMember({
                              ...editedMember,
                              payrollSetup: {
                                ...editedMember.payrollSetup,
                                overtimeEligible: e.target.checked,
                              },
                            })
                          }
                          className="mt-0.5 w-4 h-4 rounded border-border"
                        />
                        <label htmlFor="overtime" className="text-sm cursor-pointer">
                          Eligible for overtime (1.5x rate after 40 hours)
                        </label>
                      </div>
                    </>
                  )}

                  {editedMember.payrollSetup.payType === "daily" && (
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        Daily Rate <span className="text-destructive">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">$</span>
                        <input
                          type="number"
                          step="1"
                          value={editedMember.payrollSetup.dayRate || ""}
                          onChange={(e) =>
                            setEditedMember({
                              ...editedMember,
                              payrollSetup: {
                                ...editedMember.payrollSetup,
                                dayRate: parseFloat(e.target.value),
                              },
                            })
                          }
                          className="flex-1 px-3 py-2 bg-input-background border border-border rounded-md text-sm"
                          placeholder="200"
                        />
                        <span className="text-sm text-muted-foreground">/day</span>
                      </div>
                    </div>
                  )}

                  {editedMember.payrollSetup.payType === "per_job" && (
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">
                        Default Job Rate <span className="text-destructive">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">$</span>
                        <input
                          type="number"
                          step="1"
                          value={editedMember.payrollSetup.jobRateDefault || ""}
                          onChange={(e) =>
                            setEditedMember({
                              ...editedMember,
                              payrollSetup: {
                                ...editedMember.payrollSetup,
                                jobRateDefault: parseFloat(e.target.value),
                              },
                            })
                          }
                          className="flex-1 px-3 py-2 bg-input-background border border-border rounded-md text-sm"
                          placeholder="150"
                        />
                        <span className="text-sm text-muted-foreground">/job</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Can be overridden per service type
                      </p>
                    </div>
                  )}

                  {editedMember.payrollSetup.payType === "percentage" && (
                    <>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">
                          Percentage Rate <span className="text-destructive">*</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="100"
                            value={editedMember.payrollSetup.percentRate || ""}
                            onChange={(e) =>
                              setEditedMember({
                                ...editedMember,
                                payrollSetup: {
                                  ...editedMember.payrollSetup,
                                  percentRate: parseFloat(e.target.value),
                                },
                              })
                            }
                            className="flex-1 px-3 py-2 bg-input-background border border-border rounded-md text-sm"
                            placeholder="15"
                          />
                          <span className="text-sm text-muted-foreground">% of job value</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">
                          Eligible Services
                        </label>
                        <p className="text-xs text-muted-foreground mb-2">
                          Select which services this percentage applies to
                        </p>
                        <div className="space-y-1.5">
                          {["Mowing", "Fertilization", "Aeration", "Cleanup"].map((service) => (
                            <label key={service} className="flex items-center gap-2 text-sm">
                              <input type="checkbox" className="rounded border-border" />
                              {service}
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Payment Method */}
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Payment Method</label>
                    <div className="space-y-2">
                      {[
                        { value: "ach" as PaymentMethod, label: "ACH / Direct Deposit" },
                        { value: "check" as PaymentMethod, label: "Paper Check" },
                        { value: "cash" as PaymentMethod, label: "Cash" },
                      ].map((method) => (
                        <label
                          key={method.value}
                          className="flex items-center gap-2 text-sm cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="payment-method"
                            checked={editedMember.payrollSetup.paymentMethod === method.value}
                            onChange={() =>
                              setEditedMember({
                                ...editedMember,
                                payrollSetup: {
                                  ...editedMember.payrollSetup,
                                  paymentMethod: method.value,
                                },
                              })
                            }
                            className="rounded-full border-border"
                          />
                          {method.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Tax Form Status */}
                  <div className="border-t border-border pt-4">
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">W-9 Tax Form</span>
                      </div>
                      {editedMember.payrollSetup.w9Collected ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-success" />
                          <span className="text-sm text-success">Collected</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-destructive" />
                          <span className="text-sm text-destructive">Not Collected</span>
                        </div>
                      )}
                    </div>
                    {!editedMember.payrollSetup.w9Collected && (
                      <WebButton variant="secondary" size="sm" className="mt-2 w-full">
                        Upload W-9 Form
                      </WebButton>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="sticky bottom-0 bg-card border-t border-border p-4 mt-6 -mx-6 -mb-6 flex items-center justify-between">
            <WebButton variant="ghost" onClick={onClose}>
              Cancel
            </WebButton>
            <div className="flex gap-2">
              <WebButton
                variant="destructive"
                onClick={() => {
                  onDeactivate?.(member.id)
                  onClose()
                }}
              >
                {member.status === "inactive" ? "Reactivate Member" : "Deactivate Member"}
              </WebButton>
              <WebButton variant="primary" onClick={handleSave}>
                Save Changes
              </WebButton>
            </div>
          </div>
        </WebContextualDrawer>

        {/* Crew Change Confirmation Modal */}
        {showCrewChangeConfirm && (
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-center justify-center"
            onClick={() => setShowCrewChangeConfirm(false)}
          >
            <div
              className="bg-card border border-border rounded-lg p-6 max-w-md mx-4 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-warning" />
                Confirm Crew Change
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Are you sure you want to move <strong>{member.fullName}</strong> to a different crew? This will update their primary assignment.
              </p>
              <div className="flex justify-end gap-2">
                <WebButton variant="ghost" onClick={() => setShowCrewChangeConfirm(false)}>
                  Cancel
                </WebButton>
                <WebButton variant="primary" onClick={confirmCrewChange}>
                  Confirm Change
                </WebButton>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }
)

WebCrewMemberDrawer.displayName = "WebCrewMemberDrawer"

export { WebCrewMemberDrawer }