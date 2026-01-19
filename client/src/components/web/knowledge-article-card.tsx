import * as React from "react"
import { cn } from "../ui/utils"
import { WebVersionBadge, VersionStatus } from "./version-badge"
import { WebBadge } from "./badge"
import { FileText, Eye, ThumbsUp, Clock, User, Tag } from "lucide-react"

export interface KnowledgeArticle {
  id: string
  title: string
  summary: string
  category: string
  tags: string[]
  version: string
  status: VersionStatus
  author: string
  lastModified: string
  views?: number
  helpful?: number
  coverageScore?: number
}

export interface WebKnowledgeArticleCardProps {
  article: KnowledgeArticle
  onClick?: () => void
  onApprove?: () => void
  onReject?: () => void
  showActions?: boolean
}

const WebKnowledgeArticleCard: React.FC<WebKnowledgeArticleCardProps> = ({
  article,
  onClick,
  onApprove,
  onReject,
  showActions = false,
}) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card border border-border rounded-lg p-5 transition-all",
        onClick && "cursor-pointer hover:border-primary/50 hover:shadow-[var(--elevation-1)]"
      )}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <h3 className="font-semibold truncate">{article.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{article.summary}</p>
          </div>
          <WebVersionBadge version={article.version} status={article.status} size="sm" />
        </div>

        {/* Category & Tags */}
        <div className="flex items-center gap-2 flex-wrap">
          <WebBadge variant="neutral" size="sm">
            {article.category}
          </WebBadge>
          {article.tags.slice(0, 3).map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted text-muted-foreground text-xs rounded"
            >
              <Tag className="w-2.5 h-2.5" />
              {tag}
            </span>
          ))}
          {article.tags.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{article.tags.length - 3} more
            </span>
          )}
        </div>

        {/* Metadata */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <User className="w-3 h-3" />
              <span>{article.author}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{article.lastModified}</span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-3 text-xs">
            {article.views !== undefined && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Eye className="w-3 h-3" />
                <span>{article.views}</span>
              </div>
            )}
            {article.helpful !== undefined && (
              <div className="flex items-center gap-1 text-success">
                <ThumbsUp className="w-3 h-3" />
                <span>{article.helpful}%</span>
              </div>
            )}
            {article.coverageScore !== undefined && (
              <div className="flex items-center gap-1">
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    article.coverageScore >= 80
                      ? "bg-success"
                      : article.coverageScore >= 50
                      ? "bg-warning"
                      : "bg-destructive"
                  )}
                />
                <span className="text-muted-foreground">{article.coverageScore}% coverage</span>
              </div>
            )}
          </div>
        </div>

        {/* Approval Actions */}
        {showActions && (
          <div className="flex gap-2 pt-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onApprove?.()
              }}
              className="flex-1 px-3 py-1.5 text-sm font-medium bg-success/10 text-success rounded-md hover:bg-success/20 transition-colors"
            >
              Approve
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onReject?.()
              }}
              className="flex-1 px-3 py-1.5 text-sm font-medium bg-destructive/10 text-destructive rounded-md hover:bg-destructive/20 transition-colors"
            >
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export { WebKnowledgeArticleCard }
