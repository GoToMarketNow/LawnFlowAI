import * as React from "react"
import { WebAppShell } from "../../components/web/app-shell"
import { WebPageHeader } from "../../components/web/page-header"
import { WebCrewEligibilityControl } from "../../components/web/crew-eligibility-control"
import { WebContextualDrawer } from "../../components/web/contextual-drawer"
import { WebButton } from "../../components/web/button"
import { Briefcase } from "lucide-react"

export default function CrewEligibilityDemoPage() {
  const [showControl, setShowControl] = React.useState(false)

  // Mock crew data for the preview
  const mockCrewPreviews = [
    {
      crewId: "crew-001",
      crewName: "Alpha Team",
      skillMatch: 100,
      equipmentMatch: 100,
      criticalFlags: [],
      advisoryFlags: [],
      currentlyEligible: true,
      willBeEligible: true,
    },
    {
      crewId: "crew-002",
      crewName: "Bravo Squad",
      skillMatch: 85,
      equipmentMatch: 90,
      criticalFlags: [],
      advisoryFlags: ["partial_skill_match"],
      currentlyEligible: false,
      willBeEligible: false,
    },
    {
      crewId: "crew-003",
      crewName: "Charlie Crew",
      skillMatch: 100,
      equipmentMatch: 75,
      criticalFlags: [],
      advisoryFlags: ["partial_equipment_match"],
      currentlyEligible: false,
      willBeEligible: false,
    },
    {
      crewId: "crew-004",
      crewName: "Delta Force",
      skillMatch: 70,
      equipmentMatch: 80,
      criticalFlags: ["outside_service_radius", "insufficient_crew_size"],
      advisoryFlags: ["partial_skill_match"],
      currentlyEligible: false,
      willBeEligible: false,
    },
    {
      crewId: "crew-005",
      crewName: "Echo Team",
      skillMatch: 90,
      equipmentMatch: 85,
      criticalFlags: [],
      advisoryFlags: ["partial_equipment_match"],
      currentlyEligible: false,
      willBeEligible: false,
    },
    {
      crewId: "crew-006",
      crewName: "Foxtrot Unit",
      skillMatch: 100,
      equipmentMatch: 100,
      criticalFlags: [],
      advisoryFlags: [],
      currentlyEligible: true,
      willBeEligible: true,
    },
  ]

  const handleApply = (thresholds: any, acknowledged: boolean) => {
    console.log("Applied thresholds:", thresholds, "Acknowledged:", acknowledged)
    setShowControl(false)
  }

  return (
    <WebAppShell
      pageTitle="Crew Eligibility Control Demo"
      userRole="ADMIN"
      userName="John Smith"
      userEmail="john@lawnflow.ai"
    >
      <div className="p-6">
        <WebPageHeader
          title="Crew Eligibility Control"
          description="Safely adjust eligibility thresholds during job assignment"
        />

        <div className="mt-6 max-w-3xl">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Briefcase className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Job: Large Commercial Maintenance</h3>
                <p className="text-sm text-muted-foreground">
                  Client: Riverside Business Park • Est. Duration: 240 minutes
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Currently, only 2 of 6 crews meet the default 100% skill and equipment match requirements.
                </p>
              </div>
            </div>

            <WebButton variant="primary" onClick={() => setShowControl(true)}>
              Adjust Eligibility Thresholds
            </WebButton>
          </div>

          <div className="mt-6 bg-muted/30 border border-border rounded-lg p-6">
            <h3 className="font-semibold mb-3">Component Features</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                <span>
                  <strong className="text-foreground">Real-time Preview:</strong> See how many crews become eligible as you adjust thresholds
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                <span>
                  <strong className="text-foreground">Critical Flag Protection:</strong> Crews with safety issues (outside radius, no capacity, insufficient size) cannot be overridden
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                <span>
                  <strong className="text-foreground">Advisory Flag Visibility:</strong> See which warnings are being overridden (skill/equipment gaps)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                <span>
                  <strong className="text-foreground">Explicit Acknowledgment:</strong> Requires checkbox confirmation when lowering standards
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                <span>
                  <strong className="text-foreground">Contextual Warnings:</strong> Shows specific risks for each threshold reduction
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                <span>
                  <strong className="text-foreground">Crew Status List:</strong> See exactly which crews change status and why
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Eligibility Control Drawer */}
      <WebContextualDrawer
        open={showControl}
        onClose={() => setShowControl(false)}
        title="Adjust Crew Eligibility"
        description="Modify thresholds to include more crews for this job"
        size="lg"
      >
        <WebCrewEligibilityControl
          defaultThresholds={{ minSkillMatch: 100, minEquipmentMatch: 100 }}
          crewPreviews={mockCrewPreviews}
          onApply={handleApply}
          onCancel={() => setShowControl(false)}
        />
      </WebContextualDrawer>
    </WebAppShell>
  )
}
