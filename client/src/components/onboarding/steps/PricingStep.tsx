import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface PricingStepProps {
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
}

export function PricingStep({ data, onChange }: PricingStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">How Do You Price Jobs? *</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Choose your primary pricing model. You can adjust per service later.
        </p>
      </div>

      <RadioGroup
        value={data.pricing_model || ''}
        onValueChange={(value) => onChange({ pricing_model: value })}
      >
        <div className="space-y-4">
          <div className="border rounded-lg p-4 cursor-pointer hover:border-green-500">
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="per_visit" id="per_visit" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="per_visit" className="font-semibold cursor-pointer">
                  Per Visit
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Best for recurring maintenance (mowing, treatments)
                </p>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4 cursor-pointer hover:border-green-500">
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="per_job" id="per_job" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="per_job" className="font-semibold cursor-pointer">
                  Per Job
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Best for one-time projects (cleanups, hardscaping)
                </p>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4 cursor-pointer hover:border-green-500">
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="monthly" id="monthly" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="monthly" className="font-semibold cursor-pointer">
                  Monthly Recurring
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Best for service contracts with predictable revenue
                </p>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4 cursor-pointer hover:border-green-500">
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="mixed" id="mixed" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="mixed" className="font-semibold cursor-pointer">
                  Mixed (Advanced)
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Use different pricing models for different services
                </p>
              </div>
            </div>
          </div>
        </div>
      </RadioGroup>
    </div>
  );
}
