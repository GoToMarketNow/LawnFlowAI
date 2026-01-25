import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  Building2, 
  MapPin, 
  Wrench, 
  MessageSquare, 
  DollarSign, 
  Settings, 
  Rocket,
  Phone,
  Mail,
  User,
  Clock,
  Loader2,
  Link2,
  CheckCircle2,
  Receipt,
  Calculator
} from "lucide-react";

interface OnboardingState {
  id?: number;
  onboardingRoute: "connect_existing" | "standalone" | null;
  onboardingStep: string;
  isOnboardingComplete: boolean;
  businessBasics: {
    businessName: string;
    ownerName: string | null;
    email: string;
    phone: string;
    address: string | null;
  };
  serviceArea: {
    centerLat: number | null;
    centerLng: number | null;
    radiusMi: number | null;
    maxMi: number | null;
    allowExtended: boolean | null;
  };
  integration: {
    fsmProvider: string | null;
    fsmConnected: boolean | null;
    fsmProviderOther: string | null;
  };
  communication: {
    phoneProvider: string | null;
    twilioAreaCode: string | null;
    textingEnabled: boolean | null;
  };
  services: {
    serviceTypes: string[] | null;
    typicalResponseTime: string | null;
    weeklyCapacity: string | null;
  };
  pricing: {
    pricingModel: string | null;
    mowingMinPrice: number | null;
    cleanupMinPrice: number | null;
    mulchMinPrice: number | null;
  };
  automation: {
    missedCallRecoveryEnabled: boolean | null;
    autoTextEnabled: boolean | null;
    autoQuoteEnabled: boolean | null;
    approvalsRequiredForBooking: boolean | null;
  };
  standalone: {
    trackCustomersEnabled: boolean | null;
    trackJobsEnabled: boolean | null;
  };
  billing: {
    useQuickBooks: boolean | null;
    quickBooksConnected: boolean | null;
    invoiceTerms: string | null;
    defaultTaxRate: number | null;
    taxEnabled: boolean | null;
  };
}

const STEPS = [
  { id: "welcome", title: "Welcome", icon: Sparkles, required: false },
  { id: "route", title: "Setup Route", icon: Link2, required: true },
  { id: "business", title: "Business Basics", icon: Building2, required: true },
  { id: "service-area", title: "Service Area", icon: MapPin, required: true },
  { id: "services", title: "Services", icon: Wrench, required: true },
  { id: "integration", title: "Back Office", icon: Link2, required: false, routeDependent: true },
  { id: "communication", title: "Communication", icon: MessageSquare, required: true },
  { id: "pricing", title: "Pricing", icon: DollarSign, required: true },
  { id: "billing", title: "Billing & Accounting", icon: Receipt, required: false },
  { id: "automation", title: "Automation", icon: Settings, required: true },
  { id: "review", title: "Launch", icon: Rocket, required: true },
];

const SERVICE_TYPES = [
  { id: "mowing", label: "Lawn Mowing" },
  { id: "cleanup", label: "Cleanup / Leaf Removal" },
  { id: "mulch", label: "Mulching" },
  { id: "landscaping", label: "Landscaping Install" },
  { id: "irrigation", label: "Irrigation" },
  { id: "other", label: "Other Services" },
];

const FSM_PROVIDERS = [
  { id: "jobber", label: "Jobber" },
  { id: "housecall_pro", label: "Housecall Pro" },
  { id: "service_autopilot", label: "Service Autopilot" },
  { id: "other", label: "Other" },
  { id: "not_sure", label: "Not sure" },
];

export default function Onboarding() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [localState, setLocalState] = useState<Partial<OnboardingState>>({});

  const { data: onboardingData, isLoading } = useQuery<OnboardingState>({
    queryKey: ["/api/onboarding"],
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<OnboardingState>) => {
      return apiRequest("POST", "/api/onboarding", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
    },
    onError: (error) => {
      toast({
        title: "Error saving",
        description: "Failed to save your progress. Please try again.",
        variant: "destructive",
      });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/onboarding/complete");
    },
    onSuccess: () => {
      toast({
        title: "Setup Complete!",
        description: "LawnFlow is ready to help you grow your business.",
      });
      navigate("/");
    },
    onError: (error: any) => {
      toast({
        title: "Cannot complete setup",
        description: error.message || "Please complete all required fields.",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (onboardingData) {
      setLocalState(onboardingData);
      if (onboardingData.isOnboardingComplete) {
        navigate("/");
        return;
      }
      const stepIndex = STEPS.findIndex((s) => s.id === onboardingData.onboardingStep);
      if (stepIndex >= 0) {
        setCurrentStepIndex(stepIndex);
      }
    }
  }, [onboardingData, navigate]);

  const getVisibleSteps = () => {
    return STEPS.filter((step) => {
      if (!step.routeDependent) return true;
      if (step.id === "integration") {
        return localState.onboardingRoute === "connect_existing";
      }
      return true;
    });
  };

  const visibleSteps = getVisibleSteps();
  const currentStep = visibleSteps[currentStepIndex];

  const updateLocalState = (updates: Partial<OnboardingState>) => {
    setLocalState((prev) => ({ ...prev, ...updates }));
  };

  const saveAndContinue = async () => {
    const nextIndex = currentStepIndex + 1;
    const nextStep = visibleSteps[nextIndex];
    
    await saveMutation.mutateAsync({
      ...localState,
      onboardingStep: nextStep?.id || currentStep.id,
    });
    
    if (nextIndex < visibleSteps.length) {
      setCurrentStepIndex(nextIndex);
    }
  };

  const goBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep?.id) {
      case "welcome":
        return true;
      case "route":
        return !!localState.onboardingRoute;
      case "business":
        return !!(
          localState.businessBasics?.businessName &&
          localState.businessBasics?.phone &&
          localState.businessBasics?.email
        );
      case "service-area":
        return !!(
          localState.serviceArea?.centerLat &&
          localState.serviceArea?.radiusMi
        );
      case "services":
        return !!(localState.services?.serviceTypes?.length);
      case "integration":
        return true;
      case "communication":
        return true;
      case "pricing":
        return !!localState.pricing?.pricingModel;
      case "billing":
        return true; // Optional step
      case "automation":
        return true;
      case "review":
        return true;
      default:
        return true;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-72 border-r bg-sidebar p-6 flex flex-col">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-foreground">LawnFlow Setup</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Estimated time: 5-8 minutes
          </p>
        </div>

        <nav className="flex-1 space-y-1">
          {visibleSteps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;

            return (
              <div
                key={step.id}
                data-testid={`step-nav-${step.id}`}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  isCurrent
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : isCompleted
                    ? "text-muted-foreground"
                    : "text-muted-foreground/60"
                }`}
              >
                <div
                  className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                    isCompleted
                      ? "bg-primary text-primary-foreground"
                      : isCurrent
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isCompleted ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Icon className="h-3 w-3" />
                  )}
                </div>
                <span className="text-sm font-medium">{step.title}</span>
                {step.required && !isCompleted && (
                  <Badge variant="outline" className="ml-auto text-xs">
                    Required
                  </Badge>
                )}
              </div>
            );
          })}
        </nav>

        <div className="mt-auto pt-6 border-t">
          <div className="text-xs text-muted-foreground">
            Progress: {Math.round((currentStepIndex / (visibleSteps.length - 1)) * 100)}%
          </div>
          <div className="h-2 bg-muted rounded-full mt-2">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{
                width: `${(currentStepIndex / (visibleSteps.length - 1)) * 100}%`,
              }}
            />
          </div>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-auto">
        <div className="max-w-2xl mx-auto">
          {currentStep?.id === "welcome" && (
            <WelcomeStep onContinue={saveAndContinue} />
          )}

          {currentStep?.id === "route" && (
            <RouteStep
              value={localState.onboardingRoute}
              fsmProvider={localState.integration?.fsmProvider}
              onChange={(route, provider) => {
                updateLocalState({
                  onboardingRoute: route,
                  integration: { 
                    fsmProvider: provider ?? null,
                    fsmConnected: localState.integration?.fsmConnected ?? false,
                    fsmProviderOther: localState.integration?.fsmProviderOther ?? null,
                  },
                });
              }}
            />
          )}

          {currentStep?.id === "business" && (
            <BusinessBasicsStep
              data={localState.businessBasics}
              onChange={(data) =>
                updateLocalState({ businessBasics: data })
              }
            />
          )}

          {currentStep?.id === "service-area" && (
            <ServiceAreaStep
              data={localState.serviceArea}
              onChange={(data) =>
                updateLocalState({ serviceArea: data })
              }
            />
          )}

          {currentStep?.id === "services" && (
            <ServicesStep
              data={localState.services}
              onChange={(data) =>
                updateLocalState({ services: data })
              }
            />
          )}

          {currentStep?.id === "integration" && (
            <IntegrationStep
              data={localState.integration}
              standalone={localState.standalone}
              route={localState.onboardingRoute}
              onChange={(integration, standalone) =>
                updateLocalState({ integration, standalone })
              }
            />
          )}

          {currentStep?.id === "communication" && (
            <CommunicationStep
              data={localState.communication}
              onChange={(data) =>
                updateLocalState({ communication: data })
              }
            />
          )}

          {currentStep?.id === "pricing" && (
            <PricingStep
              data={localState.pricing}
              services={localState.services?.serviceTypes}
              onChange={(data) =>
                updateLocalState({ pricing: data })
              }
            />
          )}

          {currentStep?.id === "billing" && (
            <BillingStep
              data={localState.billing}
              onChange={(data) =>
                updateLocalState({ billing: data })
              }
            />
          )}

          {currentStep?.id === "automation" && (
            <AutomationStep
              data={localState.automation}
              onChange={(data) =>
                updateLocalState({ automation: data })
              }
            />
          )}

          {currentStep?.id === "review" && (
            <ReviewStep
              state={localState}
              onLaunch={() => completeMutation.mutate()}
              isLaunching={completeMutation.isPending}
            />
          )}

          {currentStep?.id !== "welcome" && currentStep?.id !== "review" && (
            <div className="flex items-center justify-between mt-8 pt-6 border-t gap-4">
              <Button
                variant="ghost"
                onClick={goBack}
                disabled={currentStepIndex === 0}
                data-testid="button-back"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </Button>

              <div className="flex items-center gap-2">
                {!STEPS.find((s) => s.id === currentStep?.id)?.required && (
                  <Button
                    variant="ghost"
                    onClick={saveAndContinue}
                    data-testid="button-skip"
                  >
                    Skip for now
                  </Button>
                )}
                <Button
                  onClick={saveAndContinue}
                  disabled={!canProceed() || saveMutation.isPending}
                  data-testid="button-continue"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Save & Continue
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function WelcomeStep({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
        <Sparkles className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-3xl font-bold mb-4">Welcome to LawnFlow</h1>
      <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
        Your AI-powered assistant that helps you capture more leads, send quotes faster, and book more jobs.
      </p>

      <div className="grid gap-4 max-w-lg mx-auto mb-8">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
              <Phone className="h-5 w-5 text-green-600" />
            </div>
            <div className="text-left">
              <p className="font-medium">Answer every missed call</p>
              <p className="text-sm text-muted-foreground">
                Automatically text back when you miss a call
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
              <DollarSign className="h-5 w-5 text-blue-600" />
            </div>
            <div className="text-left">
              <p className="font-medium">Send quotes faster</p>
              <p className="text-sm text-muted-foreground">
                AI drafts quotes based on your pricing rules
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center flex-shrink-0">
              <Clock className="h-5 w-5 text-purple-600" />
            </div>
            <div className="text-left">
              <p className="font-medium">Book more jobs with less admin</p>
              <p className="text-sm text-muted-foreground">
                Spend less time on the phone, more time on the lawn
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Button size="lg" onClick={onContinue} data-testid="button-start-setup">
        Start Setup
        <ChevronRight className="h-4 w-4 ml-2" />
      </Button>
    </div>
  );
}

function RouteStep({
  value,
  fsmProvider,
  onChange,
}: {
  value: "connect_existing" | "standalone" | null | undefined;
  fsmProvider: string | null | undefined;
  onChange: (route: "connect_existing" | "standalone", provider?: string) => void;
}) {
  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Choose Your Setup</h2>
      <p className="text-muted-foreground mb-6">
        Do you already use a job management tool?
      </p>

      <div className="space-y-4">
        <Card
          className={`cursor-pointer transition-colors hover-elevate ${
            value === "connect_existing" ? "border-primary bg-primary/5" : ""
          }`}
          onClick={() => onChange("connect_existing", fsmProvider || undefined)}
          data-testid="route-connect-existing"
        >
          <CardContent className="flex items-start gap-4 p-4">
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                value === "connect_existing"
                  ? "border-primary bg-primary"
                  : "border-muted-foreground"
              }`}
            >
              {value === "connect_existing" && (
                <Check className="h-3 w-3 text-primary-foreground" />
              )}
            </div>
            <div>
              <p className="font-medium">Yes - Connect my existing system</p>
              <p className="text-sm text-muted-foreground">
                LawnFlow will work alongside Jobber, Housecall Pro, or other tools you already use
              </p>
            </div>
          </CardContent>
        </Card>

        {value === "connect_existing" && (
          <div className="ml-9 space-y-3">
            <Label>Which system do you use?</Label>
            <RadioGroup
              value={fsmProvider || ""}
              onValueChange={(v) => onChange("connect_existing", v)}
            >
              {FSM_PROVIDERS.map((p) => (
                <div key={p.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={p.id} id={p.id} data-testid={`provider-${p.id}`} />
                  <Label htmlFor={p.id} className="font-normal cursor-pointer">
                    {p.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        )}

        <Card
          className={`cursor-pointer transition-colors hover-elevate ${
            value === "standalone" ? "border-primary bg-primary/5" : ""
          }`}
          onClick={() => onChange("standalone")}
          data-testid="route-standalone"
        >
          <CardContent className="flex items-start gap-4 p-4">
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                value === "standalone"
                  ? "border-primary bg-primary"
                  : "border-muted-foreground"
              }`}
            >
              {value === "standalone" && (
                <Check className="h-3 w-3 text-primary-foreground" />
              )}
            </div>
            <div>
              <p className="font-medium">No - Use LawnFlow standalone</p>
              <p className="text-sm text-muted-foreground">
                We'll set up basic customer and job tracking for you
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BusinessBasicsStep({
  data,
  onChange,
}: {
  data: OnboardingState["businessBasics"] | undefined;
  onChange: (data: OnboardingState["businessBasics"]) => void;
}) {
  const defaults = {
    businessName: data?.businessName || "",
    ownerName: data?.ownerName || "",
    email: data?.email || "",
    phone: data?.phone || "",
    address: data?.address || "",
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Business Basics</h2>
      <p className="text-muted-foreground mb-6">
        Tell us about your business so we can personalize your experience.
      </p>

      <div className="space-y-4">
        <div>
          <Label htmlFor="businessName">
            Business Name <span className="text-destructive">*</span>
          </Label>
          <p className="text-xs text-muted-foreground mb-1">
            This is how customers will see your business
          </p>
          <Input
            id="businessName"
            value={defaults.businessName}
            onChange={(e) =>
              onChange({ ...defaults, businessName: e.target.value })
            }
            placeholder="Green Ridge Lawn Care"
            data-testid="input-business-name"
          />
        </div>

        <div>
          <Label htmlFor="ownerName">Owner Name</Label>
          <p className="text-xs text-muted-foreground mb-1">
            For personalized communications
          </p>
          <Input
            id="ownerName"
            value={defaults.ownerName || ""}
            onChange={(e) =>
              onChange({ ...defaults, ownerName: e.target.value })
            }
            placeholder="John Smith"
            data-testid="input-owner-name"
          />
        </div>

        <div>
          <Label htmlFor="email">
            Email <span className="text-destructive">*</span>
          </Label>
          <p className="text-xs text-muted-foreground mb-1">
            Where we'll send important updates
          </p>
          <Input
            id="email"
            type="email"
            value={defaults.email}
            onChange={(e) => onChange({ ...defaults, email: e.target.value })}
            placeholder="info@yourbusiness.com"
            data-testid="input-email"
          />
        </div>

        <div>
          <Label htmlFor="phone">
            Phone Number <span className="text-destructive">*</span>
          </Label>
          <p className="text-xs text-muted-foreground mb-1">
            Required for missed call recovery and texting features
          </p>
          <Input
            id="phone"
            type="tel"
            value={defaults.phone}
            onChange={(e) => onChange({ ...defaults, phone: e.target.value })}
            placeholder="+1 (555) 123-4567"
            data-testid="input-phone"
          />
        </div>

        <div>
          <Label htmlFor="address">Business Address</Label>
          <p className="text-xs text-muted-foreground mb-1">
            Used to calculate service area distances
          </p>
          <Input
            id="address"
            value={defaults.address || ""}
            onChange={(e) => onChange({ ...defaults, address: e.target.value })}
            placeholder="123 Main St, Anytown, USA"
            data-testid="input-address"
          />
        </div>
      </div>
    </div>
  );
}

function ServiceAreaStep({
  data,
  onChange,
}: {
  data: OnboardingState["serviceArea"] | undefined;
  onChange: (data: OnboardingState["serviceArea"]) => void;
}) {
  const defaults = {
    centerLat: data?.centerLat || 38.0293,
    centerLng: data?.centerLng || -78.4767,
    radiusMi: data?.radiusMi || 10,
    maxMi: data?.maxMi || 20,
    allowExtended: data?.allowExtended ?? true,
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Service Area</h2>
      <p className="text-muted-foreground mb-6">
        Define where you provide services. This helps us filter leads that are too far away.
      </p>

      <div className="space-y-6">
        <Card className="bg-muted/50 p-6">
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center mb-4">
            <div className="text-center text-muted-foreground">
              <MapPin className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">Map preview</p>
              <p className="text-xs">Set your location and radius below</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Latitude</Label>
              <Input
                type="number"
                step="0.0001"
                value={defaults.centerLat}
                onChange={(e) =>
                  onChange({ ...defaults, centerLat: parseFloat(e.target.value) || 0 })
                }
                data-testid="input-lat"
              />
            </div>
            <div>
              <Label>Longitude</Label>
              <Input
                type="number"
                step="0.0001"
                value={defaults.centerLng}
                onChange={(e) =>
                  onChange({ ...defaults, centerLng: parseFloat(e.target.value) || 0 })
                }
                data-testid="input-lng"
              />
            </div>
          </div>
        </Card>

        <div>
          <Label>Service Radius: {defaults.radiusMi} miles</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Your primary service area where you take most jobs
          </p>
          <Slider
            value={[defaults.radiusMi]}
            onValueChange={([v]) =>
              onChange({ ...defaults, radiusMi: v })
            }
            min={1}
            max={40}
            step={1}
            data-testid="slider-radius"
          />
        </div>

        <div>
          <Label>Max Travel Distance</Label>
          <p className="text-xs text-muted-foreground mb-2">
            The farthest you're willing to travel for a job
          </p>
          <Select
            value={String(defaults.maxMi)}
            onValueChange={(v) =>
              onChange({ ...defaults, maxMi: parseInt(v) })
            }
          >
            <SelectTrigger data-testid="select-max-distance">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 miles</SelectItem>
              <SelectItem value="10">10 miles</SelectItem>
              <SelectItem value="20">20 miles</SelectItem>
              <SelectItem value="40">40 miles</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Accept Extended Area Requests</Label>
            <p className="text-xs text-muted-foreground">
              Get notified about jobs slightly outside your normal area
            </p>
          </div>
          <Switch
            checked={defaults.allowExtended}
            onCheckedChange={(checked) =>
              onChange({ ...defaults, allowExtended: checked })
            }
            data-testid="switch-extended"
          />
        </div>
      </div>
    </div>
  );
}

function ServicesStep({
  data,
  onChange,
}: {
  data: OnboardingState["services"] | undefined;
  onChange: (data: OnboardingState["services"]) => void;
}) {
  const defaults = {
    serviceTypes: data?.serviceTypes || [],
    typicalResponseTime: data?.typicalResponseTime || "24h",
    weeklyCapacity: data?.weeklyCapacity || "medium",
  };

  const toggleService = (id: string) => {
    const current = defaults.serviceTypes;
    const updated = current.includes(id)
      ? current.filter((s) => s !== id)
      : [...current, id];
    onChange({ ...defaults, serviceTypes: updated });
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Services & Capacity</h2>
      <p className="text-muted-foreground mb-6">
        What services do you offer? This helps us respond accurately to customer inquiries.
      </p>

      <div className="space-y-6">
        <div>
          <Label className="mb-3 block">
            Services Offered <span className="text-destructive">*</span>
          </Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {SERVICE_TYPES.map((service) => (
              <div
                key={service.id}
                className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                  defaults.serviceTypes.includes(service.id)
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted"
                }`}
                onClick={() => toggleService(service.id)}
                data-testid={`service-${service.id}`}
              >
                <Checkbox
                  checked={defaults.serviceTypes.includes(service.id)}
                  onCheckedChange={() => toggleService(service.id)}
                />
                <span className="text-sm">{service.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label>Typical Response Time</Label>
          <p className="text-xs text-muted-foreground mb-2">
            How quickly can you usually respond to new inquiries?
          </p>
          <RadioGroup
            value={defaults.typicalResponseTime}
            onValueChange={(v) =>
              onChange({ ...defaults, typicalResponseTime: v })
            }
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="same_day" id="same_day" />
              <Label htmlFor="same_day" className="font-normal cursor-pointer">
                Same day
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="24h" id="24h" />
              <Label htmlFor="24h" className="font-normal cursor-pointer">
                Within 24h
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="48h" id="48h" />
              <Label htmlFor="48h" className="font-normal cursor-pointer">
                Within 48h
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div>
          <Label>Weekly Capacity</Label>
          <p className="text-xs text-muted-foreground mb-2">
            How busy is your schedule typically?
          </p>
          <RadioGroup
            value={defaults.weeklyCapacity}
            onValueChange={(v) =>
              onChange({ ...defaults, weeklyCapacity: v })
            }
            className="flex gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="light" id="light" />
              <Label htmlFor="light" className="font-normal cursor-pointer">
                Light
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="medium" id="medium" />
              <Label htmlFor="medium" className="font-normal cursor-pointer">
                Medium
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="heavy" id="heavy" />
              <Label htmlFor="heavy" className="font-normal cursor-pointer">
                Heavy
              </Label>
            </div>
          </RadioGroup>
        </div>
      </div>
    </div>
  );
}

function IntegrationStep({
  data,
  standalone,
  route,
  onChange,
}: {
  data: OnboardingState["integration"] | undefined;
  standalone: OnboardingState["standalone"] | undefined;
  route: "connect_existing" | "standalone" | null | undefined;
  onChange: (
    integration: OnboardingState["integration"],
    standalone: OnboardingState["standalone"]
  ) => void;
}) {
  const integrationDefaults = {
    fsmProvider: data?.fsmProvider || null,
    fsmConnected: data?.fsmConnected || false,
    fsmProviderOther: data?.fsmProviderOther || null,
  };

  const standaloneDefaults = {
    trackCustomersEnabled: standalone?.trackCustomersEnabled ?? true,
    trackJobsEnabled: standalone?.trackJobsEnabled ?? true,
  };

  if (route === "standalone") {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-2">Standalone Setup</h2>
        <p className="text-muted-foreground mb-6">
          We'll set up basic tracking for you inside LawnFlow.
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-md">
            <div>
              <Label>Track Customers</Label>
              <p className="text-xs text-muted-foreground">
                Keep a list of your customers and their contact info
              </p>
            </div>
            <Switch
              checked={standaloneDefaults.trackCustomersEnabled}
              onCheckedChange={(checked) =>
                onChange(integrationDefaults, {
                  ...standaloneDefaults,
                  trackCustomersEnabled: checked,
                })
              }
              data-testid="switch-track-customers"
            />
          </div>

          <div className="flex items-center justify-between p-4 border rounded-md">
            <div>
              <Label>Track Jobs</Label>
              <p className="text-xs text-muted-foreground">
                Keep a record of scheduled and completed jobs
              </p>
            </div>
            <Switch
              checked={standaloneDefaults.trackJobsEnabled}
              onCheckedChange={(checked) =>
                onChange(integrationDefaults, {
                  ...standaloneDefaults,
                  trackJobsEnabled: checked,
                })
              }
              data-testid="switch-track-jobs"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Connect Your Back Office</h2>
      <p className="text-muted-foreground mb-6">
        Connect your existing system so LawnFlow can schedule and log jobs automatically.
      </p>

      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
              <Link2 className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="font-medium">
                {FSM_PROVIDERS.find((p) => p.id === integrationDefaults.fsmProvider)?.label ||
                  "Job Management System"}
              </p>
              <p className="text-sm text-muted-foreground">
                {integrationDefaults.fsmConnected ? "Connected" : "Not connected"}
              </p>
            </div>
            <Button
              variant={integrationDefaults.fsmConnected ? "outline" : "default"}
              onClick={() =>
                onChange(
                  { ...integrationDefaults, fsmConnected: !integrationDefaults.fsmConnected },
                  standaloneDefaults
                )
              }
              data-testid="button-connect-fsm"
            >
              {integrationDefaults.fsmConnected ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                  Connected
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {integrationDefaults.fsmProvider === "other" && (
        <div className="mb-6">
          <Label>What system do you use?</Label>
          <Input
            value={integrationDefaults.fsmProviderOther || ""}
            onChange={(e) =>
              onChange(
                { ...integrationDefaults, fsmProviderOther: e.target.value },
                standaloneDefaults
              )
            }
            placeholder="Enter your system name"
            data-testid="input-fsm-other"
          />
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        For MVP, connections are simulated. In production, you'll authenticate with your provider.
      </p>
    </div>
  );
}

function CommunicationStep({
  data,
  onChange,
}: {
  data: OnboardingState["communication"] | undefined;
  onChange: (data: OnboardingState["communication"]) => void;
}) {
  const defaults = {
    phoneProvider: data?.phoneProvider || "existing_number",
    twilioAreaCode: data?.twilioAreaCode || "",
    textingEnabled: data?.textingEnabled ?? true,
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Communication Setup</h2>
      <p className="text-muted-foreground mb-6">
        Set up how LawnFlow will communicate with your customers.
      </p>

      <div className="space-y-6">
        <div className="flex items-center justify-between p-4 border rounded-md">
          <div>
            <Label>Enable Text Messaging</Label>
            <p className="text-xs text-muted-foreground">
              Allow LawnFlow to send and receive text messages with customers
            </p>
          </div>
          <Switch
            checked={defaults.textingEnabled}
            onCheckedChange={(checked) =>
              onChange({ ...defaults, textingEnabled: checked })
            }
            data-testid="switch-texting"
          />
        </div>

        {defaults.textingEnabled && (
          <div>
            <Label className="mb-3 block">Phone Number Setup</Label>
            <RadioGroup
              value={defaults.phoneProvider}
              onValueChange={(v) =>
                onChange({ ...defaults, phoneProvider: v })
              }
              className="space-y-3"
            >
              <div className="flex items-start space-x-3 p-3 border rounded-md">
                <RadioGroupItem value="existing_number" id="existing" className="mt-0.5" />
                <div>
                  <Label htmlFor="existing" className="font-normal cursor-pointer">
                    Use my existing business number
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Forward missed calls to LawnFlow
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 border rounded-md">
                <RadioGroupItem value="twilio" id="twilio" className="mt-0.5" />
                <div>
                  <Label htmlFor="twilio" className="font-normal cursor-pointer">
                    Get a new LawnFlow number
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    We'll provision a dedicated number for your business
                  </p>
                </div>
              </div>
            </RadioGroup>

            {defaults.phoneProvider === "existing_number" && (
              <Card className="mt-4 bg-muted/50">
                <CardContent className="p-4">
                  <p className="text-sm font-medium mb-2">Call Forwarding Instructions</p>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Open your phone's settings or dial your carrier's forwarding code</li>
                    <li>Set up forwarding for unanswered calls</li>
                    <li>Forward to the number we'll provide after setup</li>
                  </ol>
                </CardContent>
              </Card>
            )}

            {defaults.phoneProvider === "twilio" && (
              <div className="mt-4">
                <Label>Preferred Area Code</Label>
                <Input
                  value={defaults.twilioAreaCode}
                  onChange={(e) =>
                    onChange({ ...defaults, twilioAreaCode: e.target.value })
                  }
                  placeholder="e.g., 434"
                  maxLength={3}
                  className="w-24"
                  data-testid="input-area-code"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PricingStep({
  data,
  services,
  onChange,
}: {
  data: OnboardingState["pricing"] | undefined;
  services: string[] | null | undefined;
  onChange: (data: OnboardingState["pricing"]) => void;
}) {
  const defaults = {
    pricingModel: data?.pricingModel || "range_estimate",
    mowingMinPrice: data?.mowingMinPrice || 4500,
    cleanupMinPrice: data?.cleanupMinPrice || 15000,
    mulchMinPrice: data?.mulchMinPrice || 20000,
  };

  const hasMowing = services?.includes("mowing");
  const hasCleanup = services?.includes("cleanup");
  const hasMulch = services?.includes("mulch");

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Pricing Basics</h2>
      <p className="text-muted-foreground mb-6">
        Help our AI give accurate quotes. We'll never quote outside these rules.
      </p>

      <div className="space-y-6">
        <div>
          <Label className="mb-3 block">How do you typically quote?</Label>
          <RadioGroup
            value={defaults.pricingModel}
            onValueChange={(v) =>
              onChange({ ...defaults, pricingModel: v })
            }
            className="space-y-3"
          >
            <div className="flex items-start space-x-3 p-3 border rounded-md">
              <RadioGroupItem value="range_estimate" id="range" className="mt-0.5" />
              <div>
                <Label htmlFor="range" className="font-normal cursor-pointer">
                  Range estimate
                </Label>
                <p className="text-xs text-muted-foreground">
                  "Usually between $X and $Y" - Recommended for most businesses
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3 border rounded-md">
              <RadioGroupItem value="flat_per_visit" id="flat" className="mt-0.5" />
              <div>
                <Label htmlFor="flat" className="font-normal cursor-pointer">
                  Flat per visit
                </Label>
                <p className="text-xs text-muted-foreground">
                  Fixed prices for each service type
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3 border rounded-md">
              <RadioGroupItem value="site_visit_first" id="site" className="mt-0.5" />
              <div>
                <Label htmlFor="site" className="font-normal cursor-pointer">
                  Site visit first
                </Label>
                <p className="text-xs text-muted-foreground">
                  Always need to see the property before quoting
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>

        {defaults.pricingModel !== "site_visit_first" && (
          <div className="space-y-4">
            <Label>Minimum Prices</Label>
            <p className="text-xs text-muted-foreground -mt-2">
              We'll never quote below these amounts
            </p>

            {hasMowing && (
              <div className="flex items-center gap-4">
                <Label className="w-24">Mowing</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">$</span>
                  <Input
                    type="number"
                    value={Math.round(defaults.mowingMinPrice / 100)}
                    onChange={(e) =>
                      onChange({
                        ...defaults,
                        mowingMinPrice: parseInt(e.target.value) * 100 || 0,
                      })
                    }
                    className="w-24"
                    data-testid="input-mowing-price"
                  />
                </div>
              </div>
            )}

            {hasCleanup && (
              <div className="flex items-center gap-4">
                <Label className="w-24">Cleanup</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">$</span>
                  <Input
                    type="number"
                    value={Math.round(defaults.cleanupMinPrice / 100)}
                    onChange={(e) =>
                      onChange({
                        ...defaults,
                        cleanupMinPrice: parseInt(e.target.value) * 100 || 0,
                      })
                    }
                    className="w-24"
                    data-testid="input-cleanup-price"
                  />
                </div>
              </div>
            )}

            {hasMulch && (
              <div className="flex items-center gap-4">
                <Label className="w-24">Mulch</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">$</span>
                  <Input
                    type="number"
                    value={Math.round(defaults.mulchMinPrice / 100)}
                    onChange={(e) =>
                      onChange({
                        ...defaults,
                        mulchMinPrice: parseInt(e.target.value) * 100 || 0,
                      })
                    }
                    className="w-24"
                    data-testid="input-mulch-price"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AutomationStep({
  data,
  onChange,
}: {
  data: OnboardingState["automation"] | undefined;
  onChange: (data: OnboardingState["automation"]) => void;
}) {
  const defaults = {
    missedCallRecoveryEnabled: data?.missedCallRecoveryEnabled ?? true,
    autoTextEnabled: data?.autoTextEnabled ?? true,
    autoQuoteEnabled: data?.autoQuoteEnabled ?? false,
    approvalsRequiredForBooking: data?.approvalsRequiredForBooking ?? true,
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Automation Preferences</h2>
      <p className="text-muted-foreground mb-6">
        Control how much LawnFlow automates for you. You can change these anytime.
      </p>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 border rounded-md">
          <div>
            <Label>Missed Call Recovery</Label>
            <p className="text-xs text-muted-foreground">
              Automatically text back when you miss a call
            </p>
          </div>
          <Switch
            checked={defaults.missedCallRecoveryEnabled}
            onCheckedChange={(checked) =>
              onChange({ ...defaults, missedCallRecoveryEnabled: checked })
            }
            data-testid="switch-missed-call"
          />
        </div>

        <div className="flex items-center justify-between p-4 border rounded-md">
          <div>
            <Label>Auto Text Follow-ups</Label>
            <p className="text-xs text-muted-foreground">
              Send automatic follow-up messages to leads
            </p>
          </div>
          <Switch
            checked={defaults.autoTextEnabled}
            onCheckedChange={(checked) =>
              onChange({ ...defaults, autoTextEnabled: checked })
            }
            data-testid="switch-auto-text"
          />
        </div>

        <div className="flex items-center justify-between p-4 border rounded-md">
          <div>
            <Label>Auto Quote</Label>
            <p className="text-xs text-muted-foreground">
              Let AI send quotes automatically (recommended for high-volume)
            </p>
          </div>
          <Switch
            checked={defaults.autoQuoteEnabled}
            onCheckedChange={(checked) =>
              onChange({ ...defaults, autoQuoteEnabled: checked })
            }
            data-testid="switch-auto-quote"
          />
        </div>

        <div className="flex items-center justify-between p-4 border rounded-md">
          <div>
            <Label>Require Approval Before Booking</Label>
            <p className="text-xs text-muted-foreground">
              Review and approve jobs before they're confirmed
            </p>
          </div>
          <Switch
            checked={defaults.approvalsRequiredForBooking}
            onCheckedChange={(checked) =>
              onChange({ ...defaults, approvalsRequiredForBooking: checked })
            }
            data-testid="switch-approvals"
          />
        </div>
      </div>
    </div>
  );
}

const INVOICE_TERMS = [
  { id: "due_on_receipt", label: "Due on Receipt" },
  { id: "net_7", label: "Net 7 Days" },
  { id: "net_14", label: "Net 14 Days" },
  { id: "net_30", label: "Net 30 Days" },
];

function BillingStep({
  data,
  onChange,
}: {
  data?: OnboardingState["billing"];
  onChange: (data: OnboardingState["billing"]) => void;
}) {
  const defaults = {
    useQuickBooks: data?.useQuickBooks ?? null,
    quickBooksConnected: data?.quickBooksConnected ?? false,
    invoiceTerms: data?.invoiceTerms ?? "net_7",
    defaultTaxRate: data?.defaultTaxRate ?? 0,
    taxEnabled: data?.taxEnabled ?? false,
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Billing & Accounting</h2>
      <p className="text-muted-foreground mb-6">
        Set up how you manage invoices and track payments.
      </p>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Accounting Integration
          </CardTitle>
          <CardDescription>
            LawnFlow orchestrates billing; your accounting system remains the source of truth.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label>Do you use QuickBooks Online?</Label>
            <RadioGroup
              value={defaults.useQuickBooks === true ? "yes" : defaults.useQuickBooks === false ? "no" : ""}
              onValueChange={(val) =>
                onChange({ ...defaults, useQuickBooks: val === "yes" })
              }
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="yes" id="qb-yes" data-testid="radio-qb-yes" />
                <Label htmlFor="qb-yes" className="font-normal">
                  Yes, I use QuickBooks Online
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="no" id="qb-no" data-testid="radio-qb-no" />
                <Label htmlFor="qb-no" className="font-normal">
                  No, I use something else or nothing
                </Label>
              </div>
            </RadioGroup>
          </div>

          {defaults.useQuickBooks === true && !defaults.quickBooksConnected && (
            <div className="p-4 border rounded-md bg-muted/50">
              <p className="text-sm text-muted-foreground mb-3">
                You can connect QuickBooks now or later from Settings.
              </p>
              <Button variant="outline" size="sm" data-testid="button-connect-qb-later">
                Connect Later
              </Button>
            </div>
          )}

          {defaults.useQuickBooks === false && (
            <div className="p-3 border rounded-md bg-muted/50">
              <p className="text-sm text-muted-foreground">
                Invoices will be saved locally. You can export them or connect an accounting system later.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Invoice Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Default Payment Terms</Label>
            <Select
              value={defaults.invoiceTerms || "net_7"}
              onValueChange={(val) => onChange({ ...defaults, invoiceTerms: val })}
            >
              <SelectTrigger data-testid="select-invoice-terms">
                <SelectValue placeholder="Select payment terms" />
              </SelectTrigger>
              <SelectContent>
                {INVOICE_TERMS.map((term) => (
                  <SelectItem key={term.id} value={term.id}>
                    {term.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between p-4 border rounded-md">
            <div>
              <Label>Enable Tax</Label>
              <p className="text-xs text-muted-foreground">
                Automatically add tax to invoices
              </p>
            </div>
            <Switch
              checked={defaults.taxEnabled || false}
              onCheckedChange={(checked) =>
                onChange({ ...defaults, taxEnabled: checked })
              }
              data-testid="switch-tax-enabled"
            />
          </div>

          {defaults.taxEnabled && (
            <div className="space-y-2">
              <Label>Default Tax Rate (%)</Label>
              <Input
                type="number"
                min="0"
                max="25"
                step="0.25"
                value={defaults.defaultTaxRate || 0}
                onChange={(e) =>
                  onChange({ ...defaults, defaultTaxRate: parseFloat(e.target.value) || 0 })
                }
                placeholder="e.g., 7.5"
                data-testid="input-tax-rate"
              />
              <p className="text-xs text-muted-foreground">
                Common rates: 6%, 7%, 8.25%, etc. Leave at 0 if not applicable.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ReviewStep({
  state,
  onLaunch,
  isLaunching,
}: {
  state: Partial<OnboardingState>;
  onLaunch: () => void;
  isLaunching: boolean;
}) {
  const sections = [
    {
      title: "Setup Route",
      value: state.onboardingRoute === "connect_existing" 
        ? "Connected to existing system" 
        : "Standalone mode",
    },
    {
      title: "Business",
      value: state.businessBasics?.businessName || "Not set",
    },
    {
      title: "Service Area",
      value: state.serviceArea?.radiusMi 
        ? `${state.serviceArea.radiusMi} mile radius` 
        : "Not set",
    },
    {
      title: "Services",
      value: state.services?.serviceTypes?.length 
        ? state.services.serviceTypes.join(", ") 
        : "Not set",
    },
    {
      title: "Pricing",
      value: state.pricing?.pricingModel === "range_estimate" 
        ? "Range estimates" 
        : state.pricing?.pricingModel === "flat_per_visit" 
        ? "Flat pricing" 
        : "Site visit required",
    },
    {
      title: "Billing",
      value: state.billing?.useQuickBooks 
        ? "QuickBooks Online" 
        : state.billing?.useQuickBooks === false
        ? "Local invoicing" 
        : "Not configured",
    },
    {
      title: "Automation",
      value: [
        state.automation?.missedCallRecoveryEnabled && "Missed call recovery",
        state.automation?.autoTextEnabled && "Auto text",
        state.automation?.autoQuoteEnabled && "Auto quote",
      ].filter(Boolean).join(", ") || "Minimal automation",
    },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">Review & Launch</h2>
      <p className="text-muted-foreground mb-6">
        Everything looks good! Review your settings and launch when ready.
      </p>

      <div className="space-y-3 mb-8">
        {sections.map((section) => (
          <div key={section.title} className="flex items-center justify-between p-3 border rounded-md">
            <span className="text-sm text-muted-foreground">{section.title}</span>
            <span className="text-sm font-medium">{section.value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-4">
        <Button 
          size="lg" 
          onClick={onLaunch}
          disabled={isLaunching}
          data-testid="button-launch"
          className="w-full sm:w-auto"
        >
          {isLaunching ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Rocket className="h-4 w-4 mr-2" />
          )}
          Launch LawnFlow
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          You can change any of these settings later in Business Profile
        </p>
      </div>
    </div>
  );
}
