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
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface BillingConfig {
  id?: number;
  accountId?: number;
  defaultInvoiceTerms: string;
  paymentMethods: string[];
  lateFeePercent: number;
  lateFeeGraceDays: number;
  reminderDays: number[];
  collectionsStartDay: number;
  autoReminders: boolean;
  reminderTone: string;
  defaultTaxRatePercent: number;
  taxEnabled: boolean;
  quickbooksConnected: boolean;
  quickbooksCompanyId?: string | null;
}

export default function SettingsBillingConfigPage() {
  const { toast } = useToast();
  
  const [config, setConfig] = useState<BillingConfig>({
    defaultInvoiceTerms: "net_30",
    paymentMethods: ["card", "ach"],
    lateFeePercent: 0,
    lateFeeGraceDays: 7,
    reminderDays: [3, 7, 14],
    collectionsStartDay: 30,
    autoReminders: true,
    reminderTone: "friendly",
    defaultTaxRatePercent: 0,
    taxEnabled: false,
    quickbooksConnected: false,
  });

  const { data: savedConfig, isLoading } = useQuery<BillingConfig>({
    queryKey: ["/api/settings/billing-config"],
    staleTime: 60000,
  });

  const defaultConfig: BillingConfig = {
    defaultInvoiceTerms: "net_30",
    paymentMethods: ["card", "ach"],
    lateFeePercent: 0,
    lateFeeGraceDays: 7,
    reminderDays: [3, 7, 14],
    collectionsStartDay: 30,
    autoReminders: true,
    reminderTone: "friendly",
    defaultTaxRatePercent: 0,
    taxEnabled: false,
    quickbooksConnected: false,
  };

  useEffect(() => {
    if (savedConfig) {
      // Safely merge with defaults to handle undefined/null values
      setConfig({
        ...defaultConfig,
        ...savedConfig,
        // Ensure arrays are not undefined
        paymentMethods: savedConfig.paymentMethods ?? defaultConfig.paymentMethods,
        reminderDays: savedConfig.reminderDays ?? defaultConfig.reminderDays,
        // Ensure numbers are valid
        lateFeePercent: savedConfig.lateFeePercent ?? 0,
        lateFeeGraceDays: savedConfig.lateFeeGraceDays ?? 7,
        collectionsStartDay: savedConfig.collectionsStartDay ?? 30,
        defaultTaxRatePercent: savedConfig.defaultTaxRatePercent ?? 0,
      });
    }
  }, [savedConfig]);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<BillingConfig>) => {
      return apiRequest("PUT", "/api/settings/billing-config", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/billing-config"] });
      toast({
        title: "Settings saved",
        description: "Billing configuration has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save billing configuration.",
        variant: "destructive",
      });
    },
  });

  const updateField = <K extends keyof BillingConfig>(field: K, value: BillingConfig[K]) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    // Only send mutable fields to the API, exclude read-only fields
    const payload = {
      defaultInvoiceTerms: config.defaultInvoiceTerms,
      paymentMethods: config.paymentMethods,
      lateFeePercent: config.lateFeePercent,
      lateFeeGraceDays: config.lateFeeGraceDays,
      reminderDays: config.reminderDays,
      collectionsStartDay: config.collectionsStartDay,
      autoReminders: config.autoReminders,
      reminderTone: config.reminderTone,
      defaultTaxRatePercent: config.defaultTaxRatePercent,
      taxEnabled: config.taxEnabled,
    };
    saveMutation.mutate(payload);
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
        <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-config">
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? "Saving..." : "Save Changes"}
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
                  <Label htmlFor="invoiceTerms">Payment Terms</Label>
                  <Select 
                    value={config.defaultInvoiceTerms} 
                    onValueChange={(v) => updateField("defaultInvoiceTerms", v)}
                  >
                    <SelectTrigger id="invoiceTerms" data-testid="select-invoice-terms">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="due_on_receipt">Due on Receipt</SelectItem>
                      <SelectItem value="net_7">Net 7</SelectItem>
                      <SelectItem value="net_14">Net 14</SelectItem>
                      <SelectItem value="net_30">Net 30</SelectItem>
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
                    step="0.25"
                    value={(config.defaultTaxRatePercent ?? 0) / 100}
                    onChange={(e) => updateField("defaultTaxRatePercent", Math.round(parseFloat(e.target.value || "0") * 100))}
                    data-testid="input-tax-rate"
                  />
                  <p className="text-xs text-muted-foreground">
                    Applied to taxable line items (e.g., 7.5 = 7.5%)
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 p-4 rounded-md border">
                <div>
                  <Label>Enable Tax</Label>
                  <p className="text-sm text-muted-foreground">
                    Apply tax to eligible invoice line items
                  </p>
                </div>
                <Switch
                  checked={config.taxEnabled}
                  onCheckedChange={(v) => updateField("taxEnabled", v)}
                  data-testid="switch-tax-enabled"
                />
              </div>

              <div className="space-y-4">
                <Label>Accepted Payment Methods</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "card", label: "Credit Card" },
                    { key: "ach", label: "ACH/Bank Transfer" },
                    { key: "cash", label: "Cash" },
                    { key: "check", label: "Check" },
                  ].map((method) => {
                    const isSelected = config.paymentMethods.includes(method.key);
                    return (
                      <Button
                        key={method.key}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          const newMethods = isSelected
                            ? config.paymentMethods.filter((m) => m !== method.key)
                            : [...config.paymentMethods, method.key];
                          updateField("paymentMethods", newMethods.length > 0 ? newMethods : ["card"]);
                        }}
                        data-testid={`button-payment-${method.key}`}
                      >
                        {method.label}
                      </Button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Select which payment methods customers can use
                </p>
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

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="lateFee">Late Fee (%)</Label>
                  <Input
                    id="lateFee"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={config.lateFeePercent}
                    onChange={(e) => updateField("lateFeePercent", parseInt(e.target.value) || 0)}
                    data-testid="input-late-fee"
                  />
                  <p className="text-xs text-muted-foreground">
                    Percentage applied to overdue invoices
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="graceDays">Late Fee Grace Days</Label>
                  <Input
                    id="graceDays"
                    type="number"
                    min="0"
                    max="30"
                    value={config.lateFeeGraceDays}
                    onChange={(e) => updateField("lateFeeGraceDays", parseInt(e.target.value) || 0)}
                    data-testid="input-grace-days"
                  />
                  <p className="text-xs text-muted-foreground">
                    Days after due date before late fee applies
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 p-4 rounded-md border">
                <div>
                  <Label>Auto-send Reminders</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically send payment reminders
                  </p>
                </div>
                <Switch
                  checked={config.autoReminders}
                  onCheckedChange={(v) => updateField("autoReminders", v)}
                  data-testid="switch-auto-reminders"
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="collectionsStartDay">Collections Start Day</Label>
                  <Input
                    id="collectionsStartDay"
                    type="number"
                    min="14"
                    max="90"
                    value={config.collectionsStartDay}
                    onChange={(e) => updateField("collectionsStartDay", parseInt(e.target.value) || 30)}
                    data-testid="input-collections-start-day"
                  />
                  <p className="text-xs text-muted-foreground">
                    Days after due date to escalate to collections
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reminderTone">Reminder Tone</Label>
                  <Select
                    value={config.reminderTone}
                    onValueChange={(v) => updateField("reminderTone", v)}
                  >
                    <SelectTrigger id="reminderTone" data-testid="select-reminder-tone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="firm">Firm</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Tone used in automated reminder messages
                  </p>
                </div>
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
                      {config.quickbooksConnected ? "Connected" : "Not connected"}
                    </p>
                  </div>
                </div>
                <Button 
                  variant={config.quickbooksConnected ? "outline" : "default"}
                  data-testid="button-quickbooks-connect"
                >
                  {config.quickbooksConnected ? "Disconnect" : "Connect"}
                </Button>
              </div>

              {config.quickbooksConnected && (
                <>
                  <div className="flex items-center justify-between gap-4 p-4 rounded-md bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">Last sync</p>
                      <p className="text-xs text-muted-foreground">
                        {config.quickbooksCompanyId ? "Connected" : "Never"}
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
