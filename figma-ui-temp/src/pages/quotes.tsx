import * as React from "react"
import { WebAppShell } from "../components/web/app-shell"
import { WebPageHeader } from "../components/web/page-header"
import { WebButton } from "../components/web/button"
import { WebBadge } from "../components/web/badge"
import { WebFilteredListLayout } from "../components/web/filtered-list-layout"
import { WebSelect } from "../components/web/select"
import { WebModal } from "../components/web/modal"
import { WebTextarea } from "../components/web/textarea"
import { FileText, Filter, Phone, Mail, Bot, CheckCircle, X } from "lucide-react"

export default function QuotesPage() {
  const [showMobileFilters, setShowMobileFilters] = React.useState(false)
  const [selectedQuote, setSelectedQuote] = React.useState<string | null>(null)
  const [showActionModal, setShowActionModal] = React.useState(false)
  const [showAgentModal, setShowAgentModal] = React.useState(false)
  const [actionNotes, setActionNotes] = React.useState("")
  const [agentInstructions, setAgentInstructions] = React.useState("")

  const mockQuotes = [
    {
      id: "Q-1001",
      customer: "Green Acres HOA",
      service: "Full Lawn Maintenance",
      amount: "$2,400/mo",
      status: "pending",
      date: "Jan 10, 2026",
      daysOld: 3,
      isStale: false,
    },
    {
      id: "Q-1002",
      customer: "Smith Residence",
      service: "Spring Cleanup",
      amount: "$850",
      status: "approved",
      date: "Jan 11, 2026",
      daysOld: 2,
      isStale: false,
    },
    {
      id: "Q-1003",
      customer: "Downtown Office Park",
      service: "Weekly Mowing & Edging",
      amount: "$1,200/mo",
      status: "pending",
      date: "Jan 12, 2026",
      daysOld: 1,
      isStale: false,
    },
    {
      id: "Q-0998",
      customer: "Riverside Apartments",
      service: "Seasonal Landscaping",
      amount: "$3,200",
      status: "pending",
      date: "Jan 3, 2026",
      daysOld: 10,
      isStale: true,
    },
    {
      id: "Q-0995",
      customer: "Wilson Estate",
      service: "Tree & Shrub Care",
      amount: "$1,850",
      status: "pending",
      date: "Dec 30, 2025",
      daysOld: 14,
      isStale: true,
    },
  ]

  const handleTakeAction = (quoteId: string, actionType: string) => {
    console.log(`Taking action ${actionType} on quote ${quoteId}`)
    setShowActionModal(false)
    setActionNotes("")
  }

  const handleActivateAgent = (quoteId: string) => {
    console.log(`Activating agent for quote ${quoteId} with instructions:`, agentInstructions)
    setShowAgentModal(false)
    setAgentInstructions("")
  }

  const filterPanel = (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium mb-2">Status</h3>
        <WebSelect
          options={[
            { value: "all", label: "All Statuses" },
            { value: "pending", label: "Pending" },
            { value: "approved", label: "Approved" },
            { value: "declined", label: "Declined" },
          ]}
        />
      </div>
      <div>
        <h3 className="font-medium mb-2">Service Type</h3>
        <WebSelect
          options={[
            { value: "all", label: "All Services" },
            { value: "maintenance", label: "Maintenance" },
            { value: "cleanup", label: "Cleanup" },
            { value: "installation", label: "Installation" },
          ]}
        />
      </div>
    </div>
  )

  return (
    <WebAppShell pageTitle="Quotes" userRole="USER">
      <div className="h-full flex flex-col">
        <WebPageHeader
          title="Quotes"
          subtitle="Manage customer quotes and estimates"
          breadcrumbs={[
            { label: "Home", href: "/home" },
            { label: "Quotes" },
          ]}
          actions={
            <WebButton variant="primary">
              <FileText className="w-4 h-4 mr-2" />
              New Quote
            </WebButton>
          }
        />

        <div className="flex-1 overflow-hidden">
          <WebFilteredListLayout
            filterPanel={filterPanel}
            showMobileFilters={showMobileFilters}
            onCloseMobileFilters={() => setShowMobileFilters(false)}
          >
            <div className="p-6">
              <div className="mb-6 flex justify-between items-center">
                <h2 className="text-lg font-semibold">All Quotes ({mockQuotes.length})</h2>
                <WebButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowMobileFilters(true)}
                  className="lg:hidden"
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                </WebButton>
              </div>

              <div className="grid gap-4">
                {mockQuotes.map((quote) => (
                  <div
                    key={quote.id}
                    className={`bg-card border rounded-lg p-6 hover:shadow-sm transition-shadow ${
                      quote.isStale ? "border-warning/50 bg-warning/5" : "border-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono text-sm text-muted-foreground">
                            {quote.id}
                          </span>
                          <WebBadge variant="status" status={quote.status as "pending" | "approved"}>
                            {quote.status}
                          </WebBadge>
                          {quote.isStale && (
                            <WebBadge variant="status" status="overdue" size="sm">
                              {quote.daysOld} days old
                            </WebBadge>
                          )}
                        </div>
                        <h3 className="font-semibold mb-1">{quote.customer}</h3>
                        <p className="text-sm text-muted-foreground mb-2">
                          {quote.service}
                        </p>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">{quote.date}</span>
                          <span className="font-semibold text-primary">{quote.amount}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {quote.status === "pending" && (
                          <>
                            <WebButton
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                setSelectedQuote(quote.id)
                                setShowActionModal(true)
                              }}
                            >
                              <Phone className="w-4 h-4 mr-2" />
                              Take Action
                            </WebButton>
                            <WebButton
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                setSelectedQuote(quote.id)
                                setShowAgentModal(true)
                              }}
                            >
                              <Bot className="w-4 h-4 mr-2" />
                              Activate Agent
                            </WebButton>
                          </>
                        )}
                        {quote.status === "approved" && (
                          <WebButton variant="ghost" size="sm">
                            <CheckCircle className="w-4 h-4 mr-2 text-success" />
                            Approved
                          </WebButton>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </WebFilteredListLayout>
        </div>

        {/* Take Action Modal */}
        <WebModal
          open={showActionModal}
          onClose={() => {
            setShowActionModal(false)
            setActionNotes("")
          }}
          title="Take Action on Quote"
          description={`Quote ${selectedQuote}`}
          size="md"
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Choose an action to take on this quote. You can follow up directly with the customer.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <WebButton
                variant="secondary"
                className="h-auto py-4 flex-col gap-2"
                onClick={() => handleTakeAction(selectedQuote!, "call")}
              >
                <Phone className="w-6 h-6" />
                <span>Call Customer</span>
              </WebButton>
              <WebButton
                variant="secondary"
                className="h-auto py-4 flex-col gap-2"
                onClick={() => handleTakeAction(selectedQuote!, "email")}
              >
                <Mail className="w-6 h-6" />
                <span>Send Email</span>
              </WebButton>
            </div>

            <div>
              <label className="block font-medium mb-2">Action Notes (Optional)</label>
              <WebTextarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Add notes about this follow-up..."
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <WebButton
                variant="secondary"
                onClick={() => {
                  setShowActionModal(false)
                  setActionNotes("")
                }}
              >
                Cancel
              </WebButton>
              <WebButton
                variant="primary"
                onClick={() => handleTakeAction(selectedQuote!, "complete")}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Mark Complete
              </WebButton>
            </div>
          </div>
        </WebModal>

        {/* Activate Agent Modal */}
        <WebModal
          open={showAgentModal}
          onClose={() => {
            setShowAgentModal(false)
            setAgentInstructions("")
          }}
          title="Activate AI Agent"
          description={`Quote ${selectedQuote}`}
          size="md"
        >
          <div className="space-y-4">
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Bot className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-primary mb-1">AI Agent Follow-up</h4>
                  <p className="text-sm text-muted-foreground">
                    The AI agent will automatically follow up with the customer via their preferred
                    communication method, answer questions, and work to convert this quote.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block font-medium mb-2">Special Instructions (Optional)</label>
              <WebTextarea
                value={agentInstructions}
                onChange={(e) => setAgentInstructions(e.target.value)}
                placeholder="E.g., 'Mention our spring discount' or 'Be flexible on pricing'..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-2">
                The agent will use these instructions along with standard quote follow-up procedures.
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg p-4">
              <h4 className="font-medium mb-2">Agent Will:</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                  <span>Send a personalized follow-up message</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                  <span>Answer customer questions about services and pricing</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                  <span>Schedule a consultation if the customer is interested</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                  <span>Notify you of any updates or customer responses</span>
                </li>
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-border">
              <WebButton
                variant="secondary"
                onClick={() => {
                  setShowAgentModal(false)
                  setAgentInstructions("")
                }}
              >
                Cancel
              </WebButton>
              <WebButton
                variant="primary"
                onClick={() => handleActivateAgent(selectedQuote!)}
              >
                <Bot className="w-4 h-4 mr-2" />
                Activate Agent
              </WebButton>
            </div>
          </div>
        </WebModal>
      </div>
    </WebAppShell>
  )
}