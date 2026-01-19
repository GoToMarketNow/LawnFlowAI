import * as React from "react"
import { WebAppShell } from "../components/web/app-shell"
import { WebPageHeader } from "../components/web/page-header"
import { WebButton } from "../components/web/button"
import { WebBadge } from "../components/web/badge"
import { AlertCircle, Clock, CheckCircle } from "lucide-react"

export default function PendingActionsPage() {
  const mockActions = [
    {
      id: "1",
      title: "Complete customer onboarding - Green Lawn Services",
      type: "Onboarding",
      priority: "high",
      dueDate: "Today",
      description: "Finish setup and schedule first service",
    },
    {
      id: "2",
      title: "Review pricing for commercial property",
      type: "Pricing Review",
      priority: "medium",
      dueDate: "Tomorrow",
      description: "Approve updated pricing structure",
    },
    {
      id: "3",
      title: "Update service agreement for Smith residence",
      type: "Agreement",
      priority: "low",
      dueDate: "This week",
      description: "Renew annual service contract",
    },
  ]

  return (
    <WebAppShell pageTitle="Pending Actions" userRole="ADMIN">
      <div className="h-full flex flex-col">
        <WebPageHeader
          title="Pending Actions"
          subtitle="Tasks requiring your attention"
          breadcrumbs={[
            { label: "Home", href: "/home" },
            { label: "Pending Actions" },
          ]}
        />

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-5xl space-y-4">
            {mockActions.map((action) => (
              <div
                key={action.id}
                className="bg-card border border-border rounded-lg p-6 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <AlertCircle className="w-5 h-5 text-warning shrink-0" />
                      <h3 className="font-semibold">{action.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {action.description}
                    </p>
                    <div className="flex items-center gap-3">
                      <WebBadge variant="status" status="pending">
                        {action.type}
                      </WebBadge>
                      <WebBadge
                        variant="priority"
                        priority={action.priority as "high" | "medium" | "low"}
                      >
                        {action.priority}
                      </WebBadge>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {action.dueDate}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <WebButton variant="secondary" size="sm">
                      View Details
                    </WebButton>
                    <WebButton variant="primary" size="sm">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Complete
                    </WebButton>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </WebAppShell>
  )
}
