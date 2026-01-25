import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  Phone,
  MessageSquare,
  Globe,
  Zap,
  Send,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SimulationResult {
  success: boolean;
  message: string;
  conversationId?: number;
  eventId?: number;
}

export default function SimulatorPage() {
  const { toast } = useToast();
  const [result, setResult] = useState<SimulationResult | null>(null);

  // Missed call form state
  const [missedCallPhone, setMissedCallPhone] = useState("+15551234567");
  const [missedCallName, setMissedCallName] = useState("John Smith");

  // SMS form state
  const [smsPhone, setSmsPhone] = useState("+15559876543");
  const [smsName, setSmsName] = useState("Jane Doe");
  const [smsMessage, setSmsMessage] = useState(
    "Hi, I need a quote for lawn mowing service at 123 Oak Street. My yard is about half an acre."
  );

  // Web lead form state
  const [webLeadName, setWebLeadName] = useState("Bob Wilson");
  const [webLeadEmail, setWebLeadEmail] = useState("bob@example.com");
  const [webLeadPhone, setWebLeadPhone] = useState("+15555551212");
  const [webLeadService, setWebLeadService] = useState("Lawn Mowing");
  const [webLeadNotes, setWebLeadNotes] = useState(
    "Interested in weekly lawn maintenance for a residential property"
  );

  const simulateMutation = useMutation({
    mutationFn: async (payload: { type: string; data: Record<string, unknown> }) => {
      const response = await apiRequest("POST", "/api/simulate-event", payload);
      return response as SimulationResult;
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pending-actions"] });
      toast({
        title: "Event Simulated",
        description: data.message,
      });
    },
    onError: (error) => {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "Simulation failed",
      });
      toast({
        title: "Simulation Failed",
        description: "Could not simulate the event. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleMissedCall = () => {
    simulateMutation.mutate({
      type: "missed_call",
      data: {
        phone: missedCallPhone,
        customerName: missedCallName,
      },
    });
  };

  const handleSms = () => {
    simulateMutation.mutate({
      type: "inbound_sms",
      data: {
        phone: smsPhone,
        customerName: smsName,
        message: smsMessage,
      },
    });
  };

  const handleWebLead = () => {
    simulateMutation.mutate({
      type: "web_lead",
      data: {
        customerName: webLeadName,
        email: webLeadEmail,
        phone: webLeadPhone,
        serviceRequested: webLeadService,
        notes: webLeadNotes,
      },
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="text-page-title">
          Event Simulator
        </h1>
        <p className="text-sm text-muted-foreground">
          Test your AI agents by simulating inbound events
        </p>
      </div>

      <Card className="border-dashed">
        <CardContent className="py-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Mock Mode Active</p>
              <p className="text-xs text-muted-foreground">
                Events are simulated locally. Twilio integration not configured.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="missed_call" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="missed_call" data-testid="tab-missed-call">
            <Phone className="h-4 w-4 mr-2" />
            Missed Call
          </TabsTrigger>
          <TabsTrigger value="inbound_sms" data-testid="tab-sms">
            <MessageSquare className="h-4 w-4 mr-2" />
            Inbound SMS
          </TabsTrigger>
          <TabsTrigger value="web_lead" data-testid="tab-web-lead">
            <Globe className="h-4 w-4 mr-2" />
            Web Lead
          </TabsTrigger>
        </TabsList>

        <TabsContent value="missed_call">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Simulate Missed Call
              </CardTitle>
              <CardDescription>
                Triggers the missed call → SMS outreach workflow
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="mc-phone">Phone Number</Label>
                  <Input
                    id="mc-phone"
                    placeholder="+15551234567"
                    value={missedCallPhone}
                    onChange={(e) => setMissedCallPhone(e.target.value)}
                    data-testid="input-mc-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mc-name">Customer Name (optional)</Label>
                  <Input
                    id="mc-name"
                    placeholder="John Smith"
                    value={missedCallName}
                    onChange={(e) => setMissedCallName(e.target.value)}
                    data-testid="input-mc-name"
                  />
                </div>
              </div>
              <Button
                onClick={handleMissedCall}
                disabled={simulateMutation.isPending || !missedCallPhone}
                className="w-full"
                data-testid="button-simulate-missed-call"
              >
                <Send className="h-4 w-4 mr-2" />
                Simulate Missed Call
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inbound_sms">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Simulate Inbound SMS
              </CardTitle>
              <CardDescription>
                Triggers the intake → qualify → quote workflow
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sms-phone">Phone Number</Label>
                  <Input
                    id="sms-phone"
                    placeholder="+15559876543"
                    value={smsPhone}
                    onChange={(e) => setSmsPhone(e.target.value)}
                    data-testid="input-sms-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sms-name">Customer Name (optional)</Label>
                  <Input
                    id="sms-name"
                    placeholder="Jane Doe"
                    value={smsName}
                    onChange={(e) => setSmsName(e.target.value)}
                    data-testid="input-sms-name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sms-message">Message Content</Label>
                <Textarea
                  id="sms-message"
                  placeholder="Hi, I need a quote for..."
                  value={smsMessage}
                  onChange={(e) => setSmsMessage(e.target.value)}
                  rows={3}
                  data-testid="input-sms-message"
                />
              </div>
              <Button
                onClick={handleSms}
                disabled={simulateMutation.isPending || !smsPhone || !smsMessage}
                className="w-full"
                data-testid="button-simulate-sms"
              >
                <Send className="h-4 w-4 mr-2" />
                Simulate Inbound SMS
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="web_lead">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Simulate Web Lead
              </CardTitle>
              <CardDescription>
                Triggers the web lead → qualification → schedule workflow
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="web-name">Customer Name</Label>
                  <Input
                    id="web-name"
                    placeholder="Bob Wilson"
                    value={webLeadName}
                    onChange={(e) => setWebLeadName(e.target.value)}
                    data-testid="input-web-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="web-email">Email</Label>
                  <Input
                    id="web-email"
                    type="email"
                    placeholder="bob@example.com"
                    value={webLeadEmail}
                    onChange={(e) => setWebLeadEmail(e.target.value)}
                    data-testid="input-web-email"
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="web-phone">Phone</Label>
                  <Input
                    id="web-phone"
                    placeholder="+15555551212"
                    value={webLeadPhone}
                    onChange={(e) => setWebLeadPhone(e.target.value)}
                    data-testid="input-web-phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="web-service">Service Requested</Label>
                  <Input
                    id="web-service"
                    placeholder="Lawn Mowing"
                    value={webLeadService}
                    onChange={(e) => setWebLeadService(e.target.value)}
                    data-testid="input-web-service"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="web-notes">Additional Notes</Label>
                <Textarea
                  id="web-notes"
                  placeholder="Describe the project..."
                  value={webLeadNotes}
                  onChange={(e) => setWebLeadNotes(e.target.value)}
                  rows={3}
                  data-testid="input-web-notes"
                />
              </div>
              <Button
                onClick={handleWebLead}
                disabled={
                  simulateMutation.isPending ||
                  !webLeadName ||
                  !webLeadPhone ||
                  !webLeadService
                }
                className="w-full"
                data-testid="button-simulate-web-lead"
              >
                <Send className="h-4 w-4 mr-2" />
                Simulate Web Lead
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {result && (
        <Card
          className={
            result.success
              ? "border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20"
              : "border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
          }
        >
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center ${
                  result.success
                    ? "bg-green-500/20 text-green-600 dark:text-green-400"
                    : "bg-red-500/20 text-red-600 dark:text-red-400"
                }`}
              >
                {result.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {result.success ? "Simulation Successful" : "Simulation Failed"}
                </p>
                <p className="text-sm text-muted-foreground">{result.message}</p>
                {result.conversationId && (
                  <div className="mt-2 flex gap-2">
                    <Badge variant="secondary">
                      Conversation #{result.conversationId}
                    </Badge>
                    {result.eventId && (
                      <Badge variant="outline">Event #{result.eventId}</Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
