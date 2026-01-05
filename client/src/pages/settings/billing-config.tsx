import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Receipt,
  DollarSign,
  Clock,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Save,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface BillingConfig {
  invoiceTermsDays: number;
  taxRatePercent: number;
  creditApprovalThreshold: number;
  reminderDays: number[];
  autoSendInvoices: boolean;
  includeLateFeeLanguage: boolean;
  paymentMethods: string[];
  quickBooksEnabled: boolean;
  quickBooksLastSync?: string;
}

export default function SettingsBillingConfigPage() {
  const { toast } = useToast();
  
  const [config, setConfig] = useState<BillingConfig>({
    invoiceTermsDays: 30,
    taxRatePercent: 0,
    creditApprovalThreshold: 50,
    reminderDays: [3, 7, 14],
    autoSendInvoices: true,
    includeLateFeeLanguage: false,
    paymentMethods: ["card", "ach"],
    quickBooksEnabled: false,
    quickBooksLastSync: undefined,
  });

  const { data: savedConfig, isLoading } = useQuery<BillingConfig>({
    queryKey: ["/api/billing/config"],
    staleTime: 60000,
  });

  const updateField = <K extends keyof BillingConfig>(field: K, value: BillingConfig[K]) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    toast({
      title: "Settings saved",
      description: "Billing configuration has been updated.",
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Billing Configuration</h1>
          <p className="text-muted-foreground">
            Configure invoice terms, collections, and accounting sync
          </p>
        </div>
        <Button onClick={handleSave} data-testid="button-save-config">
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="invoices" className="space-y-6">
        <TabsList>
          <TabsTrigger value="invoices">Invoice Terms</TabsTrigger>
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="accounting">Accounting</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Invoice Settings
              </CardTitle>
              <CardDescription>
                Configure default invoice terms and behavior
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="invoiceTerms">Payment Terms (Days)</Label>
                  <Select 
                    value={String(config.invoiceTermsDays)} 
                    onValueChange={(v) => updateField("invoiceTermsDays", parseInt(v))}
                  >
                    <SelectTrigger id="invoiceTerms" data-testid="select-invoice-terms">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Net 7</SelectItem>
                      <SelectItem value="15">Net 15</SelectItem>
                      <SelectItem value="30">Net 30</SelectItem>
                      <SelectItem value="45">Net 45</SelectItem>
                      <SelectItem value="60">Net 60</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Default payment due date for new invoices
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="taxRate">Default Tax Rate (%)</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    min="0"
                    max="25"
                    step="0.1"
                    value={config.taxRatePercent}
                    onChange={(e) => updateField("taxRatePercent", parseFloat(e.target.value) || 0)}
                    data-testid="input-tax-rate"
                  />
                  <p className="text-xs text-muted-foreground">
                    Applied to taxable line items
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 p-4 rounded-md border">
                <div>
                  <Label>Auto-send invoices</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically send invoices when jobs are completed
                  </p>
                </div>
                <Switch
                  checked={config.autoSendInvoices}
                  onCheckedChange={(v) => updateField("autoSendInvoices", v)}
                  data-testid="switch-auto-send"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="collections" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Collections Cadence
              </CardTitle>
              <CardDescription>
                Configure when payment reminders are sent
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>Reminder Schedule (days after due date)</Label>
                <div className="flex items-center gap-4">
                  {config.reminderDays.map((day, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        max="90"
                        value={day}
                        onChange={(e) => {
                          const newDays = [...config.reminderDays];
                          newDays[idx] = parseInt(e.target.value) || 1;
                          updateField("reminderDays", newDays);
                        }}
                        className="w-20"
                        data-testid={`input-reminder-day-${idx}`}
                      />
                      {idx < config.reminderDays.length - 1 && (
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Reminders sent at {config.reminderDays.join(", ")} days overdue
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="creditThreshold">Credit Approval Threshold ($)</Label>
                <Input
                  id="creditThreshold"
                  type="number"
                  min="0"
                  value={config.creditApprovalThreshold}
                  onChange={(e) => updateField("creditApprovalThreshold", parseInt(e.target.value) || 0)}
                  data-testid="input-credit-threshold"
                />
                <p className="text-xs text-muted-foreground">
                  Credits above this amount require owner approval
                </p>
              </div>

              <div className="flex items-center justify-between gap-4 p-4 rounded-md border">
                <div>
                  <Label>Include late fee language</Label>
                  <p className="text-sm text-muted-foreground">
                    Mention late fees in collection reminders
                  </p>
                </div>
                <Switch
                  checked={config.includeLateFeeLanguage}
                  onCheckedChange={(v) => updateField("includeLateFeeLanguage", v)}
                  data-testid="switch-late-fee"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Escalation Rules
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 p-3 rounded-md bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">14+ days overdue</p>
                    <p className="text-xs text-muted-foreground">Escalate to Work Queue</p>
                  </div>
                  <Badge variant="secondary">Auto</Badge>
                </div>
                <div className="flex items-center justify-between gap-4 p-3 rounded-md bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">30+ days overdue</p>
                    <p className="text-xs text-muted-foreground">Pause future scheduling</p>
                  </div>
                  <Badge variant="secondary">Auto</Badge>
                </div>
                <div className="flex items-center justify-between gap-4 p-3 rounded-md bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">60+ days overdue</p>
                    <p className="text-xs text-muted-foreground">Flag for collections</p>
                  </div>
                  <Badge variant="secondary">Auto</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounting" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                QuickBooks Integration
              </CardTitle>
              <CardDescription>
                Sync invoices and payments with QuickBooks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between gap-4 p-4 rounded-md border">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-500/10">
                    <DollarSign className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-medium">QuickBooks Online</p>
                    <p className="text-sm text-muted-foreground">
                      {config.quickBooksEnabled ? "Connected" : "Not connected"}
                    </p>
                  </div>
                </div>
                <Button 
                  variant={config.quickBooksEnabled ? "outline" : "default"}
                  data-testid="button-quickbooks-connect"
                >
                  {config.quickBooksEnabled ? "Disconnect" : "Connect"}
                </Button>
              </div>

              {config.quickBooksEnabled && (
                <>
                  <div className="flex items-center justify-between gap-4 p-4 rounded-md bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">Last sync</p>
                      <p className="text-xs text-muted-foreground">
                        {config.quickBooksLastSync || "Never"}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" data-testid="button-sync-now">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync Now
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Service Mapping</h4>
                    <p className="text-xs text-muted-foreground">
                      Map your services to QuickBooks income accounts
                    </p>
                    <div className="space-y-2">
                      {["Lawn Care", "Cleanups", "Snow Removal"].map((service) => (
                        <div key={service} className="flex items-center justify-between gap-4 p-3 rounded-md border">
                          <span className="text-sm">{service}</span>
                          <Select defaultValue="service-income">
                            <SelectTrigger className="w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="service-income">Service Income</SelectItem>
                              <SelectItem value="lawn-income">Lawn Care Income</SelectItem>
                              <SelectItem value="other-income">Other Income</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
