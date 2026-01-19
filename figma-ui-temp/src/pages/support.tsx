import * as React from "react"
import { WebAppShell } from "../components/web/app-shell"
import { WebDataTable, DataTableColumn, DataTableAction } from "../components/web/data-table"
import { WebContextualDrawer } from "../components/web/contextual-drawer"
import { WebButton } from "../components/web/button"
import { WebBadge } from "../components/web/badge"
import { WebSLAIndicator, SLAStatus } from "../components/web/sla-indicator"
import { WebAIEnrichmentCard, AIEnrichment } from "../components/web/ai-enrichment-card"
import { WebKnowledgeMacro, KnowledgeMacro } from "../components/web/knowledge-macro"
import { WebConversationTimeline, ConversationMessage } from "../components/web/conversation-timeline"
import { WebResponseComposer } from "../components/web/response-composer"
import { WebInput } from "../components/web/input"
import { WebSelect } from "../components/web/select"
import {
  MessageSquare,
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertTriangle,
  Eye,
  UserCheck,
  Ban,
  Sparkles,
  Send,
} from "lucide-react"
import { cn } from "../components/ui/utils"

export type CoverageStatus = "covered" | "partial" | "no-coverage"
export type TicketStatus = "open" | "awaiting-approval" | "in-progress" | "resolved" | "closed"

interface SupportTicket {
  id: string
  ticketNumber: string
  customer: {
    name: string
    email: string
  }
  subject: string
  status: TicketStatus
  sla: {
    status: SLAStatus
    timeRemaining: string
  }
  priority: "low" | "medium" | "high" | "urgent"
  intent: string
  coverage: CoverageStatus
  sentiment: "positive" | "neutral" | "negative"
  age: string
  lastMessage: string
  lastMessageTime: string
  assignedTo?: string
  conversation: ConversationMessage[]
  aiEnrichment: AIEnrichment
  suggestedMacros: KnowledgeMacro[]
}

export default function SupportPage() {
  const [selectedTicket, setSelectedTicket] = React.useState<SupportTicket | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [coverageFilter, setCoverageFilter] = React.useState<string>("all")

  // Sample tickets
  const tickets: SupportTicket[] = [
    {
      id: "1",
      ticketNumber: "TICKET-1234",
      customer: {
        name: "Sarah Johnson",
        email: "sarah@abcproperties.com",
      },
      subject: "Schedule change request for this Friday",
      status: "awaiting-approval",
      sla: {
        status: "safe",
        timeRemaining: "6h 24m",
      },
      priority: "medium",
      intent: "Schedule Change",
      coverage: "covered",
      sentiment: "neutral",
      age: "15 minutes ago",
      lastMessage: "Our AI suggested moving the Friday appointment to Saturday morning...",
      lastMessageTime: "15m ago",
      assignedTo: "AI Assistant",
      conversation: [
        {
          id: "1",
          sender: "customer",
          senderName: "Sarah Johnson",
          message: "Hi, I need to reschedule my lawn service this Friday. Can we move it to Saturday morning instead?",
          timestamp: "Today at 9:15 AM",
        },
        {
          id: "2",
          sender: "ai",
          senderName: "AI Assistant",
          message: "I've checked the schedule and Crew Alpha is available Saturday morning at 8:00 AM. I can reschedule your service from Friday 2:00 PM to Saturday 8:00 AM. Would this work for you?",
          timestamp: "Today at 9:16 AM",
        },
        {
          id: "3",
          sender: "customer",
          senderName: "Sarah Johnson",
          message: "Yes, that works perfectly! Please confirm the change.",
          timestamp: "Today at 9:30 AM",
        },
      ],
      aiEnrichment: {
        intent: "Schedule Change",
        intentConfidence: 0.95,
        sentiment: "neutral",
        sentimentScore: 0.12,
        priority: "medium",
        suggestedActions: [
          "Check crew availability for Saturday",
          "Confirm customer's preferred time",
          "Update scheduling system",
          "Send confirmation email",
        ],
        keyTopics: ["Rescheduling", "Friday Service", "Saturday Morning"],
        customerHistory: {
          totalTickets: 3,
          avgResolutionTime: "2.5 hours",
          satisfactionScore: 4.8,
        },
      },
      suggestedMacros: [
        {
          id: "m1",
          title: "Reschedule Confirmation",
          content: "I've successfully rescheduled your service to Saturday, [DATE] at [TIME]. Crew Alpha will arrive as scheduled. You'll receive a confirmation email shortly.",
          category: "Scheduling",
          useCount: 142,
        },
        {
          id: "m2",
          title: "Schedule Change - Weather",
          content: "Due to weather conditions, we're proactively rescheduling your service. We've moved your appointment to the next available date to ensure quality work.",
          category: "Scheduling",
          useCount: 89,
        },
      ],
    },
    {
      id: "2",
      ticketNumber: "TICKET-1235",
      customer: {
        name: "Michael Chen",
        email: "mchen@techcorp.com",
      },
      subject: "Billing question - duplicate charge",
      status: "open",
      sla: {
        status: "warning",
        timeRemaining: "2h 15m",
      },
      priority: "high",
      intent: "Billing Issue",
      coverage: "partial",
      sentiment: "negative",
      age: "1 hour ago",
      lastMessage: "I see two charges on my card for the same service date...",
      lastMessageTime: "1h ago",
      conversation: [
        {
          id: "1",
          sender: "customer",
          senderName: "Michael Chen",
          message: "I noticed I was charged twice for last week's service. Can you please explain why there are two charges of $125 each on my card?",
          timestamp: "Today at 8:30 AM",
        },
        {
          id: "2",
          sender: "ai",
          senderName: "AI Assistant",
          message: "I've reviewed your account and found both charges. One appears to be for the scheduled weekly service, and the second might be for an additional fertilization service requested on the same day. Let me verify this with our billing team.",
          timestamp: "Today at 8:32 AM",
        },
      ],
      aiEnrichment: {
        intent: "Billing Issue",
        intentConfidence: 0.92,
        sentiment: "negative",
        sentimentScore: -0.65,
        priority: "high",
        suggestedActions: [
          "Review billing records immediately",
          "Check for duplicate transactions",
          "Escalate to billing specialist if confirmed",
          "Offer refund or credit if error found",
        ],
        keyTopics: ["Duplicate Charge", "Billing Error", "Refund Request"],
        customerHistory: {
          totalTickets: 1,
          avgResolutionTime: "N/A",
          satisfactionScore: 5.0,
        },
      },
      suggestedMacros: [
        {
          id: "m3",
          title: "Billing Investigation",
          content: "I'm reviewing your billing records and will provide a detailed explanation within 2 hours. If there's an error, we'll issue a full refund immediately.",
          category: "Billing",
          useCount: 67,
        },
        {
          id: "m4",
          title: "Duplicate Charge Refund",
          content: "I've confirmed the duplicate charge was an error on our end. I've processed a full refund of $[AMOUNT] which will appear in 3-5 business days. My sincere apologies for the inconvenience.",
          category: "Billing",
          useCount: 34,
        },
      ],
    },
    {
      id: "3",
      ticketNumber: "TICKET-1236",
      customer: {
        name: "Emma Rodriguez",
        email: "emma.r@gmail.com",
      },
      subject: "Service quality concern - uneven mowing",
      status: "in-progress",
      sla: {
        status: "safe",
        timeRemaining: "18h 42m",
      },
      priority: "medium",
      intent: "Quality Complaint",
      coverage: "covered",
      sentiment: "negative",
      age: "3 hours ago",
      lastMessage: "Thank you for the quick response. I appreciate the offer to redo the work...",
      lastMessageTime: "45m ago",
      assignedTo: "John Smith",
      conversation: [
        {
          id: "1",
          sender: "customer",
          senderName: "Emma Rodriguez",
          message: "Hi, I'm not happy with yesterday's mowing job. There are uneven patches in the backyard and some areas that were completely missed.",
          timestamp: "Today at 6:45 AM",
        },
        {
          id: "2",
          sender: "ai",
          senderName: "AI Assistant",
          message: "I sincerely apologize for not meeting our quality standards. I'd like to send our crew supervisor back today to review and redo the work at no additional charge. Would this afternoon work for you?",
          timestamp: "Today at 6:47 AM",
        },
        {
          id: "3",
          sender: "customer",
          senderName: "Emma Rodriguez",
          message: "Thank you for the quick response. I appreciate the offer to redo the work. This afternoon between 2-4 PM would work great.",
          timestamp: "Today at 8:45 AM",
        },
        {
          id: "4",
          sender: "agent",
          senderName: "John Smith",
          message: "Hi Emma, I'm John, the crew supervisor. I've scheduled to come by at 2:30 PM today to personally review and fix the issues. I'll make sure everything meets your expectations.",
          timestamp: "Today at 9:00 AM",
        },
      ],
      aiEnrichment: {
        intent: "Quality Complaint",
        intentConfidence: 0.89,
        sentiment: "negative",
        sentimentScore: -0.54,
        priority: "medium",
        suggestedActions: [
          "Schedule immediate re-service",
          "Send crew supervisor to review",
          "Document issues with photos",
          "Follow up after correction",
          "Consider service credit",
        ],
        keyTopics: ["Uneven Mowing", "Quality Issues", "Missed Areas"],
        customerHistory: {
          totalTickets: 2,
          avgResolutionTime: "4 hours",
          satisfactionScore: 4.5,
        },
      },
      suggestedMacros: [],
    },
    {
      id: "4",
      ticketNumber: "TICKET-1237",
      customer: {
        name: "David Thompson",
        email: "dthompson@residential.com",
      },
      subject: "Question about fertilization services",
      status: "open",
      sla: {
        status: "critical",
        timeRemaining: "45m",
      },
      priority: "low",
      intent: "Service Information",
      coverage: "no-coverage",
      sentiment: "positive",
      age: "6 hours ago",
      lastMessage: "What's included in your spring fertilization package?",
      lastMessageTime: "6h ago",
      conversation: [
        {
          id: "1",
          sender: "customer",
          senderName: "David Thompson",
          message: "I'm interested in adding fertilization to my service plan. What's included in your spring fertilization package and what's the pricing?",
          timestamp: "Today at 3:30 AM",
        },
      ],
      aiEnrichment: {
        intent: "Service Information",
        intentConfidence: 0.97,
        sentiment: "positive",
        sentimentScore: 0.42,
        priority: "low",
        suggestedActions: [
          "Provide fertilization service details",
          "Share pricing information",
          "Offer to schedule consultation",
          "Send service brochure",
        ],
        keyTopics: ["Fertilization", "Service Addition", "Pricing"],
        customerHistory: {
          totalTickets: 5,
          avgResolutionTime: "1.2 hours",
          satisfactionScore: 4.9,
        },
      },
      suggestedMacros: [
        {
          id: "m5",
          title: "Fertilization Package Info",
          content: "Our spring fertilization package includes pre-emergent weed control, balanced NPK fertilizer application, and soil pH testing. Pricing is $0.015/sqft with a $50 minimum. Based on your property size, it would be approximately $[AMOUNT].",
          category: "Service Info",
          useCount: 156,
        },
      ],
    },
    {
      id: "5",
      ticketNumber: "TICKET-1238",
      customer: {
        name: "Lisa Anderson",
        email: "lisa@greenvalleyhoa.com",
      },
      subject: "Emergency service request - broken sprinkler",
      status: "open",
      sla: {
        status: "breached",
        timeRemaining: "Breached 2h ago",
      },
      priority: "urgent",
      intent: "Emergency Service",
      coverage: "partial",
      sentiment: "negative",
      age: "8 hours ago",
      lastMessage: "We have water flooding the common area from a broken sprinkler head...",
      lastMessageTime: "8h ago",
      conversation: [
        {
          id: "1",
          sender: "customer",
          senderName: "Lisa Anderson",
          message: "URGENT: We have a broken sprinkler head flooding the common area. Water has been running for over an hour. We need immediate assistance!",
          timestamp: "Yesterday at 11:30 PM",
        },
      ],
      aiEnrichment: {
        intent: "Emergency Service",
        intentConfidence: 0.98,
        sentiment: "negative",
        sentimentScore: -0.78,
        priority: "urgent",
        suggestedActions: [
          "Escalate to emergency dispatch IMMEDIATELY",
          "Contact on-call crew",
          "Provide temporary solution instructions",
          "Dispatch crew within 1 hour",
          "Follow up every 30 minutes",
        ],
        keyTopics: ["Emergency", "Sprinkler Repair", "Water Damage", "Flooding"],
        customerHistory: {
          totalTickets: 8,
          avgResolutionTime: "3 hours",
          satisfactionScore: 4.6,
        },
      },
      suggestedMacros: [
        {
          id: "m6",
          title: "Emergency Response",
          content: "I've escalated this to our emergency team. A crew is being dispatched immediately and should arrive within [TIME]. In the meantime, if possible, try to locate and shut off the zone valve. I'll call you directly in 5 minutes.",
          category: "Emergency",
          useCount: 23,
        },
      ],
    },
  ]

  // Filter tickets
  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter
    const matchesCoverage = coverageFilter === "all" || ticket.coverage === coverageFilter
    return matchesSearch && matchesStatus && matchesCoverage
  })

  // Coverage status configuration
  const getCoverageConfig = (coverage: CoverageStatus) => {
    switch (coverage) {
      case "covered":
        return {
          label: "Covered",
          color: "text-success",
          bgColor: "bg-success/10",
          borderColor: "border-success/30",
        }
      case "partial":
        return {
          label: "Partial",
          color: "text-warning",
          bgColor: "bg-warning/10",
          borderColor: "border-warning/30",
        }
      case "no-coverage":
        return {
          label: "No Coverage",
          color: "text-destructive",
          bgColor: "bg-destructive/10",
          borderColor: "border-destructive/30",
        }
    }
  }

  // Table columns
  const columns: DataTableColumn<SupportTicket>[] = [
    {
      id: "sla",
      header: "SLA",
      width: "80px",
      render: (_, row) => (
        <WebSLAIndicator status={row.sla.status} timeRemaining={row.sla.timeRemaining} />
      ),
    },
    {
      id: "ticket",
      header: "Ticket",
      render: (_, row) => (
        <div>
          <div className="font-medium font-mono text-sm">{row.ticketNumber}</div>
          <div className="text-sm text-muted-foreground">{row.customer.name}</div>
        </div>
      ),
    },
    {
      id: "subject",
      header: "Subject",
      render: (_, row) => (
        <div>
          <div className="font-medium mb-1">{row.subject}</div>
          <div className="text-xs text-muted-foreground line-clamp-1">{row.lastMessage}</div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      width: "150px",
      render: (_, row) => (
        <WebBadge
          variant="status"
          status={
            row.status === "resolved"
              ? "success"
              : row.status === "in-progress"
              ? "active"
              : row.status === "awaiting-approval"
              ? "pending"
              : "neutral"
          }
          size="sm"
        >
          {row.status === "awaiting-approval"
            ? "Awaiting Approval"
            : row.status.replace("-", " ")}
        </WebBadge>
      ),
    },
    {
      id: "priority",
      header: "Priority",
      width: "100px",
      render: (_, row) => (
        <WebBadge
          variant={
            row.priority === "urgent"
              ? "destructive"
              : row.priority === "high"
              ? "warning"
              : row.priority === "medium"
              ? "primary"
              : "neutral"
          }
          size="sm"
        >
          {row.priority}
        </WebBadge>
      ),
    },
    {
      id: "intent",
      header: "Intent",
      width: "140px",
      render: (_, row) => <span className="text-sm">{row.intent}</span>,
    },
    {
      id: "coverage",
      header: "Coverage",
      width: "120px",
      render: (_, row) => {
        const config = getCoverageConfig(row.coverage)
        return (
          <span
            className={cn(
              "inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border",
              config.bgColor,
              config.color,
              config.borderColor
            )}
          >
            {config.label}
          </span>
        )
      },
    },
    {
      id: "sentiment",
      header: "Sentiment",
      width: "100px",
      render: (_, row) => (
        <WebBadge
          variant={
            row.sentiment === "positive"
              ? "success"
              : row.sentiment === "negative"
              ? "destructive"
              : "neutral"
          }
          size="sm"
        >
          {row.sentiment}
        </WebBadge>
      ),
    },
    {
      id: "age",
      header: "Age",
      width: "120px",
      render: (_, row) => (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{row.age}</span>
        </div>
      ),
    },
  ]

  // Row actions
  const rowActions: DataTableAction<SupportTicket>[] = [
    {
      id: "view",
      label: "View Thread",
      icon: <Eye className="w-4 h-4" />,
      onClick: (row) => setSelectedTicket(row),
    },
    {
      id: "approve",
      label: "Approve AI Response",
      icon: <CheckCircle className="w-4 h-4" />,
      onClick: (row) => console.log("Approve", row.ticketNumber),
      condition: (row) => row.status === "awaiting-approval",
    },
    {
      id: "assign",
      label: "Assign to Me",
      icon: <UserCheck className="w-4 h-4" />,
      onClick: (row) => console.log("Assign", row.ticketNumber),
    },
  ]

  return (
    <WebAppShell
      pageTitle="Support"
      userRole="ADMIN"
      userName="John Smith"
      userEmail="john@lawnflow.ai"
    >
      <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold mb-2">Support Queue</h2>
            <p className="text-muted-foreground">
              Manage customer conversations and AI-assisted responses
            </p>
          </div>
          <div className="flex gap-2">
            <WebButton variant="secondary">
              <Filter className="w-4 h-4 mr-2" />
              Advanced Filters
            </WebButton>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-1">Open Tickets</p>
            <p className="text-2xl font-semibold">
              {tickets.filter((t) => t.status === "open").length}
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-1">Awaiting Approval</p>
            <p className="text-2xl font-semibold">
              {tickets.filter((t) => t.status === "awaiting-approval").length}
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-1">AI Covered</p>
            <p className="text-2xl font-semibold">
              {tickets.filter((t) => t.coverage === "covered").length}
            </p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-1">SLA Breached</p>
            <p className="text-2xl font-semibold text-destructive">
              {tickets.filter((t) => t.sla.status === "breached").length}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <WebInput
              placeholder="Search tickets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <WebSelect
            value={statusFilter}
            onChange={(value) => setStatusFilter(value)}
            options={[
              { value: "all", label: "All Status" },
              { value: "open", label: "Open" },
              { value: "awaiting-approval", label: "Awaiting Approval" },
              { value: "in-progress", label: "In Progress" },
              { value: "resolved", label: "Resolved" },
            ]}
          />
          <WebSelect
            value={coverageFilter}
            onChange={(value) => setCoverageFilter(value)}
            options={[
              { value: "all", label: "All Coverage" },
              { value: "covered", label: "Covered" },
              { value: "partial", label: "Partial" },
              { value: "no-coverage", label: "No Coverage" },
            ]}
          />
        </div>

        {/* Support Table */}
        <div className="bg-card border border-border rounded-lg">
          <WebDataTable
            columns={columns}
            data={filteredTickets}
            onRowClick={(row) => setSelectedTicket(row)}
            rowActions={rowActions}
            keyField="id"
          />
        </div>
      </div>

      {/* Thread Drawer */}
      <WebContextualDrawer
        open={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        title={selectedTicket?.subject}
        description={`${selectedTicket?.ticketNumber} • ${selectedTicket?.customer.name}`}
        size="lg"
      >
        {selectedTicket && (
          <div className="space-y-6">
            {/* Status Banner for Awaiting Approval */}
            {selectedTicket.status === "awaiting-approval" && (
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-warning mb-1">
                        AI Response Awaiting Approval
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Review the AI-generated response below and approve or modify before sending
                        to the customer.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <WebButton variant="secondary" size="sm">
                      <Ban className="w-4 h-4 mr-2" />
                      Reject
                    </WebButton>
                    <WebButton variant="primary" size="sm">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve & Send
                    </WebButton>
                  </div>
                </div>
              </div>
            )}

            {/* Ticket Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Customer</p>
                <p className="font-medium">{selectedTicket.customer.name}</p>
                <p className="text-sm text-muted-foreground">{selectedTicket.customer.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Assigned To</p>
                <p className="font-medium">{selectedTicket.assignedTo || "Unassigned"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">SLA Status</p>
                <WebSLAIndicator
                  status={selectedTicket.sla.status}
                  timeRemaining={selectedTicket.sla.timeRemaining}
                  showLabel
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Age</p>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{selectedTicket.age}</span>
                </div>
              </div>
            </div>

            {/* AI Enrichment */}
            <WebAIEnrichmentCard enrichment={selectedTicket.aiEnrichment} />

            {/* Suggested Knowledge Macros */}
            {selectedTicket.suggestedMacros.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold">Suggested Responses</h3>
                </div>
                <div className="space-y-2">
                  {selectedTicket.suggestedMacros.map((macro) => (
                    <WebKnowledgeMacro
                      key={macro.id}
                      macro={macro}
                      onUse={(m) => console.log("Use macro", m.title)}
                      compact
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Conversation Timeline */}
            <div>
              <h3 className="font-semibold mb-4">Conversation</h3>
              <WebConversationTimeline messages={selectedTicket.conversation} />
            </div>

            {/* Response Composer */}
            <WebResponseComposer
              onSend={(message) => console.log("Send message:", message)}
              onAISuggest={() => console.log("Generate AI response")}
              disabled={selectedTicket.status === "resolved"}
            />
          </div>
        )}
      </WebContextualDrawer>
    </WebAppShell>
  )
}
