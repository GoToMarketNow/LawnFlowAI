import * as React from "react"
import { WebAppShell } from "../components/web/app-shell"
import { WebTabbedLayout } from "../components/web/tabbed-layout"
import { WebKnowledgeArticleCard, KnowledgeArticle } from "../components/web/knowledge-article-card"
import { WebKnowledgeBuilder, KnowledgeArticleData } from "../components/web/knowledge-builder"
import { WebCoverageGapIndicator, CoverageGap } from "../components/web/coverage-gap-indicator"
import { WebContextualDrawer } from "../components/web/contextual-drawer"
import { WebDiffModal } from "../components/web/diff-modal"
import { WebButton } from "../components/web/button"
import { WebInput } from "../components/web/input"
import { WebSelect } from "../components/web/select"
import { WebBadge } from "../components/web/badge"
import { WebVersionBadge } from "../components/web/version-badge"
import { WebModal } from "../components/web/modal"
import {
  Plus,
  Search,
  Filter,
  FileText,
  CheckCircle,
  XCircle,
  GitCompare,
  Eye,
  Edit,
  Archive,
  AlertTriangle,
  TrendingUp,
  Sparkles,
} from "lucide-react"
import { cn } from "../components/ui/utils"

type ViewMode = "list" | "builder" | "article"

export default function KnowledgePage() {
  const [viewMode, setViewMode] = React.useState<ViewMode>("list")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [categoryFilter, setCategoryFilter] = React.useState<string>("all")
  const [selectedArticle, setSelectedArticle] = React.useState<KnowledgeArticle | null>(null)
  const [editingArticle, setEditingArticle] = React.useState<KnowledgeArticle | null>(null)
  const [showDiffModal, setShowDiffModal] = React.useState(false)
  const [showApprovalModal, setShowApprovalModal] = React.useState(false)

  // Sample articles
  const articles: KnowledgeArticle[] = [
    {
      id: "1",
      title: "How to Reschedule Lawn Service Appointments",
      summary: "Step-by-step guide for rescheduling customer appointments with crew availability checks and confirmation workflows.",
      category: "Scheduling",
      tags: ["rescheduling", "appointments", "crews"],
      version: "2.1",
      status: "published",
      author: "Sarah Johnson",
      lastModified: "2 days ago",
      views: 1243,
      helpful: 94,
      coverageScore: 87,
    },
    {
      id: "2",
      title: "Handling Duplicate Billing Charges",
      summary: "Protocol for investigating and resolving duplicate charges on customer accounts.",
      category: "Billing",
      tags: ["billing", "refunds", "errors"],
      version: "1.5",
      status: "pending",
      author: "Michael Chen",
      lastModified: "4 hours ago",
      views: 89,
      helpful: 88,
      coverageScore: 76,
    },
    {
      id: "3",
      title: "Quality Complaint Resolution Process",
      summary: "Standard operating procedure for handling service quality complaints including re-service scheduling and customer satisfaction follow-up.",
      category: "Service Issues",
      tags: ["quality", "complaints", "re-service"],
      version: "3.0",
      status: "published",
      author: "John Smith",
      lastModified: "1 week ago",
      views: 2156,
      helpful: 96,
      coverageScore: 92,
    },
    {
      id: "4",
      title: "Emergency Service Request Protocol",
      summary: "Urgent response procedures for emergency situations including dispatch, crew notification, and customer communication.",
      category: "Service Issues",
      tags: ["emergency", "urgent", "dispatch"],
      version: "2.0",
      status: "published",
      author: "Sarah Johnson",
      lastModified: "3 days ago",
      views: 567,
      helpful: 91,
      coverageScore: 85,
    },
    {
      id: "5",
      title: "Fertilization Service Information",
      summary: "Comprehensive guide to fertilization service packages, pricing, and scheduling.",
      category: "General",
      tags: ["fertilization", "services", "pricing"],
      version: "1.0",
      status: "draft",
      author: "David Thompson",
      lastModified: "1 day ago",
      coverageScore: 45,
    },
    {
      id: "6",
      title: "Weather-Related Service Adjustments",
      summary: "Guidelines for proactively rescheduling services due to weather conditions and communicating changes to customers.",
      category: "Scheduling",
      tags: ["weather", "rescheduling", "proactive"],
      version: "1.2",
      status: "archived",
      author: "Lisa Anderson",
      lastModified: "3 months ago",
      views: 423,
      helpful: 82,
      coverageScore: 68,
    },
    {
      id: "7",
      title: "New Customer Onboarding Checklist",
      summary: "Complete checklist for onboarding new customers including property assessment, service setup, and initial communication.",
      category: "General",
      tags: ["onboarding", "new-customers", "setup"],
      version: "1.8",
      status: "pending",
      author: "Emma Rodriguez",
      lastModified: "6 hours ago",
      coverageScore: 72,
    },
  ]

  // Coverage gaps
  const coverageGaps: CoverageGap[] = [
    {
      topic: "Seasonal Service Transitions",
      ticketCount: 47,
      resolutionRate: 62,
      avgResolutionTime: "6.5h",
      trend: "up",
      severity: "critical",
    },
    {
      topic: "Equipment Damage Claims",
      ticketCount: 23,
      resolutionRate: 71,
      avgResolutionTime: "4.2h",
      trend: "up",
      severity: "high",
    },
    {
      topic: "Service Add-ons and Upsells",
      ticketCount: 34,
      resolutionRate: 78,
      avgResolutionTime: "2.8h",
      trend: "stable",
      severity: "medium",
    },
    {
      topic: "Payment Plan Options",
      ticketCount: 15,
      resolutionRate: 85,
      avgResolutionTime: "1.5h",
      trend: "down",
      severity: "low",
    },
  ]

  // Filter articles
  const filterArticles = (status?: string) => {
    return articles.filter((article) => {
      const matchesSearch =
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesCategory = categoryFilter === "all" || article.category === categoryFilter
      const matchesStatus = !status || article.status === status
      return matchesSearch && matchesCategory && matchesStatus
    })
  }

  // Knowledge List View
  const KnowledgeListView = () => {
    const tabs = [
      {
        id: "all",
        label: "All Articles",
        badge: articles.length,
        content: (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filterArticles().map((article) => (
                <WebKnowledgeArticleCard
                  key={article.id}
                  article={article}
                  onClick={() => {
                    setSelectedArticle(article)
                    setViewMode("article")
                  }}
                />
              ))}
            </div>
          </div>
        ),
      },
      {
        id: "draft",
        label: "Drafts",
        badge: filterArticles("draft").length,
        content: (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filterArticles("draft").map((article) => (
                <WebKnowledgeArticleCard
                  key={article.id}
                  article={article}
                  onClick={() => {
                    setEditingArticle(article)
                    setViewMode("builder")
                  }}
                />
              ))}
            </div>
          </div>
        ),
      },
      {
        id: "pending",
        label: "Pending Review",
        badge: filterArticles("pending").length,
        content: (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filterArticles("pending").map((article) => (
                <WebKnowledgeArticleCard
                  key={article.id}
                  article={article}
                  onClick={() => {
                    setSelectedArticle(article)
                    setViewMode("article")
                  }}
                  onApprove={() => setShowApprovalModal(true)}
                  onReject={() => console.log("Reject", article.title)}
                  showActions
                />
              ))}
            </div>
          </div>
        ),
      },
      {
        id: "published",
        label: "Published",
        badge: filterArticles("published").length,
        content: (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filterArticles("published").map((article) => (
                <WebKnowledgeArticleCard
                  key={article.id}
                  article={article}
                  onClick={() => {
                    setSelectedArticle(article)
                    setViewMode("article")
                  }}
                />
              ))}
            </div>
          </div>
        ),
      },
      {
        id: "archived",
        label: "Archived",
        badge: filterArticles("archived").length,
        content: (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filterArticles("archived").map((article) => (
                <WebKnowledgeArticleCard
                  key={article.id}
                  article={article}
                  onClick={() => {
                    setSelectedArticle(article)
                    setViewMode("article")
                  }}
                />
              ))}
            </div>
          </div>
        ),
      },
      {
        id: "gaps",
        label: "Coverage Gaps",
        badge: coverageGaps.length,
        badgeVariant: "destructive" as const,
        content: (
          <div className="p-6">
            {/* Gap Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Total Gaps</p>
                <p className="text-2xl font-semibold">{coverageGaps.length}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Critical</p>
                <p className="text-2xl font-semibold text-destructive">
                  {coverageGaps.filter((g) => g.severity === "critical").length}
                </p>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Affected Tickets</p>
                <p className="text-2xl font-semibold">
                  {coverageGaps.reduce((sum, gap) => sum + gap.ticketCount, 0)}
                </p>
              </div>
              <div className="bg-card border border-border rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-1">Avg Resolution</p>
                <p className="text-2xl font-semibold">4.3h</p>
              </div>
            </div>

            {/* Gap Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {coverageGaps.map((gap, index) => (
                <WebCoverageGapIndicator
                  key={index}
                  gap={gap}
                  onClick={() => {
                    setViewMode("builder")
                  }}
                />
              ))}
            </div>

            {/* AI Suggestion */}
            <div className="mt-6 bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20 rounded-lg p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <h3 className="font-semibold mb-2">AI-Powered Gap Analysis</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      We've identified {coverageGaps.length} topics that frequently appear in
                      support tickets without matching knowledge articles. Creating articles for
                      these gaps could reduce resolution time by an estimated 40%.
                    </p>
                    <WebButton variant="primary" size="sm">
                      Generate Article Drafts
                    </WebButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ),
      },
    ]

    return (
      <div className="h-full flex flex-col">
        {/* Page Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl font-semibold mb-2">Knowledge Base</h2>
              <p className="text-muted-foreground">
                Manage support documentation and identify coverage gaps
              </p>
            </div>
            <div className="flex gap-2">
              <WebButton variant="secondary" onClick={() => setShowDiffModal(true)}>
                <GitCompare className="w-4 h-4 mr-2" />
                Compare Versions
              </WebButton>
              <WebButton
                variant="primary"
                onClick={() => {
                  setEditingArticle(null)
                  setViewMode("builder")
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                New Article
              </WebButton>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <WebInput
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <WebSelect
              value={categoryFilter}
              onChange={(value) => setCategoryFilter(value)}
              options={[
                { value: "all", label: "All Categories" },
                { value: "Scheduling", label: "Scheduling" },
                { value: "Billing", label: "Billing" },
                { value: "Service Issues", label: "Service Issues" },
                { value: "General", label: "General" },
              ]}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-1 overflow-hidden bg-card border-t border-border">
          <WebTabbedLayout tabs={tabs} defaultTab="all" />
        </div>
      </div>
    )
  }

  // Article View
  const ArticleView = () => {
    if (!selectedArticle) return null

    const content = `# ${selectedArticle.title}

${selectedArticle.summary}

## Overview

This article provides comprehensive guidance for handling ${selectedArticle.category.toLowerCase()} inquiries.

## Step-by-Step Process

### 1. Initial Assessment
- Review the customer's request carefully
- Check their account history and status
- Identify any blocking issues

### 2. Solution Path
- Apply the standard resolution process
- Use available tools and systems
- Document all actions taken

### 3. Follow-up
- Confirm resolution with the customer
- Update ticket status
- Schedule any necessary callbacks

## Common Scenarios

- **Scenario A**: Standard case handling
- **Scenario B**: Escalation required
- **Scenario C**: Special circumstances

## Tips & Best Practices

- Always maintain professional communication
- Set clear expectations with customers
- Use templates for consistency
- Escalate when appropriate

## Related Articles

- How to Handle Customer Complaints
- Billing Best Practices
- Service Quality Standards`

    return (
      <div className="h-full flex flex-col bg-background">
        {/* Header */}
        <div className="border-b border-border bg-card px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <WebButton variant="ghost" onClick={() => setViewMode("list")}>
              ← Back to List
            </WebButton>
            <div className="flex items-center gap-2">
              <WebVersionBadge
                version={selectedArticle.version}
                status={selectedArticle.status}
              />
              <WebButton variant="secondary" size="sm">
                <GitCompare className="w-4 h-4 mr-2" />
                View History
              </WebButton>
              <WebButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditingArticle(selectedArticle)
                  setViewMode("builder")
                }}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </WebButton>
              {selectedArticle.status === "published" && (
                <WebButton variant="secondary" size="sm">
                  <Archive className="w-4 h-4 mr-2" />
                  Archive
                </WebButton>
              )}
            </div>
          </div>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-semibold mb-2">{selectedArticle.title}</h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>By {selectedArticle.author}</span>
                <span>•</span>
                <span>Updated {selectedArticle.lastModified}</span>
                <span>•</span>
                <WebBadge variant="neutral" size="sm">
                  {selectedArticle.category}
                </WebBadge>
              </div>
            </div>

            {selectedArticle.views !== undefined && (
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-muted-foreground" />
                  <span>{selectedArticle.views} views</span>
                </div>
                <div className="flex items-center gap-1.5 text-success">
                  <CheckCircle className="w-4 h-4" />
                  <span>{selectedArticle.helpful}% helpful</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto">
            <div className="bg-card border border-border rounded-lg p-8">
              <div className="prose prose-sm max-w-none">
                {content.split("\n").map((line, index) => {
                  if (line.startsWith("# "))
                    return (
                      <h1 key={index} className="text-3xl font-semibold mt-8 mb-4">
                        {line.slice(2)}
                      </h1>
                    )
                  if (line.startsWith("## "))
                    return (
                      <h2 key={index} className="text-xl font-semibold mt-6 mb-3">
                        {line.slice(3)}
                      </h2>
                    )
                  if (line.startsWith("### "))
                    return (
                      <h3 key={index} className="text-lg font-semibold mt-4 mb-2">
                        {line.slice(4)}
                      </h3>
                    )
                  if (line.startsWith("- "))
                    return (
                      <li key={index} className="ml-4 mb-1">
                        {line.slice(2).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")}
                      </li>
                    )
                  if (line.trim() === "") return <br key={index} />
                  return (
                    <p key={index} className="mb-3">
                      {line}
                    </p>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <WebAppShell
      pageTitle="Knowledge"
      userRole="ADMIN"
      userName="John Smith"
      userEmail="john@lawnflow.ai"
    >
      <div className="h-[calc(100vh-64px)]">
        {viewMode === "list" && <KnowledgeListView />}
        {viewMode === "builder" && (
          <WebKnowledgeBuilder
            initialData={
              editingArticle
                ? {
                    title: editingArticle.title,
                    category: editingArticle.category,
                    tags: editingArticle.tags,
                    summary: editingArticle.summary,
                    content: "# Sample content\n\nThis is the article content...",
                  }
                : undefined
            }
            onSave={(data) => {
              console.log("Save draft", data)
              setViewMode("list")
            }}
            onSubmitForReview={(data) => {
              console.log("Submit for review", data)
              setViewMode("list")
            }}
          />
        )}
        {viewMode === "article" && <ArticleView />}
      </div>

      {/* Diff Modal */}
      <WebDiffModal
        open={showDiffModal}
        onClose={() => setShowDiffModal(false)}
        leftVersion={{
          label: "v2.0 (Current)",
          content: `How to Reschedule Lawn Service Appointments

Follow these steps to reschedule:
1. Check crew availability
2. Confirm with customer
3. Update the system`,
        }}
        rightVersion={{
          label: "v2.1 (Proposed)",
          content: `How to Reschedule Lawn Service Appointments

Follow these steps to reschedule appointments:
1. Check crew availability in the scheduling system
2. Confirm new time with customer via phone or email
3. Update the system and send confirmation
4. Notify the crew of the change`,
        }}
      />

      {/* Approval Modal */}
      <WebModal
        open={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        title="Approve Knowledge Article"
        description="Review changes before publishing"
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <WebButton variant="secondary" onClick={() => setShowApprovalModal(false)}>
              Cancel
            </WebButton>
            <WebButton
              variant="destructive"
              onClick={() => {
                console.log("Reject with feedback")
                setShowApprovalModal(false)
              }}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Request Changes
            </WebButton>
            <WebButton
              variant="primary"
              onClick={() => {
                console.log("Approve and publish")
                setShowApprovalModal(false)
              }}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Approve & Publish
            </WebButton>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-semibold mb-2">Changes Summary</h4>
            <ul className="text-sm space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-success">+</span>
                <span>Added step 4: Notify crew of schedule change</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-warning">~</span>
                <span>Updated step 1: Added system reference</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-warning">~</span>
                <span>Updated step 2: Clarified communication channels</span>
              </li>
            </ul>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Review Notes (Optional)</label>
            <textarea
              className="w-full h-24 px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="Add notes for the author..."
            />
          </div>
        </div>
      </WebModal>
    </WebAppShell>
  )
}
