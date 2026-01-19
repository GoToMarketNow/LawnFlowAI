import * as React from "react"
import { cn } from "../ui/utils"
import { User, Bot, Clock } from "lucide-react"

export interface ConversationMessage {
  id: string
  sender: "customer" | "agent" | "ai"
  senderName: string
  message: string
  timestamp: string
  attachments?: Array<{
    name: string
    url: string
    type: string
  }>
}

export interface WebConversationTimelineProps {
  messages: ConversationMessage[]
}

const WebConversationTimeline: React.FC<WebConversationTimelineProps> = ({ messages }) => {
  return (
    <div className="space-y-4">
      {messages.map((message, index) => {
        const isCustomer = message.sender === "customer"
        const isAI = message.sender === "ai"

        return (
          <div
            key={message.id}
            className={cn("flex gap-3", isCustomer ? "flex-row" : "flex-row-reverse")}
          >
            {/* Avatar */}
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                isCustomer && "bg-muted",
                isAI && "bg-primary/10",
                !isCustomer && !isAI && "bg-success/10"
              )}
            >
              {isCustomer && <User className="w-4 h-4 text-muted-foreground" />}
              {isAI && <Bot className="w-4 h-4 text-primary" />}
              {!isCustomer && !isAI && <User className="w-4 h-4 text-success" />}
            </div>

            {/* Message Bubble */}
            <div className={cn("flex-1 max-w-[80%]", isCustomer ? "items-start" : "items-end")}>
              <div className={cn("flex items-baseline gap-2 mb-1", !isCustomer && "flex-row-reverse")}>
                <span className="text-sm font-medium">{message.senderName}</span>
                <span className="text-xs text-muted-foreground">{message.timestamp}</span>
              </div>

              <div
                className={cn(
                  "rounded-lg p-3 text-sm",
                  isCustomer && "bg-muted",
                  isAI && "bg-primary/10 border border-primary/20",
                  !isCustomer && !isAI && "bg-success/10 border border-success/20"
                )}
              >
                <p className="whitespace-pre-wrap">{message.message}</p>

                {/* Attachments */}
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {message.attachments.map((attachment, idx) => (
                      <a
                        key={idx}
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-primary hover:underline"
                      >
                        <span className="w-6 h-6 bg-primary/10 rounded flex items-center justify-center">
                          📎
                        </span>
                        <span>{attachment.name}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {isAI && (
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <Bot className="w-3 h-3" />
                  <span>AI-generated response</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export { WebConversationTimeline }
