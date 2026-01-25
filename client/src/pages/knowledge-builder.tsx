import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Wand2,
  BookOpen,
  FileText,
  CreditCard,
  Settings,
  Camera,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";

interface BuilderResult {
  success: boolean;
  draftsCreated: number;
  drafts: Array<{
    knowledgeItemId: number;
    versionId: number;
    itemType: string;
    title: string;
    status: string;
  }>;
  errors: string[];
}

const knowledgeTypes = [
  {
    value: "policy",
    label: "Policies",
    description: "Refund, cancellation, guarantee, liability policies",
    icon: <BookOpen className="h-5 w-5" />,
    examples: "Refund Policy, Service Guarantee, Cancellation Terms",
    estimatedCount: "3-5 items",
  },
  {
    value: "service",
    label: "Services",
    description: "Detailed service descriptions and pricing info",
    icon: <Settings className="h-5 w-5" />,
    examples: "Lawn Mowing, Spring Cleanup, Mulch Installation",
    estimatedCount: "Based on your services",
  },
  {
    value: "payment",
    label: "Payment FAQs",
    description: "Common payment and billing questions",
    icon: <CreditCard className="h-5 w-5" />,
    examples: "How does autopay work?, When are invoices sent?",
    estimatedCount: "5-7 FAQs",
  },
  {
    value: "operations",
    label: "Operations",
    description: "Standard operating procedures for internal use",
    icon: <FileText className="h-5 w-5" />,
    examples: "Scheduling Process, Crew Assignment, Quality Checks",
    estimatedCount: "2-3 procedures",
  },
  {
    value: "proof_of_work",
    label: "Proof of Work",
    description: "Evidence requirements for service verification",
    icon: <Camera className="h-5 w-5" />,
    examples: "Photo Requirements, GPS Check-in, Customer Signatures",
    estimatedCount: "Based on your services",
  },
  {
    value: "macro",
    label: "Macro Templates",
    description: "Support message templates for common scenarios",
    icon: <MessageSquare className="h-5 w-5" />,
    examples: "Appointment Confirmation, Rescheduling, Payment Reminders",
    estimatedCount: "5-8 templates",
  },
];

export default function KnowledgeBuilderPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [selectedTypes, setSelectedTypes] = useState<string[]>([
    "policy",
    "service",
    "payment",
  ]);
  const [result, setResult] = useState<BuilderResult | null>(null);

  const buildMutation = useMutation({
    mutationFn: (includeTypes: string[]) =>
      apiRequest("POST", "/api/knowledge/builder/generate", {
        includeTypes,
        overwrite: false,
      }),
    onSuccess: (data: BuilderResult) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/items"] });
    },
  });

  const handleToggle = (value: string) => {
    setSelectedTypes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleGenerate = () => {
    if (selectedTypes.length === 0) {
      alert("Please select at least one knowledge type to generate");
      return;
    }

    if (
      confirm(
        `This will generate ${selectedTypes.length} knowledge type(s). Items will be created as drafts for your review. Continue?`
      )
    ) {
      buildMutation.mutate(selectedTypes);
    }
  };

  if (result && result.success) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="text-center mb-8">
          <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Knowledge Base Generated!</h1>
          <p className="text-muted-foreground">
            {result.draftsCreated} draft items created and ready for your review
          </p>
        </div>

        {/* Results Summary */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Generated Items</CardTitle>
            <CardDescription>
              All items are in draft status. Review and publish when ready.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {result.drafts.map((draft) => (
                <div
                  key={draft.knowledgeItemId}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      {knowledgeTypes.find((t) => t.value === draft.itemType)?.icon || (
                        <FileText className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{draft.title}</p>
                      <p className="text-xs text-muted-foreground">{draft.itemType}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {draft.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Errors */}
        {result.errors.length > 0 && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium mb-2">Some items failed to generate:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {result.errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => setLocation("/knowledge")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Knowledge Base
          </Button>
          <Button onClick={() => setLocation("/knowledge/approvals")}>
            Review Drafts
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" onClick={() => setLocation("/knowledge")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Wand2 className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">Knowledge Base Auto-Generator</h1>
            <p className="text-muted-foreground">
              AI will analyze your business configuration and generate relevant knowledge base
              content as drafts for your review.
            </p>
          </div>
        </div>
      </div>

      {/* Info Alert */}
      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <p className="font-medium mb-1">How it works:</p>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Select which knowledge types you want to generate</li>
            <li>AI analyzes your business profile, services, and policies</li>
            <li>Draft items are created and saved for your review</li>
            <li>Review, edit, and publish when ready</li>
          </ol>
        </AlertDescription>
      </Alert>

      {/* Type Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Knowledge Types to Generate</CardTitle>
          <CardDescription>Choose one or more types. You can always generate more later.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {knowledgeTypes.map((type) => (
              <div
                key={type.value}
                className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => handleToggle(type.value)}
              >
                <Checkbox
                  checked={selectedTypes.includes(type.value)}
                  onCheckedChange={() => handleToggle(type.value)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                      {type.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">{type.label}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {type.estimatedCount}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{type.description}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Examples:</span> {type.examples}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Generate Button */}
      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={handleGenerate}
          disabled={buildMutation.isPending || selectedTypes.length === 0}
        >
          {buildMutation.isPending ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Generating Knowledge Base...
            </>
          ) : (
            <>
              <Wand2 className="h-5 w-5 mr-2" />
              Generate Knowledge Base
            </>
          )}
        </Button>
      </div>

      {/* Loading State */}
      {buildMutation.isPending && (
        <Card className="mt-6">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <p className="text-sm font-medium">Analyzing your business configuration...</p>
              </div>
              <Progress value={33} className="h-2" />
              <p className="text-xs text-muted-foreground">
                This may take 30-60 seconds depending on the number of types selected.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {buildMutation.isError && (
        <Alert variant="destructive" className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to generate knowledge base. Please try again or contact support if the problem
            persists.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
