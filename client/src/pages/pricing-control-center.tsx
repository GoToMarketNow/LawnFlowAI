import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  DollarSign, 
  Settings, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Home, 
  Building, 
  Trees, 
  Mountain,
  Clock,
  AlertCircle,
  Check,
  X,
  Save
} from "lucide-react";
import { useState, useEffect } from "react";
import type { PricingPolicy, QuoteProposal, ServiceConfig, PropertyTypeBandConfig, PricingGuardrails, PropertyTypeBandType } from "@shared/schema";

const SERVICE_LABELS: Record<string, { name: string; icon: any }> = {
  mowing: { name: "Lawn Mowing", icon: Trees },
  cleanup: { name: "Spring/Fall Cleanup", icon: Trees },
  mulch: { name: "Mulching", icon: Mountain },
  landscaping: { name: "Landscaping", icon: Trees },
  irrigation: { name: "Irrigation", icon: Settings },
  fertilization: { name: "Fertilization", icon: TrendingUp },
  aeration: { name: "Core Aeration", icon: Settings },
  overseeding: { name: "Overseeding", icon: Trees },
};

const PROPERTY_BAND_LABELS: Record<PropertyTypeBandType, { name: string; icon: any; description: string }> = {
  townhome: { name: "Townhome", icon: Building, description: "0 - 3,000 sq ft" },
  small: { name: "Small Lot", icon: Home, description: "3,001 - 8,000 sq ft" },
  medium: { name: "Medium Lot", icon: Home, description: "8,001 - 15,000 sq ft" },
  large: { name: "Large Lot", icon: Home, description: "15,001 - 1 acre" },
  multi_acre: { name: "Multi-Acre", icon: Mountain, description: "1+ acres" },
};

const POSITIONING_OPTIONS = [
  { value: "aggressive", label: "Aggressive", description: "Lower prices to win more jobs", icon: TrendingDown },
  { value: "balanced", label: "Balanced", description: "Market-rate competitive pricing", icon: Minus },
  { value: "premium", label: "Premium", description: "Higher prices for premium service", icon: TrendingUp },
];

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function parseDollars(dollars: string): number {
  const parsed = parseFloat(dollars);
  return isNaN(parsed) ? 0 : Math.round(parsed * 100);
}

export default function PricingControlCenter() {
  const { toast } = useToast();
  
  const { data: activePolicy, isLoading: policyLoading } = useQuery<PricingPolicy & { isDefault?: boolean }>({
    queryKey: ["/api/pricing/policies/active"],
  });

  const { data: pendingQuotes, isLoading: quotesLoading } = useQuery<QuoteProposal[]>({
    queryKey: ["/api/pricing/quotes/pending"],
  });

  const [localPolicy, setLocalPolicy] = useState<Partial<PricingPolicy> | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (activePolicy && !localPolicy) {
      setLocalPolicy(activePolicy);
    }
  }, [activePolicy]);

  const savePolicyMutation = useMutation({
    mutationFn: async (policy: Partial<PricingPolicy>) => {
      if (activePolicy?.isDefault || activePolicy?.id === 0) {
        return apiRequest("/api/pricing/policies", "POST", { ...policy, isActive: true });
      }
      return apiRequest(`/api/pricing/policies/${activePolicy?.id}`, "PATCH", policy);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing/policies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pricing/policies/active"] });
      setHasChanges(false);
      toast({ title: "Policy saved", description: "Your pricing policy has been updated." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const approveQuoteMutation = useMutation({
    mutationFn: async ({ id, approvedAmount, adjustmentReason }: { id: number; approvedAmount: number; adjustmentReason?: string }) => {
      return apiRequest(`/api/pricing/quotes/${id}`, "PATCH", {
        status: "approved",
        approvedAmount,
        adjustmentReason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pricing/quotes/pending"] });
      toast({ title: "Quote approved" });
    },
  });

  const rejectQuoteMutation = useMutation({
    mutationFn: async ({ id, adjustmentReason }: { id: number; adjustmentReason: string }) => {
      return apiRequest(`/api/pricing/quotes/${id}`, "PATCH", {
        status: "rejected",
        adjustmentReason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pricing/quotes/pending"] });
      toast({ title: "Quote rejected" });
    },
  });

  const updateLocalPolicy = (updates: Partial<PricingPolicy>) => {
    setLocalPolicy(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const updateServiceConfig = (serviceType: string, updates: Partial<ServiceConfig>) => {
    const currentConfigs = (localPolicy?.serviceConfigs as Record<string, ServiceConfig>) || {};
    const currentConfig = currentConfigs[serviceType] || { enabled: true, minPrice: 3500, baseRate: 15, rateType: "per_sqft", multiplier: 1.0 };
    updateLocalPolicy({
      serviceConfigs: {
        ...currentConfigs,
        [serviceType]: { ...currentConfig, ...updates },
      },
    });
  };

  const updatePropertyBandConfig = (band: PropertyTypeBandType, updates: Partial<PropertyTypeBandConfig>) => {
    const currentConfigs = (localPolicy?.propertyTypeConfigs as Record<PropertyTypeBandType, PropertyTypeBandConfig>) || {};
    const defaults: Record<PropertyTypeBandType, PropertyTypeBandConfig> = {
      townhome: { minSqft: 0, maxSqft: 3000, baseMultiplier: 0.85 },
      small: { minSqft: 3001, maxSqft: 8000, baseMultiplier: 1.0 },
      medium: { minSqft: 8001, maxSqft: 15000, baseMultiplier: 1.15 },
      large: { minSqft: 15001, maxSqft: 43560, baseMultiplier: 1.3 },
      multi_acre: { minSqft: 43561, maxSqft: Infinity, baseMultiplier: 1.5 },
    };
    const currentConfig = currentConfigs[band] || defaults[band];
    updateLocalPolicy({
      propertyTypeConfigs: {
        ...currentConfigs,
        [band]: { ...currentConfig, ...updates },
      },
    });
  };

  const updateGuardrails = (updates: Partial<PricingGuardrails>) => {
    const currentGuardrails = (localPolicy?.guardrails as PricingGuardrails) || {
      floorPrice: 3500,
      ceilingPrice: 500000,
      lowConfidenceThreshold: 0.7,
      reviewAboveAmount: 100000,
    };
    updateLocalPolicy({
      guardrails: { ...currentGuardrails, ...updates },
    });
  };

  if (policyLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading pricing configuration...</div>
      </div>
    );
  }

  const serviceConfigs = (localPolicy?.serviceConfigs as Record<string, ServiceConfig>) || {};
  const propertyConfigs = (localPolicy?.propertyTypeConfigs as Record<PropertyTypeBandType, PropertyTypeBandConfig>) || {};
  const guardrails = (localPolicy?.guardrails as PricingGuardrails) || {};

  return (
    <div className="space-y-6" data-testid="pricing-control-center">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Pricing Control Center</h1>
          <p className="text-muted-foreground text-sm">Configure your commercial pricing strategy and review quotes</p>
        </div>
        <Button 
          onClick={() => savePolicyMutation.mutate(localPolicy || {})} 
          disabled={!hasChanges || savePolicyMutation.isPending}
          data-testid="button-save-policy"
        >
          <Save className="w-4 h-4 mr-2" />
          {savePolicyMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <Tabs defaultValue="strategy" className="space-y-4">
        <TabsList data-testid="pricing-tabs">
          <TabsTrigger value="strategy" data-testid="tab-strategy">Strategy</TabsTrigger>
          <TabsTrigger value="services" data-testid="tab-services">Services</TabsTrigger>
          <TabsTrigger value="property-bands" data-testid="tab-property-bands">Property Bands</TabsTrigger>
          <TabsTrigger value="guardrails" data-testid="tab-guardrails">Guardrails</TabsTrigger>
          <TabsTrigger value="review-queue" data-testid="tab-review-queue">
            Review Queue
            {(pendingQuotes?.length || 0) > 0 && (
              <Badge variant="destructive" className="ml-2">{pendingQuotes?.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="strategy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Global Positioning
              </CardTitle>
              <CardDescription>
                Set your overall market positioning strategy. This affects all quotes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {POSITIONING_OPTIONS.map((option) => {
                  const isSelected = (localPolicy?.globalPositioning || "balanced") === option.value;
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      onClick={() => {
                        const multiplier = option.value === "aggressive" ? 0.85 : option.value === "premium" ? 1.15 : 1.0;
                        updateLocalPolicy({ globalPositioning: option.value, globalMultiplier: multiplier });
                      }}
                      className={`p-4 rounded-md border text-left transition-colors ${
                        isSelected 
                          ? "border-primary bg-primary/10" 
                          : "border-border hover-elevate"
                      }`}
                      data-testid={`button-positioning-${option.value}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{option.label}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </button>
                  );
                })}
              </div>

              <Separator />

              <div className="space-y-4">
                <Label>Fine-tune Multiplier</Label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[(localPolicy?.globalMultiplier || 1) * 100]}
                    onValueChange={([value]) => updateLocalPolicy({ globalMultiplier: value / 100 })}
                    min={70}
                    max={130}
                    step={1}
                    className="flex-1"
                    data-testid="slider-global-multiplier"
                  />
                  <span className="text-sm font-mono w-16 text-right" data-testid="text-multiplier-value">
                    {((localPolicy?.globalMultiplier || 1) * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  All calculated prices will be multiplied by this factor.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Per-Service Configuration</CardTitle>
              <CardDescription>
                Enable/disable services and adjust pricing for each service type.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(SERVICE_LABELS).map(([serviceType, { name, icon: Icon }]) => {
                  const config = serviceConfigs[serviceType] || { enabled: true, minPrice: 3500, baseRate: 15, rateType: "per_sqft", multiplier: 1.0 };
                  return (
                    <div 
                      key={serviceType} 
                      className="flex items-center gap-4 p-4 rounded-md border"
                      data-testid={`service-config-${serviceType}`}
                    >
                      <div className="flex items-center gap-2 w-40">
                        <Switch
                          checked={config.enabled !== false}
                          onCheckedChange={(checked) => updateServiceConfig(serviceType, { enabled: checked })}
                          data-testid={`switch-service-${serviceType}`}
                        />
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{name}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-1">
                        <Label className="text-xs text-muted-foreground w-16">Min Price</Label>
                        <Input
                          type="number"
                          value={(config.minPrice / 100).toFixed(0)}
                          onChange={(e) => updateServiceConfig(serviceType, { minPrice: parseDollars(e.target.value) })}
                          className="w-24"
                          disabled={config.enabled === false}
                          data-testid={`input-min-price-${serviceType}`}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground w-16">Multiplier</Label>
                        <Input
                          type="number"
                          step="0.05"
                          value={config.multiplier.toFixed(2)}
                          onChange={(e) => updateServiceConfig(serviceType, { multiplier: parseFloat(e.target.value) || 1 })}
                          className="w-20"
                          disabled={config.enabled === false}
                          data-testid={`input-multiplier-${serviceType}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="property-bands" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="w-5 h-5" />
                Property Type Bands
              </CardTitle>
              <CardDescription>
                Configure pricing multipliers based on property lot size categories.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(Object.entries(PROPERTY_BAND_LABELS) as [PropertyTypeBandType, typeof PROPERTY_BAND_LABELS[PropertyTypeBandType]][]).map(([band, { name, icon: Icon, description }]) => {
                  const defaults: Record<PropertyTypeBandType, PropertyTypeBandConfig> = {
                    townhome: { minSqft: 0, maxSqft: 3000, baseMultiplier: 0.85 },
                    small: { minSqft: 3001, maxSqft: 8000, baseMultiplier: 1.0 },
                    medium: { minSqft: 8001, maxSqft: 15000, baseMultiplier: 1.15 },
                    large: { minSqft: 15001, maxSqft: 43560, baseMultiplier: 1.3 },
                    multi_acre: { minSqft: 43561, maxSqft: Infinity, baseMultiplier: 1.5 },
                  };
                  const config = propertyConfigs[band] || defaults[band];
                  
                  return (
                    <div 
                      key={band} 
                      className="flex items-center gap-4 p-4 rounded-md border"
                      data-testid={`property-band-${band}`}
                    >
                      <div className="flex items-center gap-2 w-40">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <span className="text-sm font-medium">{name}</span>
                          <p className="text-xs text-muted-foreground">{description}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground">Multiplier</Label>
                          <Slider
                            value={[config.baseMultiplier * 100]}
                            onValueChange={([value]) => updatePropertyBandConfig(band, { baseMultiplier: value / 100 })}
                            min={50}
                            max={200}
                            step={5}
                            className="w-32"
                            data-testid={`slider-property-multiplier-${band}`}
                          />
                          <span className="text-sm font-mono w-12" data-testid={`text-property-multiplier-${band}`}>
                            {(config.baseMultiplier * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guardrails" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Pricing Guardrails
              </CardTitle>
              <CardDescription>
                Set safety limits and thresholds for automated pricing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Floor Price (Minimum)</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">$</span>
                    <Input
                      type="number"
                      value={((guardrails.floorPrice || 3500) / 100).toFixed(0)}
                      onChange={(e) => updateGuardrails({ floorPrice: parseDollars(e.target.value) })}
                      data-testid="input-floor-price"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">No quote will ever go below this amount.</p>
                </div>

                <div className="space-y-2">
                  <Label>Ceiling Price (Maximum)</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">$</span>
                    <Input
                      type="number"
                      value={((guardrails.ceilingPrice || 500000) / 100).toFixed(0)}
                      onChange={(e) => updateGuardrails({ ceilingPrice: parseDollars(e.target.value) })}
                      data-testid="input-ceiling-price"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">No quote will ever exceed this amount.</p>
                </div>

                <div className="space-y-2">
                  <Label>Manual Review Threshold</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">$</span>
                    <Input
                      type="number"
                      value={((guardrails.reviewAboveAmount || 100000) / 100).toFixed(0)}
                      onChange={(e) => updateGuardrails({ reviewAboveAmount: parseDollars(e.target.value) })}
                      data-testid="input-review-threshold"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Quotes above this amount require manual review.</p>
                </div>

                <div className="space-y-2">
                  <Label>Confidence Threshold</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[(guardrails.lowConfidenceThreshold || 0.7) * 100]}
                      onValueChange={([value]) => updateGuardrails({ lowConfidenceThreshold: value / 100 })}
                      min={50}
                      max={95}
                      step={5}
                      className="flex-1"
                      data-testid="slider-confidence-threshold"
                    />
                    <span className="text-sm font-mono w-12" data-testid="text-confidence-threshold">
                      {((guardrails.lowConfidenceThreshold || 0.7) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Quotes with property data confidence below this trigger manual review.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="review-queue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Pending Quote Reviews
              </CardTitle>
              <CardDescription>
                Quotes that need your approval before being sent to customers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {quotesLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading quotes...</div>
              ) : !pendingQuotes?.length ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-queue">
                  <Check className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No quotes pending review</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-4">
                    {pendingQuotes.map((quote) => (
                      <QuoteReviewCard
                        key={quote.id}
                        quote={quote}
                        onApprove={(approvedAmount, reason) => 
                          approveQuoteMutation.mutate({ id: quote.id, approvedAmount, adjustmentReason: reason })
                        }
                        onReject={(reason) => 
                          rejectQuoteMutation.mutate({ id: quote.id, adjustmentReason: reason })
                        }
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function QuoteReviewCard({ 
  quote, 
  onApprove, 
  onReject 
}: { 
  quote: QuoteProposal; 
  onApprove: (approvedAmount: number, reason?: string) => void; 
  onReject: (reason: string) => void;
}) {
  const [approvedAmount, setApprovedAmount] = useState(quote.rangeHigh);
  const [rejectReason, setRejectReason] = useState("");

  const assumptions = (quote.assumptions as Array<{ key: string; value: string; reason: string }>) || [];
  const reviewReasons = (quote.reviewReasons as string[]) || [];
  const services = (quote.servicesRequested as Array<{ serviceType: string; frequency?: string }>) || [];

  return (
    <div className="p-4 border rounded-md space-y-4" data-testid={`quote-review-${quote.id}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h4 className="font-medium">{quote.customerName || "Unknown Customer"}</h4>
          <p className="text-sm text-muted-foreground">{quote.customerAddress}</p>
          <p className="text-sm text-muted-foreground">{quote.customerPhone}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold" data-testid={`text-quote-range-${quote.id}`}>
            {formatCents(quote.rangeLow)} - {formatCents(quote.rangeHigh)}
          </p>
          <Badge variant="secondary" data-testid={`badge-property-band-${quote.id}`}>
            {PROPERTY_BAND_LABELS[quote.propertyTypeBand as PropertyTypeBandType]?.name || quote.propertyTypeBand}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {services.map((service, i) => (
          <Badge key={i} variant="outline">
            {SERVICE_LABELS[service.serviceType]?.name || service.serviceType}
            {service.frequency && service.frequency !== "one_time" && ` (${service.frequency})`}
          </Badge>
        ))}
      </div>

      {reviewReasons.length > 0 && (
        <div className="bg-destructive/10 p-3 rounded-md">
          <p className="text-sm font-medium text-destructive flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Review Required
          </p>
          <ul className="text-sm text-muted-foreground mt-1 list-disc list-inside">
            {reviewReasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {assumptions.length > 0 && (
        <div className="text-sm space-y-1">
          <p className="font-medium text-muted-foreground">Assumptions:</p>
          {assumptions.map((a, i) => (
            <p key={i} className="text-muted-foreground">- {a.reason}</p>
          ))}
        </div>
      )}

      <Separator />

      <div className="flex items-end gap-4 flex-wrap">
        <div className="space-y-2">
          <Label>Final Price</Label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">$</span>
            <Input
              type="number"
              value={(approvedAmount / 100).toFixed(0)}
              onChange={(e) => setApprovedAmount(parseDollars(e.target.value))}
              className="w-24"
              data-testid={`input-final-price-${quote.id}`}
            />
          </div>
        </div>

        <Button
          onClick={() => onApprove(approvedAmount)}
          className="gap-2"
          data-testid={`button-approve-${quote.id}`}
        >
          <Check className="w-4 h-4" />
          Approve
        </Button>

        <div className="flex-1">
          <Input
            placeholder="Reason for rejection..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            data-testid={`input-reject-reason-${quote.id}`}
          />
        </div>

        <Button
          variant="destructive"
          onClick={() => onReject(rejectReason)}
          disabled={!rejectReason}
          className="gap-2"
          data-testid={`button-reject-${quote.id}`}
        >
          <X className="w-4 h-4" />
          Reject
        </Button>
      </div>
    </div>
  );
}
