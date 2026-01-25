import { useLocation } from "wouter";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export default function AgentSetupPage() {
  const [, setLocation] = useLocation();

  const handleComplete = () => {
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-background py-12 px-4" data-testid="page-agent-setup">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold" data-testid="text-agent-setup-title">
            Configure AI Agents
          </h1>
          <p className="text-muted-foreground text-lg">
            Tell us how you'd like LawnFlow AI to work for your business
          </p>
        </div>

        <OnboardingWizard onComplete={handleComplete} />
      </div>
    </div>
  );
}
