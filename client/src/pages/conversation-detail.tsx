import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import {
  ArrowLeft,
  Phone,
  MessageSquare,
  Globe,
  User,
  Bot,
  Settings,
  Send,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Conversation, Message } from "@shared/schema";

const statusColors: Record<string, string> = {
  active: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  qualified: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  scheduled: "bg-green-500/10 text-green-600 dark:text-green-400",
  completed: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  lost: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const sourceIcons: Record<string, React.ReactNode> = {
  missed_call: <Phone className="h-4 w-4" />,
  inbound_sms: <MessageSquare className="h-4 w-4" />,
  web_lead: <Globe className="h-4 w-4" />,
};

function MessageBubble({ message }: { message: Message }) {
  const isCustomer = message.role === "customer";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="flex justify-center my-4" data-testid={`message-${message.id}`}>
        <div className="px-4 py-2 rounded-full bg-muted/50 border border-dashed border-border">
          <div className="flex items-center gap-2">
            <Settings className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground italic">
              {message.content}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex gap-3 mb-4 ${isCustomer ? "justify-start" : "justify-end"}`}
      data-testid={`message-${message.id}`}
    >
      {isCustomer && (
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
          <User className="h-4 w-4" />
        </div>
      )}
      <div
        className={`max-w-[70%] rounded-lg px-4 py-2.5 ${
          isCustomer
            ? "bg-muted text-foreground"
            : "bg-primary text-primary-foreground"
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        <p
          className={`text-xs mt-1 ${
            isCustomer ? "text-muted-foreground" : "text-primary-foreground/70"
          }`}
        >
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
      {!isCustomer && (
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
    </div>
  );
}

export default function ConversationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [newMessage, setNewMessage] = useState("");

  const { data: conversation, isLoading: loadingConversation } = useQuery<Conversation>({
    queryKey: ["/api/conversations", id],
  });

  const { data: messages, isLoading: loadingMessages } = useQuery<Message[]>({
    queryKey: ["/api/conversations", id, "messages"],
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", `/api/conversations/${id}/messages`, { content, role: "ai" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", id, "messages"] });
      setNewMessage("");
    },
  });

  const isLoading = loadingConversation || loadingMessages;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9" />
          <div>
            <Skeleton className="h-6 w-40 mb-1" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`flex gap-3 ${i % 2 ? "" : "justify-end"}`}>
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="h-16 w-64 rounded-lg" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-1">Conversation not found</h3>
            <Link href="/conversations">
              <Button variant="outline" className="mt-4">
                Back to Conversations
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/conversations">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              {sourceIcons[conversation.source] || <MessageSquare className="h-5 w-5" />}
            </div>
            <div>
              <h1 className="text-lg font-semibold" data-testid="text-customer-name">
                {conversation.customerName || "Unknown Customer"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {conversation.customerPhone}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {conversation.agentType && (
            <Badge variant="secondary">{conversation.agentType} agent</Badge>
          )}
          <Badge variant="outline" className={statusColors[conversation.status]}>
            {conversation.status}
          </Badge>
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="border-b py-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Conversation Thread
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full p-4">
            {messages && messages.length > 0 ? (
              messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No messages yet</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
        <div className="border-t p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newMessage.trim()) {
                sendMessageMutation.mutate(newMessage.trim());
              }
            }}
            className="flex gap-2"
          >
            <Input
              placeholder="Type a message to send as AI..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={sendMessageMutation.isPending}
              data-testid="input-new-message"
            />
            <Button
              type="submit"
              disabled={!newMessage.trim() || sendMessageMutation.isPending}
              data-testid="button-send-message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
