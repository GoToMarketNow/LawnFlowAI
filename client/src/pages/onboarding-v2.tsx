import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Check, ChevronRight, ChevronLeft, Sparkles, Loader2 } from "lucide-react";

// Import step components (to be created)
import { WelcomeStep } from "@/components/onboarding/steps/WelcomeStep";
import { BusinessBasicsStep } from "@/components/onboarding/steps/BusinessBasicsStep";
import { ServicesStep } from "@/components/onboarding/steps/ServicesStep";
import { PricingStep } from "@/components/onboarding/steps/PricingStep";
import { CrewsStep } from "@/components/onboarding/steps/CrewsStep";
import { GetPaidStep } from "@/components/onboarding/steps/GetPaidStep";
import { ApprovalsStep } from "@/components/onboarding/steps/ApprovalsStep";
import { PowerUpsStep } from "@/components/onboarding/steps/PowerUpsStep";

export type OnboardingStepId =
  | "welcome"
  | "business_basics"
  | "services"
  | "pricing"
  | "crews"
  | "get_paid"
  | "approvals"
  | "power_ups";

interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  description: string;
  required: boolean;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "Welcome",
    description: "Let's get you set up",
    required: false,
  },
  {
    id: "business_basics",
    title: "Business Basics",
    description: "Your company information",
    required: true,
  },
  {
    id: "services",
    title: "Services",
    description: "What services do you offer?",
    required: true,
  },
  {
    id: "pricing",
    title: "Pricing",
    description: "How do you price jobs?",
    required: true,
  },
  {
    id: "crews",
    title: "Crews",
    description: "Your first crew",
    required: true,
  },
  {
    id: "get_paid",
    title: "Get Paid",
    description: "Payment setup (critical)",
    required: true,
  },
  {
    id: "approvals",
    title: "Approvals",
    description: "Who approves what",
    required: true,
  },
  {
    id: "power_ups",
    title: "Power-Ups",
    description: "Optional features",
    required: false,
  },
];

interface OnboardingSession {
  session_id: number;
  current_step: OnboardingStepId;
  completed_steps: OnboardingStepId[];
  progress_percentage: number;
  can_proceed: boolean;
  validation_errors: Array<{ field: string; message: string }>;
  state: Record<string, any>;
}

export default function OnboardingV2() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepData, setStepData] = useState<Record<string, any>>({});

  const currentStep = ONBOARDING_STEPS[currentStepIndex];

  // Start onboarding session
  const startSession = useMutation({
    mutationFn: async () => {
      return apiRequest<{ session: OnboardingSession }>("/api/onboarding/start", {
        method: "POST",
        body: JSON.stringify({
          userId: 1, // TODO: Get from auth context
        }),
      });
    },
    onSuccess: (data) => {
      setSessionId(data.session.session_id);
      toast({
        title: "Welcome to LawnFlow!",
        description: "Let's get your business set up in just a few minutes.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error starting onboarding",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  // Submit step
  const submitStep = useMutation({
    mutationFn: async (data: { step: OnboardingStepId; stepData: Record<string, any> }) => {
      return apiRequest<{ session: OnboardingSession }>(
        `/api/onboarding/step/${data.step}`,
        {
          method: "POST",
          body: JSON.stringify({
            sessionId,
            ...data.stepData,
          }),
        }
      );
    },
    onSuccess: (data) => {
      setStepData({ ...stepData, [currentStep.id]: data.session.state });
      
      // Move to next step
      if (currentStepIndex < ONBOARDING_STEPS.length - 1) {
        setCurrentStepIndex(currentStepIndex + 1);
      } else {
        // Complete onboarding
        completeOnboarding.mutate();
      }

      toast({
        title: "Progress saved",
        description: `${currentStep.title} completed successfully!`,
      });
    },
    onError: (error) => {
      toast({
        title: "Validation error",
        description: error instanceof Error ? error.message : "Please check your inputs",
        variant: "destructive",
      });
    },
  });

  // Complete onboarding
  const completeOnboarding = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/onboarding/complete", {
        method: "POST",
        body: JSON.stringify({ sessionId }),
      });
    },
    onSuccess: () => {
      toast({
        title: "🎉 Onboarding Complete!",
        description: "Welcome to LawnFlow. Let's grow your business!",
      });
      navigate("/dashboard");
    },
    onError: (error) => {
      toast({
        title: "Cannot complete onboarding",
        description: error instanceof Error ? error.message : "Some required steps are missing",
        variant: "destructive",
      });
    },
  });

  // Initialize session on mount
  useState(() => {
    if (!sessionId) {
      startSession.mutate();
    }
  });

  const handleNext = () => {
    const currentStepData = stepData[currentStep.id] || {};
    submitStep.mutate({
      step: currentStep.id,
      stepData: currentStepData,
    });
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleSkip = () => {
    if (!currentStep.required && currentStepIndex < ONBOARDING_STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const updateStepData = (data: Record<string, any>) => {
    setStepData({
      ...stepData,
      [currentStep.id]: { ...stepData[currentStep.id], ...data },
    });
  };

  const progress = ((currentStepIndex + 1) / ONBOARDING_STEPS.length) * 100;

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Initializing onboarding...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-green-600" />
              <h1 className="text-3xl font-bold">LawnFlow Setup</h1>
            </div>
            <div className="text-sm text-muted-foreground">
              Step {currentStepIndex + 1} of {ONBOARDING_STEPS.length}
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step Indicator */}
        <div className="mb-8 flex gap-2 overflow-x-auto pb-2">
          {ONBOARDING_STEPS.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap ${
                index === currentStepIndex
                  ? "bg-green-100 text-green-900"
                  : index < currentStepIndex
                  ? "bg-gray-100 text-gray-600"
                  : "bg-gray-50 text-gray-400"
              }`}
            >
              {index < currentStepIndex && <Check className="h-4 w-4" />}
              <span className="text-sm font-medium">{step.title}</span>
              {step.required && <span className="text-xs text-red-500">*</span>}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{currentStep.title}</CardTitle>
            <CardDescription>{currentStep.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {currentStep.id === "welcome" && (
              <WelcomeStep data={stepData.welcome || {}} onChange={updateStepData} />
            )}
            {currentStep.id === "business_basics" && (
              <BusinessBasicsStep
                data={stepData.business_basics || {}}
                onChange={updateStepData}
              />
            )}
            {currentStep.id === "services" && (
              <ServicesStep data={stepData.services || {}} onChange={updateStepData} />
            )}
            {currentStep.id === "pricing" && (
              <PricingStep data={stepData.pricing || {}} onChange={updateStepData} />
            )}
            {currentStep.id === "crews" && (
              <CrewsStep data={stepData.crews || {}} onChange={updateStepData} />
            )}
            {currentStep.id === "get_paid" && (
              <GetPaidStep 
                data={stepData.get_paid || {}} 
                onChange={updateStepData}
                userId={1} // TODO: Get from auth context
                businessId={1} // TODO: Get from auth context
                sessionId={sessionId}
              />
            )}
            {currentStep.id === "approvals" && (
              <ApprovalsStep data={stepData.approvals || {}} onChange={updateStepData} />
            )}
            {currentStep.id === "power_ups" && (
              <PowerUpsStep 
                data={stepData.power_ups || {}} 
                onChange={updateStepData}
                sessionId={sessionId}
              />
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStepIndex === 0 || submitStep.isPending}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <div className="flex gap-2">
            {!currentStep.required && (
              <Button variant="ghost" onClick={handleSkip} disabled={submitStep.isPending}>
                Skip
              </Button>
            )}
            <Button onClick={handleNext} disabled={submitStep.isPending}>
              {submitStep.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : currentStepIndex === ONBOARDING_STEPS.length - 1 ? (
                "Complete"
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
