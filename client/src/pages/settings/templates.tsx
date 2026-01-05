import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  Search,
  MessageSquare,
  Mail,
  ClipboardList,
  Edit,
  Copy,
  Trash2,
  Globe,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Template {
  id: number;
  name: string;
  category: string;
  channel: "SMS" | "EMAIL" | "BRIEFING";
  language: "en" | "es";
  subject?: string;
  body: string;
  variables: string[];
  isActive: boolean;
}

const channelIcons: Record<string, React.ElementType> = {
  SMS: MessageSquare,
  EMAIL: Mail,
  BRIEFING: ClipboardList,
};

const categoryLabels: Record<string, string> = {
  QUOTE: "Quotes",
  SCHEDULE: "Scheduling",
  BILLING: "Billing",
  CREW: "Crew Communications",
  REVIEW: "Reviews",
  GENERAL: "General",
};

export default function SettingsTemplatesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["/api/settings/templates"],
    staleTime: 60000,
  });

  const mockTemplates: Template[] = [
    {
      id: 1,
      name: "Quote Ready",
      category: "QUOTE",
      channel: "SMS",
      language: "en",
      body: "Hi {{customer_name}}! Your quote for {{service_name}} is ready. Total: {{quote_total}}. Reply YES to accept or call us to discuss.",
      variables: ["customer_name", "service_name", "quote_total"],
      isActive: true,
    },
    {
      id: 2,
      name: "Appointment Reminder",
      category: "SCHEDULE",
      channel: "SMS",
      language: "en",
      body: "Reminder: {{crew_name}} will arrive at {{address}} tomorrow between {{time_window}}. Reply if you need to reschedule.",
      variables: ["crew_name", "address", "time_window"],
      isActive: true,
    },
    {
      id: 3,
      name: "Invoice Reminder",
      category: "BILLING",
      channel: "EMAIL",
      language: "en",
      subject: "Invoice Reminder - {{invoice_number}}",
      body: "Hi {{customer_name}},\n\nThis is a friendly reminder that invoice {{invoice_number}} for ${{amount}} is due on {{due_date}}.\n\nPay online: {{payment_link}}\n\nThank you for your business!",
      variables: ["customer_name", "invoice_number", "amount", "due_date", "payment_link"],
      isActive: true,
    },
    {
      id: 4,
      name: "Daily Briefing",
      category: "CREW",
      channel: "BRIEFING",
      language: "en",
      body: "Good morning team! Today you have {{job_count}} jobs. First stop: {{first_address}} at {{first_time}}. Check your app for details.",
      variables: ["job_count", "first_address", "first_time"],
      isActive: true,
    },
    {
      id: 5,
      name: "Recordatorio de cita",
      category: "SCHEDULE",
      channel: "SMS",
      language: "es",
      body: "Recordatorio: {{crew_name}} llegara a {{address}} manana entre {{time_window}}. Responda si necesita reprogramar.",
      variables: ["crew_name", "address", "time_window"],
      isActive: true,
    },
  ];

  const allTemplates = templates.length > 0 ? templates : mockTemplates;

  const filteredTemplates = allTemplates.filter((template) => {
    const matchesSearch = !searchQuery || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.body.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesChannel = channelFilter === "all" || template.channel === channelFilter;
    return matchesSearch && matchesChannel;
  });

  const groupedByCategory = filteredTemplates.reduce((acc, template) => {
    const category = template.category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(template);
    return acc;
  }, {} as Record<string, Template[]>);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Comms & Templates</h1>
          <p className="text-muted-foreground">
            Manage SMS, email, and crew briefing templates
          </p>
        </div>
        <Button data-testid="button-add-template">
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search templates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-templates"
                  />
                </div>
              </div>
              <Tabs value={channelFilter} onValueChange={setChannelFilter} className="mt-2">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="SMS">SMS</TabsTrigger>
                  <TabsTrigger value="EMAIL">Email</TabsTrigger>
                  <TabsTrigger value="BRIEFING">Crew</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                {isLoading ? (
                  <div className="p-4 space-y-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
                    ))}
                  </div>
                ) : (
                  <div className="divide-y">
                    {Object.entries(groupedByCategory).map(([category, temps]) => (
                      <div key={category}>
                        <div className="px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
                          {categoryLabels[category] || category}
                        </div>
                        {temps.map((template) => {
                          const Icon = channelIcons[template.channel] || MessageSquare;
                          const isSelected = selectedTemplate?.id === template.id;
                          return (
                            <div
                              key={template.id}
                              className={`p-3 cursor-pointer transition-colors ${
                                isSelected ? "bg-accent" : "hover-elevate"
                              }`}
                              onClick={() => setSelectedTemplate(template)}
                              data-testid={`template-item-${template.id}`}
                            >
                              <div className="flex items-start gap-3">
                                <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium truncate">
                                      {template.name}
                                    </span>
                                    {template.language === "es" && (
                                      <Badge variant="outline" className="text-xs">
                                        <Globe className="h-3 w-3 mr-1" />
                                        ES
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                                    {template.body.slice(0, 50)}...
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="h-full">
            {selectedTemplate ? (
              <>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg">{selectedTemplate.name}</CardTitle>
                      <CardDescription>
                        {selectedTemplate.channel} template for {categoryLabels[selectedTemplate.category]?.toLowerCase()}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" data-testid="button-copy-template">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" data-testid="button-edit-template">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" data-testid="button-delete-template">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedTemplate.subject && (
                    <div>
                      <label className="text-sm font-medium">Subject</label>
                      <Input value={selectedTemplate.subject} readOnly className="mt-1" />
                    </div>
                  )}
                  
                  <div>
                    <label className="text-sm font-medium">Message Body</label>
                    <Textarea 
                      value={selectedTemplate.body} 
                      readOnly 
                      className="mt-1 min-h-[150px]"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Variables</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedTemplate.variables.map((variable) => (
                        <Badge key={variable} variant="secondary">
                          {`{{${variable}}}`}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {channelIcons[selectedTemplate.channel] && (
                          <span className="mr-1">
                            {(() => {
                              const Icon = channelIcons[selectedTemplate.channel];
                              return <Icon className="h-3 w-3" />;
                            })()}
                          </span>
                        )}
                        {selectedTemplate.channel}
                      </Badge>
                    </div>
                    <Badge variant={selectedTemplate.isActive ? "outline" : "secondary"}>
                      {selectedTemplate.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardContent>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Select a template</h3>
                <p className="text-sm text-muted-foreground">
                  Choose a template from the list to view and edit
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
