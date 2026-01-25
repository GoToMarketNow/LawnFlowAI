import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

interface ServicesStepProps {
  data: Record<string, any>;
  onChange: (data: Record<string, any>) => void;
}

// Service packs from shared/service-packs.ts
const SERVICE_PACKS = [
  { id: 'STARTER_LAWN', name: '⭐ Starter Lawn Pack', description: 'Lawn maintenance + seasonal cleanup', recommended: true },
  { id: 'SEASONAL_CLEANUP', name: 'Seasonal Cleanup Pack', description: 'Spring/fall cleanups + mulching', recommended: true },
  { id: 'LAWN_TREATMENTS', name: 'Lawn Treatments Pack', description: 'Fertilization + weed control', recommended: true },
  { id: 'GARDEN_BEDS', name: 'Garden & Beds Pack', description: 'Mulch, planting, shrub care', recommended: false },
  { id: 'HARDSCAPE_BASICS', name: 'Hardscape Basics Pack', description: 'Patios, walkways, pressure washing', recommended: false },
];

export function ServicesStep({ data, onChange }: ServicesStepProps) {
  const selectedPacks = data.service_packs || ['STARTER_LAWN'];

  const togglePack = (packId: string) => {
    const newPacks = selectedPacks.includes(packId)
      ? selectedPacks.filter((id: string) => id !== packId)
      : [...selectedPacks, packId];
    onChange({ service_packs: newPacks });
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Select Service Packs *</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Choose pre-configured service bundles. You can refine individual services later.
        </p>
      </div>

      <div className="grid gap-4">
        {SERVICE_PACKS.map((pack) => (
          <Card
            key={pack.id}
            className={`p-4 cursor-pointer transition-all ${
              selectedPacks.includes(pack.id)
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => togglePack(pack.id)}
          >
            <div className="flex items-start gap-3">
              <Checkbox
                checked={selectedPacks.includes(pack.id)}
                onCheckedChange={() => togglePack(pack.id)}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold">{pack.name}</h4>
                  {pack.recommended && (
                    <Badge variant="secondary" className="text-xs">
                      Recommended
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{pack.description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>Note:</strong> LawnFlow will handle jobs at the category level until you refine individual services.
        </p>
      </div>
    </div>
  );
}
