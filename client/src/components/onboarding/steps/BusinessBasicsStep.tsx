import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface BusinessBasicsStepProps {
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
}

export function BusinessBasicsStep({ data, onChange }: BusinessBasicsStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="business_name">Business Name *</Label>
        <Input
          id="business_name"
          value={data.business_name || ''}
          onChange={(e) => onChange({ business_name: e.target.value })}
          placeholder="e.g., Green Horizons Lawn Care"
        />
      </div>

      <div>
        <Label htmlFor="service_area">Primary Service Area *</Label>
        <Input
          id="service_area"
          value={data.service_area || ''}
          onChange={(e) => onChange({ service_area: e.target.value })}
          placeholder="e.g., Columbus, OH or enter ZIP codes"
        />
      </div>

      <div>
        <Label>Customer Type *</Label>
        <RadioGroup
          value={data.customer_type || ''}
          onValueChange={(value) => onChange({ customer_type: value })}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="residential" id="residential" />
            <Label htmlFor="residential" className="font-normal cursor-pointer">
              Residential
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="commercial" id="commercial" />
            <Label htmlFor="commercial" className="font-normal cursor-pointer">
              Commercial
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="both" id="both" />
            <Label htmlFor="both" className="font-normal cursor-pointer">
              Both
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}
