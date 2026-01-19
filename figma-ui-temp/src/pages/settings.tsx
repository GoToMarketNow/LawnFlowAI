import * as React from "react"
import { WebAppShell } from "../components/web/app-shell"
import { WebPageHeader } from "../components/web/page-header"
import { WebTabbedLayout } from "../components/web/tabbed-layout"
import { Settings, Users, Zap, Bot } from "lucide-react"

export default function SettingsPage() {
  const tabs = [
    {
      id: "general",
      label: "General",
      content: (
        <div className="p-6">
          <div className="max-w-2xl space-y-6">
            <div>
              <h3 className="font-semibold mb-4">Company Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Company Name</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-input-background border border-border rounded-lg"
                    defaultValue="LawnFlow Services"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    className="w-full px-4 py-2 bg-input-background border border-border rounded-lg"
                    defaultValue="contact@lawnflow.ai"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "users",
      label: "Users",
      content: (
        <div className="p-6">
          <div className="bg-card border border-border rounded-lg p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">User Management</h3>
            <p className="text-muted-foreground">Manage team members and permissions</p>
          </div>
        </div>
      ),
    },
    {
      id: "integrations",
      label: "Integrations",
      content: (
        <div className="p-6">
          <div className="bg-card border border-border rounded-lg p-12 text-center">
            <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Integrations</h3>
            <p className="text-muted-foreground">Connect with third-party services</p>
          </div>
        </div>
      ),
    },
    {
      id: "agents",
      label: "AI Agents",
      content: (
        <div className="p-6">
          <div className="bg-card border border-border rounded-lg p-12 text-center">
            <Bot className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">AI Agent Settings</h3>
            <p className="text-muted-foreground">Configure AI agent behavior and policies</p>
          </div>
        </div>
      ),
    },
  ]

  return (
    <WebAppShell pageTitle="Settings" userRole="ADMIN">
      <div className="h-full flex flex-col">
        <WebPageHeader
          title="Settings"
          subtitle="Configure your LawnFlow workspace"
          breadcrumbs={[
            { label: "Home", href: "/home" },
            { label: "Settings" },
          ]}
        />

        <div className="flex-1 overflow-auto">
          <WebTabbedLayout tabs={tabs} defaultTab="general" />
        </div>
      </div>
    </WebAppShell>
  )
}
