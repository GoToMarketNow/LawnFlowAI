import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageCircle,
  X,
  Send,
  Minimize2,
  Maximize2,
  Bot,
  User,
  CheckCircle,
  XCircle,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getQueryFn, apiRequest } from "@/lib/queryClient";

interface ChatMessage {
  id: number;
  role: "customer" | "assistant";
  content: string;
  citations?: Citation[];
  actionRequest?: ActionRequest;
  timestamp: string;
}

interface Citation {
  knowledgeItemId: number;
  versionId: number;
  title: string;
  itemType: string;
  snippet: string;
}

interface ActionRequest {
  actionId: string;
  actionType: string;
  description: string;
  parameters: Record<string, any>;
  status: "pending" | "confirmed" | "rejected";
}

interface Conversation {
  id: number;
  customerId: number;
  status: "active" | "resolved";
  messages: ChatMessage[];
  createdAt: string;
}

interface PendingAction {
  id: string;
  conversationId: number;
  actionType: string;
  description: string;
  parameters: Record<string, any>;
  createdAt: string;
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function CitationBadge({ citation, index }: { citation: Citation; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="inline-block relative">
      <button
        className="inline-flex items-center gap-0.5 text-xs bg-primary/10 hover:bg-primary/20 text-primary px-1.5 py-0.5 rounded transition-colors"
        onClick={() => setExpanded(!expanded)}
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
      >
        [{index}]
      </button>
      {expanded && (
        <Card className="absolute bottom-full left-0 mb-2 w-64 z-50 shadow-lg">
          <CardContent className="p-3 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-sm font-medium line-clamp-2">{citation.title}</h4>
              <Badge variant="outline" className="text-xs flex-shrink-0">
                {citation.itemType}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-3">{citation.snippet}</p>
            <a
              href={`/knowledge/${citation.knowledgeItemId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              View full article
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MessageBubble({ message, isLatest }: { message: ChatMessage; isLatest: boolean }) {
  const isCustomer = message.role === "customer";

  return (
    <div className={`flex ${isCustomer ? "justify-end" : "justify-start"} mb-4`}>
      <div className={`max-w-[85%] ${isCustomer ? "items-end" : "items-start"} flex flex-col`}>
        <div className="flex items-center gap-2 mb-1">
          {!isCustomer && <Bot className="h-3 w-3 text-primary" />}
          <span className="text-xs text-muted-foreground">
            {isCustomer ? "You" : "AI Assistant"} • {formatTime(message.timestamp)}
          </span>
        </div>
        <div
          className={`rounded-lg px-3 py-2 ${
            isCustomer
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground border border-border"
          }`}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          {message.citations && message.citations.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border/50">
              <div className="text-xs text-muted-foreground mb-1">Sources:</div>
              <div className="flex flex-wrap gap-1">
                {message.citations.map((citation, idx) => (
                  <CitationBadge key={citation.knowledgeItemId} citation={citation} index={idx + 1} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionConfirmation({
  action,
  onConfirm,
  onReject,
}: {
  action: ActionRequest;
  onConfirm: () => void;
  onReject: () => void;
}) {
  return (
    <Alert className="mb-4 border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20">
      <AlertDescription className="space-y-3">
        <div>
          <h4 className="font-medium text-sm mb-1">Action Required</h4>
          <p className="text-sm text-muted-foreground">{action.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={action.status !== "pending"}
            className="flex-1"
          >
            <CheckCircle className="h-3.5 w-3.5 mr-1" />
            Confirm
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onReject}
            disabled={action.status !== "pending"}
            className="flex-1"
          >
            <XCircle className="h-3.5 w-3.5 mr-1" />
            Cancel
          </Button>
        </div>
        {action.status === "confirmed" && (
          <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            Action confirmed and executed
          </div>
        )}
        {action.status === "rejected" && (
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Action cancelled
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

export default function CustomerChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: conversation } = useQuery<Conversation>({
    queryKey: [`/api/assistant/conversations/${conversationId}`],
    queryFn: getQueryFn({
      on200: (data) => data,
    }),
    enabled: !!conversationId && isOpen,
    refetchInterval: 3000, // Poll every 3 seconds for new messages
  });

  const { data: pendingActions } = useQuery<PendingAction[]>({
    queryKey: ["/api/assistant/actions/pending"],
    queryFn: getQueryFn({
      on200: (data) => data,
    }),
    enabled: !!conversationId && isOpen,
    refetchInterval: 3000,
  });

  const startConversationMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/assistant/conversations", {}),
    onSuccess: (data: Conversation) => {
      setConversationId(data.id);
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest("POST", `/api/assistant/conversations/${conversationId}/messages`, {
        content,
        role: "customer",
      }),
    onSuccess: () => {
      setMessageInput("");
      setIsTyping(true);
      queryClient.invalidateQueries({
        queryKey: [`/api/assistant/conversations/${conversationId}`],
      });
      // Simulate typing indicator
      setTimeout(() => setIsTyping(false), 2000);
    },
  });

  const confirmActionMutation = useMutation({
    mutationFn: (actionId: string) =>
      apiRequest("POST", `/api/assistant/actions/${actionId}/confirm`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assistant/actions/pending"] });
      queryClient.invalidateQueries({
        queryKey: [`/api/assistant/conversations/${conversationId}`],
      });
    },
  });

  const rejectActionMutation = useMutation({
    mutationFn: (actionId: string) =>
      apiRequest("POST", `/api/assistant/actions/${actionId}/reject`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assistant/actions/pending"] });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages]);

  const handleOpen = () => {
    setIsOpen(true);
    if (!conversationId) {
      startConversationMutation.mutate();
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsMinimized(false);
  };

  const handleSendMessage = () => {
    if (messageInput.trim() && conversationId) {
      sendMessageMutation.mutate(messageInput);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isOpen) {
    return (
      <Button
        size="lg"
        className="fixed bottom-6 right-6 rounded-full shadow-lg h-14 w-14 p-0 z-50"
        onClick={handleOpen}
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <Card
      className={`fixed bottom-6 right-6 shadow-2xl z-50 transition-all ${
        isMinimized ? "w-80 h-14" : "w-96 h-[600px]"
      }`}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 border-b">
        <CardTitle className="text-base flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          AI Support Assistant
          <Badge variant="outline" className="text-xs">
            <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1" />
            Online
          </Badge>
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      {!isMinimized && (
        <>
          <CardContent className="p-0 flex flex-col h-[calc(100%-4rem)]">
            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {!conversation?.messages?.length && !isTyping ? (
                <div className="text-center py-12">
                  <Bot className="h-12 w-12 text-primary mx-auto mb-4 opacity-50" />
                  <h3 className="text-sm font-semibold mb-2">Welcome!</h3>
                  <p className="text-sm text-muted-foreground px-4">
                    I'm here to help answer your questions about our services, pricing, and policies.
                    How can I assist you today?
                  </p>
                </div>
              ) : (
                <>
                  {conversation?.messages.map((message, idx) => (
                    <div key={message.id}>
                      <MessageBubble
                        message={message}
                        isLatest={idx === conversation.messages.length - 1}
                      />
                      {message.actionRequest && (
                        <ActionConfirmation
                          action={message.actionRequest}
                          onConfirm={() => confirmActionMutation.mutate(message.actionRequest!.actionId)}
                          onReject={() => rejectActionMutation.mutate(message.actionRequest!.actionId)}
                        />
                      )}
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex justify-start mb-4">
                      <div className="bg-muted rounded-lg px-4 py-3 flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-sm text-muted-foreground">Assistant is typing...</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </ScrollArea>

            {/* Pending Actions Alert */}
            {pendingActions && pendingActions.length > 0 && (
              <div className="px-4 pb-2">
                <Alert className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20">
                  <AlertDescription className="text-xs">
                    {pendingActions.length} action{pendingActions.length !== 1 ? "s" : ""} pending confirmation
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Type your message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sendMessageMutation.isPending || !conversationId}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  onClick={handleSendMessage}
                  disabled={!messageInput.trim() || sendMessageMutation.isPending || !conversationId}
                  className="px-3"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Press Enter to send • Powered by AI
              </p>
            </div>
          </CardContent>
        </>
      )}
    </Card>
  );
}
