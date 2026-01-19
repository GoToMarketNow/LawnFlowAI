import * as React from "react"
import { cn } from "../ui/utils"
import { FileText, Copy, Check } from "lucide-react"

export interface KnowledgeMacro {
  id: string
  title: string
  content: string
  category: string
  useCount?: number
}

export interface WebKnowledgeMacroProps {
  macro: KnowledgeMacro
  onUse?: (macro: KnowledgeMacro) => void
  compact?: boolean
}

const WebKnowledgeMacro: React.FC<WebKnowledgeMacroProps> = ({ macro, onUse, compact = false }) => {
  const [copied, setCopied] = React.useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(macro.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (compact) {
    return (
      <button
        onClick={() => onUse?.(macro)}
        className="w-full text-left bg-card border border-border rounded-lg p-3 hover:border-primary/50 hover:bg-primary/5 transition-all"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <p className="text-sm font-medium truncate">{macro.title}</p>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{macro.content}</p>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {macro.category}
          </span>
        </div>
      </button>
    )
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <h4 className="font-medium text-sm">{macro.title}</h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded">
            {macro.category}
          </span>
          {macro.useCount !== undefined && (
            <span className="text-xs text-muted-foreground">
              Used {macro.useCount}x
            </span>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-3">{macro.content}</p>

      <div className="flex gap-2">
        <button
          onClick={() => onUse?.(macro)}
          className="flex-1 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Use Response
        </button>
        <button
          onClick={handleCopy}
          className="px-3 py-1.5 text-sm font-medium bg-muted text-foreground rounded-md hover:bg-muted/80 transition-colors flex items-center gap-1.5"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              Copy
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export { WebKnowledgeMacro }
