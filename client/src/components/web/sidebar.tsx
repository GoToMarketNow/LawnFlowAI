import * as React from "react"
import {
  Home,
  ListTodo,
  CheckSquare,
  AlertCircle,
  Briefcase,
  FileText,
  Calendar,
  Users as UsersIcon,
  Layers,
  DollarSign,
  Receipt,
  CreditCard,
  AlertTriangle,
  Headphones,
  BookOpen,
  FileCheck,
  TrendingUp,
  BarChart3,
  Bot,
  Zap,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileQuestion,
  Hammer,
  User,
} from "lucide-react"
import { cn } from "../ui/utils"
import { Link, useLocation } from "wouter"

export interface SidebarItem {
  id: string
  label: string
  icon: React.ReactNode
  href: string
  badge?: string | number
  active?: boolean
  requiresRole?: string[]
}

export interface SidebarSection {
  title: string
  items: SidebarItem[]
  requiresRole?: string[]
  defaultExpanded?: boolean
  collapsible?: boolean
  subsections?: SidebarSubsection[]
}

export interface SidebarSubsection {
  title: string
  items: SidebarItem[]
}

export interface WebSidebarProps {
  sections: SidebarSection[]
  collapsed?: boolean
  onToggleCollapse?: () => void
  className?: string
  userRole?: string
}

const WebSidebar = React.forwardRef<HTMLDivElement, WebSidebarProps>(
  ({ sections, collapsed = false, onToggleCollapse, className, userRole = "USER" }, ref) => {
    const [location] = useLocation()
    
    // Track which sections are expanded
    const [expandedSections, setExpandedSections] = React.useState<Set<string>>(() => {
      const defaultExpanded = new Set<string>()
      sections.forEach((section, idx) => {
        if (section.defaultExpanded) {
          defaultExpanded.add(`section-${idx}`)
        }
      })
      return defaultExpanded
    })

    const toggleSection = (sectionKey: string) => {
      setExpandedSections(prev => {
        const next = new Set(prev)
        if (next.has(sectionKey)) {
          next.delete(sectionKey)
        } else {
          next.add(sectionKey)
        }
        return next
      })
    }

    return (
      <aside
        ref={ref}
        className={cn(
          "h-screen bg-card border-r border-border flex flex-col transition-all duration-300",
          collapsed ? "w-16" : "w-60",
          className
        )}
      >
        {/* Logo Area */}
        <div className="h-16 border-b border-border flex items-center justify-between px-4">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-semibold">LF</span>
              </div>
              <span className="font-semibold text-foreground">LawnFlow</span>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mx-auto">
              <span className="text-primary-foreground font-semibold">LF</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          {sections.map((section, idx) => {
            // Check role gate - hide entire section if user doesn't have access
            if (section.requiresRole && !section.requiresRole.includes(userRole)) {
              return null
            }

            const sectionKey = `section-${idx}`
            const isExpanded = expandedSections.has(sectionKey)

            return (
              <div key={idx} className="mb-4">
                {!collapsed && (
                  <div
                    className={cn(
                      "px-4 mb-2 flex items-center justify-between",
                      section.collapsible && "cursor-pointer hover:text-foreground transition-colors"
                    )}
                    onClick={section.collapsible ? () => toggleSection(sectionKey) : undefined}
                  >
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {section.title}
                    </h3>
                    {section.collapsible && (
                      <span className="text-muted-foreground">
                        {isExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </span>
                    )}
                  </div>
                )}

                {/* Section Items */}
                {(!section.collapsible || isExpanded || collapsed) && (
                  <>
                    {section.items && section.items.length > 0 && (
                      <div className="space-y-1 px-2">
                        {section.items.map((item) => {
                          // Check item-level role gating
                          if (item.requiresRole && !item.requiresRole.includes(userRole)) {
                            return null
                          }
                          
                          return (
                            <Link
                              key={item.id}
                              href={item.href}
                              className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                "hover:bg-accent hover:text-accent-foreground",
                                location === item.href
                                  ? "bg-accent text-accent-foreground"
                                  : "text-muted-foreground",
                                collapsed && "justify-center"
                              )}
                              title={collapsed ? item.label : undefined}
                            >
                              <span className="flex-shrink-0">{item.icon}</span>
                              {!collapsed && (
                                <>
                                  <span className="flex-1 truncate">{item.label}</span>
                                  {item.badge && (
                                    <span className="flex-shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-medium rounded-full bg-primary text-primary-foreground">
                                      {item.badge}
                                    </span>
                                  )}
                                </>
                              )}
                            </Link>
                          )
                        })}
                      </div>
                    )}

                    {/* Subsections */}
                    {section.subsections && !collapsed && (
                      <div className="mt-3 space-y-4">
                        {section.subsections.map((subsection, subIdx) => (
                          <div key={subIdx}>
                            <h4 className="px-6 mb-2 text-xs font-medium text-muted-foreground">
                              {subsection.title}
                            </h4>
                            <div className="space-y-1 px-2">
                              {subsection.items.map((item) => (
                                <Link
                                  key={item.id}
                                  href={item.href}
                                  className={cn(
                                    "flex items-center gap-3 px-3 py-2 pl-6 rounded-lg text-sm transition-colors",
                                    "hover:bg-accent hover:text-accent-foreground",
                                    item.active
                                      ? "bg-accent text-accent-foreground font-medium"
                                      : "text-muted-foreground"
                                  )}
                                  title={item.label}
                                >
                                  <span className="flex-1 truncate">{item.label}</span>
                                  {item.badge && (
                                    <span className="flex-shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-medium rounded-full bg-primary text-primary-foreground">
                                      {item.badge}
                                    </span>
                                  )}
                                </Link>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </nav>

        {/* Collapse Toggle */}
        <div className="border-t border-border p-2">
          <button
            onClick={onToggleCollapse}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg hover:bg-accent transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            ) : (
              <>
                <ChevronLeft className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    )
  }
)
WebSidebar.displayName = "WebSidebar"

// Default sections configuration with new hierarchy
export const defaultSidebarSections: SidebarSection[] = [
  {
    title: "Home & Work",
    defaultExpanded: true,
    collapsible: true,
    items: [
      {
        id: "home",
        label: "Home",
        icon: <Home className="w-5 h-5" />,
        href: "/home",
      },
      {
        id: "work-queue",
        label: "Work Queue",
        icon: <ListTodo className="w-5 h-5" />,
        href: "/work",
        badge: 12,
      },
      {
        id: "approvals",
        label: "Approvals",
        icon: <CheckSquare className="w-5 h-5" />,
        href: "/approvals",
        badge: 5,
        requiresRole: ["OWNER", "ADMIN"],
      },
      {
        id: "pending-actions",
        label: "Pending Actions",
        icon: <AlertCircle className="w-5 h-5" />,
        href: "/actions",
      },
    ],
  },
  {
    title: "Operations",
    collapsible: true,
    items: [
      {
        id: "customers",
        label: "Customers",
        icon: <UsersIcon className="w-5 h-5" />,
        href: "/customers",
      },
      {
        id: "customer-segments",
        label: "Customer Segments",
        icon: <Layers className="w-5 h-5" />,
        href: "/customers/segments",
      },
      {
        id: "jobs",
        label: "Jobs",
        icon: <Briefcase className="w-5 h-5" />,
        href: "/jobs",
      },
      {
        id: "quotes",
        label: "Quotes",
        icon: <FileText className="w-5 h-5" />,
        href: "/quotes",
      },
      {
        id: "schedule",
        label: "Schedule",
        icon: <Calendar className="w-5 h-5" />,
        href: "/schedule",
      },
      {
        id: "crews",
        label: "Crews",
        icon: <UsersIcon className="w-5 h-5" />,
        href: "/operations/crews",
      },
      {
        id: "crew-members",
        label: "Crew Members",
        icon: <User className="w-5 h-5" />,
        href: "/operations/crew-members",
      },
    ],
  },
  {
    title: "Finance",
    collapsible: true,
    items: [
      {
        id: "billing-overview",
        label: "Billing Overview",
        icon: <DollarSign className="w-5 h-5" />,
        href: "/billing",
      },
      {
        id: "invoices",
        label: "Invoices",
        icon: <Receipt className="w-5 h-5" />,
        href: "/billing/invoices",
      },
      {
        id: "payments",
        label: "Payments",
        icon: <CreditCard className="w-5 h-5" />,
        href: "/billing/payments",
      },
      {
        id: "billing-issues",
        label: "Billing Issues",
        icon: <AlertTriangle className="w-5 h-5" />,
        href: "/billing/issues",
      },
    ],
  },
  {
    title: "Support",
    collapsible: true,
    items: [
      {
        id: "support-queue",
        label: "Support Queue",
        icon: <Headphones className="w-5 h-5" />,
        href: "/support/queue",
        badge: 8,
      },
      {
        id: "coverage-gaps",
        label: "Coverage Gaps",
        icon: <TrendingUp className="w-5 h-5" />,
        href: "/support/gaps",
      },
    ],
  },
  {
    title: "Knowledge",
    collapsible: true,
    items: [
      {
        id: "knowledge-base",
        label: "Knowledge Base",
        icon: <BookOpen className="w-5 h-5" />,
        href: "/knowledge",
      },
      {
        id: "knowledge-builder",
        label: "Knowledge Builder",
        icon: <Hammer className="w-5 h-5" />,
        href: "/knowledge/builder",
      },
      {
        id: "knowledge-approvals",
        label: "Knowledge Approvals",
        icon: <FileCheck className="w-5 h-5" />,
        href: "/knowledge/approvals",
      },
      {
        id: "knowledge-reviews",
        label: "Knowledge Reviews",
        icon: <FileQuestion className="w-5 h-5" />,
        href: "/knowledge/reviews",
      },
    ],
  },
  {
    title: "Insights",
    collapsible: true,
    items: [
      {
        id: "analytics",
        label: "Analytics",
        icon: <BarChart3 className="w-5 h-5" />,
        href: "/analytics",
      },
    ],
  },
  {
    title: "Management",
    requiresRole: ["OWNER", "ADMIN"],
    collapsible: true,
    items: [
      {
        id: "agents",
        label: "Agents",
        icon: <Bot className="w-5 h-5" />,
        href: "/agents",
      },
      {
        id: "agent-events",
        label: "Agent Events",
        icon: <Zap className="w-5 h-5" />,
        href: "/events",
      },
    ],
  },
  {
    title: "Settings",
    requiresRole: ["OWNER", "ADMIN"],
    collapsible: true,
    items: [
      {
        id: "settings",
        label: "Settings",
        icon: <Settings className="w-5 h-5" />,
        href: "/settings",
      },
    ],
  },
]

export { WebSidebar }