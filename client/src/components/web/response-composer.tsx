import * as React from "react"
import { cn } from "../ui/utils"
import { Send, Paperclip, Smile, Sparkles } from "lucide-react"
import { WebButton } from "./button"

export interface WebResponseComposerProps {
  onSend?: (message: string) => void
  onAISuggest?: () => void
  placeholder?: string
  showAISuggest?: boolean
  disabled?: boolean
}

const WebResponseComposer: React.FC<WebResponseComposerProps> = ({
  onSend,
  onAISuggest,
  placeholder = "Type your response...",
  showAISuggest = true,
  disabled = false,
}) => {
  const [message, setMessage] = React.useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim() && !disabled) {
      onSend?.(message)
      setMessage("")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-border bg-card">
      <div className="p-4 space-y-3">
        {/* AI Suggest Button */}
        {showAISuggest && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onAISuggest}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors"
              disabled={disabled}
            >
              <Sparkles className="w-3 h-3" />
              Generate AI Response
            </button>
          </div>
        )}

        {/* Text Area */}
        <div className="relative">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              "w-full min-h-[100px] px-4 py-3 pr-12 bg-muted border border-border rounded-lg",
              "text-sm placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent",
              "resize-none",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleSubmit(e)
              }
            }}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              disabled={disabled}
              title="Attach file"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              disabled={disabled}
              title="Add emoji"
            >
              <Smile className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {message.length} characters
            </span>
            <WebButton
              type="submit"
              variant="primary"
              size="sm"
              disabled={!message.trim() || disabled}
            >
              <Send className="w-4 h-4 mr-2" />
              Send
            </WebButton>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">⌘</kbd> +{" "}
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs">Enter</kbd> to send
        </p>
      </div>
    </form>
  )
}

export { WebResponseComposer }
