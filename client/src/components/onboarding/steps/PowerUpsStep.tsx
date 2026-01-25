import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { VerificationStatus } from "../VerificationStatus";

interface PowerUpsStepProps {
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
  sessionId?: number;
}

const POWER_UPS = [
  {
    id: 'enable_marketing',
    name: 'Marketing Agent',
    description: 'Automatically find customers and generate leads',
    recommended: true,
  },
  {
    id: 'enable_integration',
    name: 'System Integration',
    description: 'Connect Jobber, QuickBooks, or other tools',
    recommended: false,
  },
  {
    id: 'enable_advanced_scheduling',
    name: 'Advanced Scheduling',
    description: 'Route optimization and automated scheduling',
    recommended: false,
  },
];

export function PowerUpsStep({ data, onChange, sessionId }: PowerUpsStepProps) {
  const enabledPowerUps = data.enabled_power_ups || [];

  const togglePowerUp = (powerUpId: string) => {
    const newPowerUps = enabledPowerUps.includes(powerUpId)
      ? enabledPowerUps.filter((id: string) => id !== powerUpId)
      : [...enabledPowerUps, powerUpId];
    onChange({ enabled_power_ups: newPowerUps });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Optional Power-Ups</h3>
        <p className="text-sm text-muted-foreground mb-4">
          These features are completely optional. You can enable them now or later in Settings.
        </p>
      </div>

      <div className="space-y-4">
        {POWER_UPS.map((powerUp) => (
          <Card key={powerUp.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold">{powerUp.name}</h4>
                  {powerUp.recommended && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{powerUp.description}</p>
              </div>
              <Switch
                checked={enabledPowerUps.includes(powerUp.id)}
                onCheckedChange={() => togglePowerUp(powerUp.id)}
              />
            </div>
          </Card>
        ))}
      </div>

      <Separator />

      {/* Platform Verification */}
      {sessionId && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Platform Verification</h3>
          <VerificationStatus sessionId={sessionId} />
        </div>
      )}

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-sm text-green-900">
          <strong>You're almost done!</strong> Complete platform verification above, then click "Complete" to finish onboarding.
        </p>
      </div>
    </div>
  );
}
