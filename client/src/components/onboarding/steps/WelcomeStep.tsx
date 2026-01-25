import { Check } from "lucide-react";

interface WelcomeStepProps {
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
}

export function WelcomeStep({ data, onChange }: WelcomeStepProps) {
  return (
    <div className="space-y-6">
      <div className="text-center py-8">
        <h2 className="text-3xl font-bold mb-4">
          Welcome to LawnFlow! 🌱
        </h2>
        <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
          Let LawnFlow set up your business — you stay in control.
        </p>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <h3 className="font-semibold mb-4">What we'll cover (5–10 minutes):</h3>
        <div className="space-y-3">
          {[
            'Business information and service area',
            'Services you offer (simple category selection)',
            'Your first crew setup',
            'Payment methods (critical)',
            'Approval rules (optional but recommended)',
            'Marketing & integrations (optional)',
          ].map((item, index) => (
            <div key={index} className="flex items-start gap-3">
              <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <span className="text-sm">{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>Pro tip:</strong> You can always come back and customize everything later. 
          Our goal is to get you up and running fast, then refine as you grow.
        </p>
      </div>
    </div>
  );
}
