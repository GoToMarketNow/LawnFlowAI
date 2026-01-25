import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CrewsStepProps {
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
}

export function CrewsStep({ data, onChange }: CrewsStepProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Your First Crew</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Start with one crew lead. You can add more crew members and teams later.
        </p>
      </div>

      <div>
        <Label htmlFor="crew_lead_name">Crew Lead Name *</Label>
        <Input
          id="crew_lead_name"
          value={data.crew_lead_name || ''}
          onChange={(e) => onChange({ crew_lead_name: e.target.value })}
          placeholder="e.g., John Smith"
        />
      </div>

      <div>
        <Label htmlFor="crew_lead_phone">Crew Lead Phone *</Label>
        <Input
          id="crew_lead_phone"
          type="tel"
          value={data.crew_lead_phone || ''}
          onChange={(e) => onChange({ crew_lead_phone: e.target.value })}
          placeholder="e.g., (555) 123-4567"
        />
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-sm text-green-900">
          <strong>Tip:</strong> Add crew members' skills, equipment, and availability later in Settings → Crews.
        </p>
      </div>
    </div>
  );
}
