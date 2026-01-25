import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface ApprovalsStepProps {
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
}

const APPROVAL_RULES = [
  { id: 'schedule_changes', name: 'Schedule changes', enabled: true },
  { id: 'pricing_overrides', name: 'Pricing overrides', enabled: true },
  { id: 'payment_refunds', name: 'Payment refunds', enabled: true },
  { id: 'marketing_posts', name: 'Marketing posts (if enabled)', enabled: true },
];

export function ApprovalsStep({ data, onChange }: ApprovalsStepProps) {
  const approvalRules = data.approval_rules || APPROVAL_RULES.map(r => r.id);

  const toggleRule = (ruleId: string) => {
    const newRules = approvalRules.includes(ruleId)
      ? approvalRules.filter((id: string) => id !== ruleId)
      : [...approvalRules, ruleId];
    onChange({ approval_rules: newRules });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Who Approves Important Actions?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Set up human-in-the-loop controls for critical decisions.
        </p>
      </div>

      <div>
        <Label htmlFor="approval_owner">Approval Owner *</Label>
        <Input
          id="approval_owner"
          value={data.approval_owner || ''}
          onChange={(e) => onChange({ approval_owner: e.target.value })}
          placeholder="e.g., Owner, Manager"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Who should review and approve important actions?
        </p>
      </div>

      <div>
        <Label className="mb-3 block">Approval Rules</Label>
        <div className="space-y-3">
          {APPROVAL_RULES.map((rule) => (
            <div key={rule.id} className="flex items-start space-x-2">
              <Checkbox
                id={rule.id}
                checked={approvalRules.includes(rule.id)}
                onCheckedChange={() => toggleRule(rule.id)}
              />
              <Label htmlFor={rule.id} className="font-normal cursor-pointer">
                {rule.name}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>Recommended:</strong> Start with all approvals enabled, then relax rules as you build confidence.
        </p>
      </div>
    </div>
  );
}
