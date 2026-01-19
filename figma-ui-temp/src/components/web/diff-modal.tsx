import * as React from "react"
import { cn } from "../ui/utils"
import { WebModal } from "./modal"
import { WebButton } from "./button"
import { GitCompare, ArrowLeft, ArrowRight } from "lucide-react"

export interface DiffChange {
  type: "added" | "removed" | "unchanged"
  content: string
  lineNumber?: number
}

export interface WebDiffModalProps {
  open: boolean
  onClose: () => void
  leftVersion: {
    label: string
    content: string
  }
  rightVersion: {
    label: string
    content: string
  }
  title?: string
}

const WebDiffModal: React.FC<WebDiffModalProps> = ({
  open,
  onClose,
  leftVersion,
  rightVersion,
  title = "Version Comparison",
}) => {
  // Simple diff algorithm - split by lines and compare
  const generateDiff = () => {
    const leftLines = leftVersion.content.split("\n")
    const rightLines = rightVersion.content.split("\n")
    const maxLength = Math.max(leftLines.length, rightLines.length)

    const leftDiff: DiffChange[] = []
    const rightDiff: DiffChange[] = []

    for (let i = 0; i < maxLength; i++) {
      const leftLine = leftLines[i] || ""
      const rightLine = rightLines[i] || ""

      if (leftLine === rightLine) {
        leftDiff.push({ type: "unchanged", content: leftLine, lineNumber: i + 1 })
        rightDiff.push({ type: "unchanged", content: rightLine, lineNumber: i + 1 })
      } else {
        if (leftLine) {
          leftDiff.push({ type: "removed", content: leftLine, lineNumber: i + 1 })
        }
        if (rightLine) {
          rightDiff.push({ type: "added", content: rightLine, lineNumber: i + 1 })
        }
      }
    }

    return { leftDiff, rightDiff }
  }

  const { leftDiff, rightDiff } = generateDiff()

  const renderDiffLine = (change: DiffChange) => {
    const bgColor =
      change.type === "added"
        ? "bg-success/10"
        : change.type === "removed"
        ? "bg-destructive/10"
        : "bg-transparent"

    const borderColor =
      change.type === "added"
        ? "border-l-2 border-l-success"
        : change.type === "removed"
        ? "border-l-2 border-l-destructive"
        : ""

    const prefix =
      change.type === "added" ? "+" : change.type === "removed" ? "-" : " "

    return (
      <div
        key={`${change.lineNumber}-${change.type}`}
        className={cn("px-3 py-1 font-mono text-xs", bgColor, borderColor)}
      >
        <span className="text-muted-foreground mr-4 inline-block w-8 text-right">
          {change.lineNumber}
        </span>
        <span className={cn(
          "mr-2 font-bold",
          change.type === "added" && "text-success",
          change.type === "removed" && "text-destructive"
        )}>
          {prefix}
        </span>
        <span>{change.content || " "}</span>
      </div>
    )
  }

  return (
    <WebModal
      open={open}
      onClose={onClose}
      title={title}
      description="Compare changes between versions"
      size="xl"
      footer={
        <div className="flex justify-end">
          <WebButton variant="primary" onClick={onClose}>
            Close
          </WebButton>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Version Headers */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <ArrowLeft className="w-4 h-4 text-destructive" />
            <span>{leftVersion.label}</span>
          </div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <ArrowRight className="w-4 h-4 text-success" />
            <span>{rightVersion.label}</span>
          </div>
        </div>

        {/* Side-by-side diff */}
        <div className="grid grid-cols-2 gap-4 border border-border rounded-lg overflow-hidden">
          {/* Left (old version) */}
          <div className="border-r border-border bg-muted/30 overflow-auto max-h-[500px]">
            {leftDiff.map((change, index) => (
              <React.Fragment key={index}>{renderDiffLine(change)}</React.Fragment>
            ))}
          </div>

          {/* Right (new version) */}
          <div className="bg-muted/30 overflow-auto max-h-[500px]">
            {rightDiff.map((change, index) => (
              <React.Fragment key={index}>{renderDiffLine(change)}</React.Fragment>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-success/20 border border-success rounded" />
            <span>
              {rightDiff.filter((c) => c.type === "added").length} additions
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-destructive/20 border border-destructive rounded" />
            <span>
              {leftDiff.filter((c) => c.type === "removed").length} deletions
            </span>
          </div>
        </div>
      </div>
    </WebModal>
  )
}

export { WebDiffModal }
