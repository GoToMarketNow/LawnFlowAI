import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageSquare, 
  Send,
  Eye,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Search,
  Filter,
  Sparkles,
  Copy,
  Check
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/ui/empty-state";

interface MessageTemplate {
  id: string;
  intentType: string;
  serviceCategory: string;
  version: string;
  name: string;
  description?: string;
  template: string;
  requiredTokens: string[];
  optionalTokens: string[];
  toneGuidelines?: string;
  maxLength?: number;
  active: boolean;
}

interface IntentType {
  type: string;
  name: string;
  description: string;
  defaultPriority: string;
  requiresApprovalDefault: boolean;
  allowedChannels: string[];
  journeyStage: string;
}

interface PreviewResult {
  template: {
    id: string;
    name: string;
    intentType: string;
  };
  rendered: string;
  characterCount: number;
  segments: number;
  warnings: string[];
}

interface PendingApproval {
  id: string;
  intentType: string;
  recipientPhone: string;
  recipientName?: string;
  createdAt: string;
  priority: string;
  business: {
    businessName: string;
  };
}

function TemplateCard({ template, onPreview }: { template: MessageTemplate; onPreview: (t: MessageTemplate) => void }) {
  return (
    <Card className="hover-elevate cursor-pointer" onClick={() => onPreview(template)} data-testid={`template-card-${template.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{template.name}</CardTitle>
            <CardDescription className="text-xs mt-1">{template.description}</CardDescription>
          </div>
          <Badge variant={template.active ? "default" : "secondary"} className="shrink-0">
            {template.active ? "Active" : "Inactive"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">{template.intentType}</Badge>
            <Badge variant="outline" className="text-xs">{template.serviceCategory}</Badge>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 font-mono bg-muted p-2 rounded">
            {template.template.substring(0, 100)}...
          </p>
          <div className="flex gap-1 flex-wrap">
            {template.requiredTokens.slice(0, 3).map(token => (
              <Badge key={token} variant="secondary" className="text-xs">
                {token}
              </Badge>
            ))}
            {template.requiredTokens.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{template.requiredTokens.length - 3} more
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TemplatesBrowser({ onSelectTemplate }: { onSelectTemplate: (t: MessageTemplate) => void }) {
  const [filter, setFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [intentFilter, setIntentFilter] = useState<string>("all");

  const { data: templates, isLoading } = useQuery<MessageTemplate[]>({
    queryKey: ["/api/comms/v2/templates"],
  });

  const { data: intentTypes } = useQuery<IntentType[]>({
    queryKey: ["/api/comms/v2/intent-types"],
  });

  const filteredTemplates = templates?.filter(t => {
    const matchesSearch = filter === "" || 
      t.name.toLowerCase().includes(filter.toLowerCase()) ||
      t.template.toLowerCase().includes(filter.toLowerCase());
    const matchesCategory = categoryFilter === "all" || t.serviceCategory === categoryFilter;
    const matchesIntent = intentFilter === "all" || t.intentType === intentFilter;
    return matchesSearch && matchesCategory && matchesIntent;
  });

  const categories = Array.from(new Set(templates?.map(t => t.serviceCategory) || []));
  const intents = Array.from(new Set(templates?.map(t => t.intentType) || []));

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-9"
            data-testid="input-template-search"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-category-filter">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={intentFilter} onValueChange={setIntentFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-intent-filter">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Intent Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Intents</SelectItem>
            {intents.map(intent => (
              <SelectItem key={intent} value={intent}>{intent}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredTemplates?.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No templates found"
          description="No templates match your search criteria."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates?.map((template) => (
            <TemplateCard key={template.id} template={template} onPreview={onSelectTemplate} />
          ))}
        </div>
      )}
    </div>
  );
}

function IntentTypesList() {
  const { data: intentTypes, isLoading } = useQuery<IntentType[]>({
    queryKey: ["/api/comms/v2/intent-types"],
  });

  const groupedByStage = intentTypes?.reduce((acc, intent) => {
    const stage = intent.journeyStage;
    if (!acc[stage]) acc[stage] = [];
    acc[stage].push(intent);
    return acc;
  }, {} as Record<string, IntentType[]>);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-1/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedByStage || {}).map(([stage, intents]) => (
        <Card key={stage}>
          <CardHeader>
            <CardTitle className="text-lg">{stage.replace(/_/g, " ")}</CardTitle>
            <CardDescription>{intents.length} intent types</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {intents.map(intent => (
                <div 
                  key={intent.type} 
                  className="border rounded-md p-3 space-y-2"
                  data-testid={`intent-type-${intent.type}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-medium text-sm">{intent.name}</h4>
                      <p className="text-xs text-muted-foreground">{intent.description}</p>
                    </div>
                    <Badge 
                      variant={intent.defaultPriority === "urgent" ? "destructive" : 
                              intent.defaultPriority === "high" ? "default" : "secondary"}
                    >
                      {intent.defaultPriority}
                    </Badge>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {intent.allowedChannels.map(channel => (
                      <Badge key={channel} variant="outline" className="text-xs">{channel}</Badge>
                    ))}
                    {intent.requiresApprovalDefault && (
                      <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-300">
                        Requires Approval
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MessagePreview({ selectedTemplate }: { selectedTemplate: MessageTemplate | null }) {
  const [context, setContext] = useState<Record<string, string>>({
    firstName: "John",
    lastName: "Smith",
    businessName: "Green Ridge Lawn Care",
    businessPhone: "(434) 555-1234",
    serviceType: "lawn mowing",
    formattedTotal: "$150",
    scheduledDate: "Monday, Jan 6th",
    scheduledTimeWindow: "9am - 12pm",
  });
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const previewMutation = useMutation({
    mutationFn: async (data: { templateId: string; intentType: string; serviceCategory: string; context: Record<string, string> }) => {
      const res = await apiRequest("POST", "/api/comms/v2/preview", data);
      return res.json();
    },
  });

  const handlePreview = () => {
    if (!selectedTemplate) return;
    previewMutation.mutate({
      templateId: selectedTemplate.id,
      intentType: selectedTemplate.intentType,
      serviceCategory: selectedTemplate.serviceCategory,
      context,
    });
  };

  const handleCopy = () => {
    if (previewMutation.data?.rendered) {
      navigator.clipboard.writeText(previewMutation.data.rendered);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied to clipboard" });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Preview Variables
          </CardTitle>
          <CardDescription>
            Edit these values to see how the message will look
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {Object.entries(context).map(([key, value]) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={key} className="text-xs font-medium">
                    {key}
                    {selectedTemplate?.requiredTokens.includes(key) && (
                      <span className="text-destructive ml-1">*</span>
                    )}
                  </Label>
                  <Input
                    id={key}
                    value={value}
                    onChange={(e) => setContext({ ...context, [key]: e.target.value })}
                    className="h-8 text-sm"
                    data-testid={`input-preview-${key}`}
                  />
                </div>
              ))}
            </div>
          </ScrollArea>
          <Button 
            onClick={handlePreview} 
            className="w-full mt-4"
            disabled={!selectedTemplate || previewMutation.isPending}
            data-testid="button-preview-message"
          >
            {previewMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Eye className="h-4 w-4 mr-2" />
            )}
            Preview Message
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Message Preview
              </CardTitle>
              <CardDescription>
                {selectedTemplate ? selectedTemplate.name : "Select a template to preview"}
              </CardDescription>
            </div>
            {previewMutation.data && (
              <Button
                size="icon"
                variant="ghost"
                onClick={handleCopy}
                data-testid="button-copy-message"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!selectedTemplate ? (
            <EmptyState
              icon={FileText}
              title="No template selected"
              description="Select a template from the Templates tab to preview"
            />
          ) : previewMutation.data ? (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-4 font-mono text-sm whitespace-pre-wrap">
                {previewMutation.data.rendered}
              </div>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>{previewMutation.data.characterCount} characters</span>
                <span>{previewMutation.data.segments} SMS segment{previewMutation.data.segments !== 1 ? "s" : ""}</span>
              </div>
              {previewMutation.data.warnings?.length > 0 && (
                <div className="space-y-1">
                  {previewMutation.data.warnings.map((warning: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                      {warning}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Click Preview to see the rendered message</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PendingApprovals() {
  const { toast } = useToast();
  
  const { data: approvals, isLoading, refetch } = useQuery<PendingApproval[]>({
    queryKey: ["/api/comms/v2/pending-approvals"],
  });

  const approveMutation = useMutation({
    mutationFn: async (intentId: string) => {
      const res = await apiRequest("POST", `/api/comms/v2/approve/${intentId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Message approved and sent" });
      queryClient.invalidateQueries({ queryKey: ["/api/comms/v2/pending-approvals"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to approve", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (intentId: string) => {
      const res = await apiRequest("POST", `/api/comms/v2/reject/${intentId}`, { reason: "Rejected by owner" });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Message rejected" });
      queryClient.invalidateQueries({ queryKey: ["/api/comms/v2/pending-approvals"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to reject", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-16 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!approvals?.length) {
    return (
      <EmptyState
        icon={CheckCircle}
        title="No pending approvals"
        description="All messages have been reviewed. New messages requiring approval will appear here."
      />
    );
  }

  return (
    <div className="space-y-4">
      {approvals.map((approval) => (
        <Card key={approval.id} data-testid={`approval-card-${approval.id}`}>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={approval.priority === "urgent" ? "destructive" : "default"}>
                    {approval.intentType.replace(/_/g, " ")}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    to {approval.recipientPhone}
                  </span>
                </div>
                <p className="text-sm">
                  {approval.recipientName || "Customer"} - {approval.business.businessName}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Pending since {new Date(approval.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => rejectMutation.mutate(approval.id)}
                  disabled={rejectMutation.isPending || approveMutation.isPending}
                  data-testid={`button-reject-${approval.id}`}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  onClick={() => approveMutation.mutate(approval.id)}
                  disabled={rejectMutation.isPending || approveMutation.isPending}
                  data-testid={`button-approve-${approval.id}`}
                >
                  {approveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Send className="h-4 w-4 mr-1" />
                  )}
                  Approve & Send
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function CommsStudio() {
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [activeTab, setActiveTab] = useState("templates");

  const handleSelectTemplate = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    setActiveTab("preview");
  };

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Comms Studio</h1>
          <p className="text-muted-foreground">
            Preview, customize, and manage customer communication templates
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="tabs-comms-studio">
          <TabsTrigger value="templates" data-testid="tab-templates">
            <FileText className="h-4 w-4 mr-2" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="intents" data-testid="tab-intents">
            <MessageSquare className="h-4 w-4 mr-2" />
            Intent Types
          </TabsTrigger>
          <TabsTrigger value="preview" data-testid="tab-preview">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="approvals" data-testid="tab-approvals">
            <Clock className="h-4 w-4 mr-2" />
            Pending Approvals
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-6">
          <TemplatesBrowser onSelectTemplate={handleSelectTemplate} />
        </TabsContent>

        <TabsContent value="intents" className="mt-6">
          <IntentTypesList />
        </TabsContent>

        <TabsContent value="preview" className="mt-6">
          <MessagePreview selectedTemplate={selectedTemplate} />
        </TabsContent>

        <TabsContent value="approvals" className="mt-6">
          <PendingApprovals />
        </TabsContent>
      </Tabs>
    </div>
  );
}
