import * as React from "react"
import { cn } from "../ui/utils"
import { WebButton } from "./button"
import { WebBadge } from "./badge"
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  Shield,
  Award,
  Wrench,
  Users,
  RefreshCw,
} from "lucide-react"

interface EligibilityThresholds {
  minSkillMatch: number
  minEquipmentMatch: number
}

interface CrewEligibilityPreview {
  crewId: string
  crewName: string
  skillMatch: number
  equipmentMatch: number
  criticalFlags: string[]
  advisoryFlags: string[]
  currentlyEligible: boolean
  willBeEligible: boolean
}

export interface WebCrewEligibilityControlProps {
  className?: string
  defaultThresholds?: EligibilityThresholds
  crewPreviews: CrewEligibilityPreview[]
  onThresholdsChange?: (thresholds: EligibilityThresholds) => void
  onApply?: (thresholds: EligibilityThresholds, acknowledged: boolean) => void
  onCancel?: () => void
}

const WebCrewEligibilityControl = React.forwardRef<
  HTMLDivElement,
  WebCrewEligibilityControlProps
>(
  (
    {
      className,
      defaultThresholds = { minSkillMatch: 100, minEquipmentMatch: 100 },
      crewPreviews,
      onThresholdsChange,
      onApply,
      onCancel,
    },
    ref
  ) => {
    const [thresholds, setThresholds] = React.useState<EligibilityThresholds>(defaultThresholds)
    const [acknowledged, setAcknowledged] = React.useState(false)

    // Calculate eligibility based on current thresholds
    const eligibilityResults = React.useMemo(() => {
      const eligible: CrewEligibilityPreview[] = []
      const excluded: CrewEligibilityPreview[] = []
      const overriddenAdvisoryFlags: string[] = []

      crewPreviews.forEach((crew) => {
        // Critical flags always block
        if (crew.criticalFlags.length > 0) {
          excluded.push({ ...crew, willBeEligible: false })
          return
        }

        // Check if crew meets adjusted thresholds
        const meetsSkillThreshold = crew.skillMatch >= thresholds.minSkillMatch
        const meetsEquipmentThreshold = crew.equipmentMatch >= thresholds.minEquipmentMatch

        if (meetsSkillThreshold && meetsEquipmentThreshold) {
          eligible.push({ ...crew, willBeEligible: true })
          
          // Track which advisory flags are being overridden
          crew.advisoryFlags.forEach((flag) => {
            if (!overriddenAdvisoryFlags.includes(flag)) {
              overriddenAdvisoryFlags.push(flag)
            }
          })
        } else {
          excluded.push({ ...crew, willBeEligible: false })
        }
      })

      return {
        eligible,
        excluded,
        overriddenAdvisoryFlags,
        totalCrews: crewPreviews.length,
        eligibleCount: eligible.length,
        excludedCount: excluded.length,
        changedFromDefault: 
          thresholds.minSkillMatch < defaultThresholds.minSkillMatch ||
          thresholds.minEquipmentMatch < defaultThresholds.minEquipmentMatch,
      }
    }, [thresholds, crewPreviews, defaultThresholds])

    // Notify parent of threshold changes
    React.useEffect(() => {
      onThresholdsChange?.(thresholds)
    }, [thresholds, onThresholdsChange])

    const handleSliderChange = (type: "skill" | "equipment", value: number) => {
      setThresholds((prev) => ({
        ...prev,
        minSkillMatch: type === "skill" ? value : prev.minSkillMatch,
        minEquipmentMatch: type === "equipment" ? value : prev.minEquipmentMatch,
      }))
      // Reset acknowledgment when thresholds change
      setAcknowledged(false)
    }

    const handleReset = () => {
      setThresholds(defaultThresholds)
      setAcknowledged(false)
    }

    const handleApply = () => {
      onApply?.(thresholds, acknowledged)
    }

    const requiresAcknowledgment = eligibilityResults.changedFromDefault

    return (
      <div ref={ref} className={cn("space-y-6", className)}>
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Eligibility Rules
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Adjust thresholds to include more crews. Critical safety flags cannot be overridden.
            </p>
          </div>
          <WebButton
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={
              thresholds.minSkillMatch === defaultThresholds.minSkillMatch &&
              thresholds.minEquipmentMatch === defaultThresholds.minEquipmentMatch
            }
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset to Default
          </WebButton>
        </div>

        {/* Threshold Controls */}
        <div className="space-y-6">
          {/* Skill Match Slider */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-primary" />
                <label className="text-sm font-medium">Minimum Skill Match</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={thresholds.minSkillMatch}
                  onChange={(e) => {
                    const value = Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                    handleSliderChange("skill", value)
                  }}
                  className="w-16 px-2 py-1 text-sm text-right border border-border rounded-md bg-input-background"
                  min="0"
                  max="100"
                />
                <span className="text-sm font-semibold text-muted-foreground">%</span>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={thresholds.minSkillMatch}
              onChange={(e) => handleSliderChange("skill", parseInt(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
            {thresholds.minSkillMatch < 100 && (
              <div className="mt-3 p-2 bg-warning/10 border border-warning/20 rounded-md">
                <p className="text-xs text-warning flex items-start gap-2">
                  <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>
                    Lowering skill requirements may result in crews lacking critical certifications. Additional oversight may be required.
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Equipment Match Slider */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-primary" />
                <label className="text-sm font-medium">Minimum Equipment Match</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={thresholds.minEquipmentMatch}
                  onChange={(e) => {
                    const value = Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                    handleSliderChange("equipment", value)
                  }}
                  className="w-16 px-2 py-1 text-sm text-right border border-border rounded-md bg-input-background"
                  min="0"
                  max="100"
                />
                <span className="text-sm font-semibold text-muted-foreground">%</span>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={thresholds.minEquipmentMatch}
              onChange={(e) => handleSliderChange("equipment", parseInt(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
            {thresholds.minEquipmentMatch < 100 && (
              <div className="mt-3 p-2 bg-warning/10 border border-warning/20 rounded-md">
                <p className="text-xs text-warning flex items-start gap-2">
                  <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span>
                    Crews may need to rent or borrow equipment, potentially causing delays and increasing costs.
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Live Preview */}
        <div className="border border-border rounded-lg p-4 bg-muted/30">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Live Preview
          </h4>
          
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-success/10 border border-success/20 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Eligible Crews</p>
              <p className="text-2xl font-bold text-success">{eligibilityResults.eligibleCount}</p>
              {eligibilityResults.eligibleCount > 0 && eligibilityResults.changedFromDefault && (
                <p className="text-xs text-success mt-1">
                  +{eligibilityResults.eligibleCount - crewPreviews.filter(c => c.currentlyEligible).length} more
                </p>
              )}
            </div>
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Excluded Crews</p>
              <p className="text-2xl font-bold text-destructive">{eligibilityResults.excludedCount}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {eligibilityResults.excluded.filter(c => c.criticalFlags.length > 0).length} with critical flags
              </p>
            </div>
          </div>

          {/* Overridden Advisory Flags */}
          {eligibilityResults.overriddenAdvisoryFlags.length > 0 && (
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
              <p className="text-xs font-medium text-warning mb-2 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5" />
                Advisory Flags Being Overridden
              </p>
              <div className="flex flex-wrap gap-1">
                {eligibilityResults.overriddenAdvisoryFlags.map((flag, idx) => (
                  <WebBadge key={idx} variant="status" status="warning" size="sm">
                    {flag.replace(/_/g, " ")}
                  </WebBadge>
                ))}
              </div>
            </div>
          )}

          {/* Critical Flags Still Blocking */}
          {eligibilityResults.excluded.some(c => c.criticalFlags.length > 0) && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mt-3">
              <p className="text-xs font-medium text-destructive mb-2 flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" />
                Critical Flags Cannot Be Overridden
              </p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-destructive" />
                  Outside service radius
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-destructive" />
                  No available capacity
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-destructive" />
                  Insufficient crew size
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Crew List Preview */}
        <div>
          <h4 className="text-sm font-semibold mb-2">Crew Status Changes</h4>
          <div className="max-h-48 overflow-y-auto space-y-2 border border-border rounded-lg p-3 bg-card">
            {crewPreviews.map((crew) => {
              const result = eligibilityResults.eligible.find(c => c.crewId === crew.crewId) ||
                            eligibilityResults.excluded.find(c => c.crewId === crew.crewId)
              const willBeEligible = result?.willBeEligible ?? false
              const statusChanged = crew.currentlyEligible !== willBeEligible

              return (
                <div
                  key={crew.crewId}
                  className={cn(
                    "flex items-center justify-between p-2 rounded-md text-sm",
                    willBeEligible ? "bg-success/5" : "bg-muted/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {willBeEligible ? (
                      <CheckCircle2 className="w-4 h-4 text-success" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className={willBeEligible ? "font-medium" : "text-muted-foreground"}>
                      {crew.crewName}
                    </span>
                    {statusChanged && (
                      <WebBadge variant="status" status={willBeEligible ? "success" : "neutral"} size="sm">
                        {willBeEligible ? "Now Eligible" : "Now Excluded"}
                      </WebBadge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">
                      {crew.skillMatch}% / {crew.equipmentMatch}%
                    </span>
                    {crew.criticalFlags.length > 0 && (
                      <div className="flex items-center gap-1 text-destructive" title="Critical flags">
                        <Shield className="w-3 h-3" />
                        <span>{crew.criticalFlags.length}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Acknowledgment Checkbox */}
        {requiresAcknowledgment && (
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="acknowledge"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-warning text-warning focus:ring-warning"
              />
              <label htmlFor="acknowledge" className="text-sm flex-1 cursor-pointer">
                <span className="font-medium text-foreground">I understand the risks</span>
                <p className="text-xs text-muted-foreground mt-1">
                  By lowering eligibility thresholds, I acknowledge that assigned crews may lack optimal skills or equipment, which could impact job quality, safety, or completion time. I accept responsibility for additional oversight.
                </p>
              </label>
            </div>
          </div>
        )}

        {/* Info Banner */}
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
          <div className="flex items-start gap-2 text-sm">
            <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-muted-foreground">
              <span className="font-medium text-primary">Tip:</span> Adjusting thresholds helps during peak seasons or when preferred crews are unavailable. The system will still recommend the most qualified crews first.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <WebButton variant="ghost" onClick={onCancel}>
            Cancel
          </WebButton>
          <WebButton
            variant="primary"
            onClick={handleApply}
            disabled={requiresAcknowledgment && !acknowledged}
          >
            {requiresAcknowledgment && !acknowledged ? (
              <>
                <AlertTriangle className="w-4 h-4 mr-2" />
                Acknowledge to Apply
              </>
            ) : (
              <>
                Apply Thresholds ({eligibilityResults.eligibleCount} eligible)
              </>
            )}
          </WebButton>
        </div>
      </div>
    )
  }
)

WebCrewEligibilityControl.displayName = "WebCrewEligibilityControl"

export { WebCrewEligibilityControl }
