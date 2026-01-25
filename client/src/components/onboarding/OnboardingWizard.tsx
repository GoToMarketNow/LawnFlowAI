import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { QuestionRenderer } from "./QuestionRenderer";
import { ReviewStep } from "./ReviewStep";

interface FlowNode {
  id: string;
  type: "message" | "question" | "terminal";
  text: string;
  inputType?: "MULTI_SELECT" | "SINGLE_SELECT" | "TEXT" | "NUMBER" | "ZIP_LIST";
  options?: Array<{ value: string; label: string; hint?: string }>;
  validation?: {
    required?: boolean;
    minSelections?: number;
    maxSelections?: number;
    min?: number;
    max?: number;
  };
}

interface OnboardingSession {
  id: number;
  status: string;
  currentNodeId: string | null;
}

interface OnboardingResponse {
  session: OnboardingSession;
  currentNode: FlowNode | null;
  progress: number;
}

interface SubmitResponse {
  nextNode: FlowNode | null;
  session: OnboardingSession;
  isComplete: boolean;
}

interface SummaryAnswer {
  nodeId: string;
  question: string;
  answer: unknown;
}

interface SummaryResponse {
  sessionId: number;
  answers: SummaryAnswer[];
  progress: number;
}

interface DerivedConfig {
  automationThresholds: {
    quoteApprovalLimit: number;
    scheduleApprovalRequired: boolean;
    commsAutoSend: boolean;
  };
  enabledAgents: string[];
  approvalRules: Record<string, string>;
  coverageRules: Record<string, unknown>;
  notificationRules: Record<string, string[]>;
  businessProfile: Record<string, unknown>;
}

export function OnboardingWizard({ onComplete }: { onComplete?: () => void }) {
  const [currentAnswer, setCurrentAnswer] = useState<unknown>(null);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [completedConfig, setCompletedConfig] = useState<DerivedConfig | null>(null);

  const { data: sessionData, isLoading: isLoadingSession, refetch } = useQuery<OnboardingResponse>({
    queryKey: ["/api/onboarding/session"],
  });

  const { data: summaryData, refetch: refetchSummary } = useQuery<SummaryResponse>({
    queryKey: ["/api/onboarding/summary"],
    enabled: isReviewMode,
  });

  const submitMutation = useMutation({
    mutationFn: async ({ nodeId, answer }: { nodeId: string; answer: unknown }) => {
      const res = await apiRequest("POST", "/api/onboarding/answer", { nodeId, answer });
      return res.json() as Promise<SubmitResponse>;
    },
    onSuccess: (data) => {
      setCurrentAnswer(null);
      if (data.isComplete || data.session.status === "pending_review") {
        setIsReviewMode(true);
        refetchSummary();
      } else {
        refetch();
      }
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/onboarding/complete", {});
      return res.json() as Promise<{ success: boolean; derivedConfig: DerivedConfig }>;
    },
    onSuccess: (data) => {
      setCompletedConfig(data.derivedConfig);
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      onComplete?.();
    },
  });

  const updateAnswerMutation = useMutation({
    mutationFn: async ({ nodeId, answer }: { nodeId: string; answer: unknown }) => {
      const res = await apiRequest("PATCH", "/api/onboarding/answer", { nodeId, answer });
      return res.json();
    },
    onSuccess: () => {
      refetchSummary();
    },
  });

  useEffect(() => {
    if (sessionData?.session.status === "pending_review") {
      setIsReviewMode(true);
    }
  }, [sessionData]);

  if (isLoadingSession) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="loading-onboarding">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (completedConfig) {
    return (
      <Card className="max-w-2xl mx-auto" data-testid="card-onboarding-complete">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-green-500/10 p-2">
              <Check className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <CardTitle>Setup Complete</CardTitle>
              <CardDescription>Your LawnFlow AI is now configured</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Enabled Agents</p>
              <div className="flex flex-wrap gap-1">
                {completedConfig.enabledAgents.map((agent) => (
                  <Badge key={agent} variant="secondary">{agent}</Badge>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Quote Approval</p>
              <p className="font-medium">{completedConfig.approvalRules.quoteApproval}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Auto-Send Comms</p>
              <p className="font-medium">{completedConfig.automationThresholds.commsAutoSend ? "Yes" : "No"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Quote Limit</p>
              <p className="font-medium">${completedConfig.automationThresholds.quoteApprovalLimit}</p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={onComplete} className="w-full" data-testid="button-go-to-dashboard">
            Go to Dashboard
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (isReviewMode && summaryData) {
    return (
      <ReviewStep
        answers={summaryData.answers}
        onEdit={(nodeId: string, newAnswer: unknown) => {
          updateAnswerMutation.mutate({ nodeId, answer: newAnswer });
        }}
        onConfirm={() => {
          completeMutation.mutate();
        }}
        isSubmitting={completeMutation.isPending}
      />
    );
  }

  const currentNode = sessionData?.currentNode;
  const progress = sessionData?.progress || 0;

  if (!currentNode) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="no-node">
        <p className="text-muted-foreground">No onboarding flow available</p>
      </div>
    );
  }

  const handleSubmit = () => {
    if (currentNode.type === "message") {
      submitMutation.mutate({ nodeId: currentNode.id, answer: "acknowledged" });
    } else if (currentAnswer !== null) {
      submitMutation.mutate({ nodeId: currentNode.id, answer: currentAnswer });
    }
  };

  const canProceed = () => {
    if (currentNode.type === "message") return true;
    if (!currentNode.validation?.required) return true;
    if (currentAnswer === null || currentAnswer === undefined) return false;
    if (Array.isArray(currentAnswer) && currentAnswer.length === 0) return false;
    if (typeof currentAnswer === "string" && currentAnswer.trim() === "") return false;
    return true;
  };

  return (
    <Card className="max-w-2xl mx-auto" data-testid="card-onboarding-wizard">
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Badge variant="outline">{Math.round(progress)}% Complete</Badge>
          <Progress value={progress} className="flex-1 max-w-[200px]" />
        </div>
        {currentNode.type === "message" ? (
          <CardTitle>{currentNode.text}</CardTitle>
        ) : (
          <>
            <CardTitle>Setup Question</CardTitle>
            <CardDescription className="text-base">{currentNode.text}</CardDescription>
          </>
        )}
      </CardHeader>

      <CardContent>
        {currentNode.type === "question" && (
          <QuestionRenderer
            node={currentNode}
            value={currentAnswer}
            onChange={setCurrentAnswer}
          />
        )}
        {currentNode.type === "message" && (
          <p className="text-muted-foreground">
            Click Continue to begin the setup process.
          </p>
        )}
      </CardContent>

      <CardFooter className="flex justify-end gap-2">
        <Button
          onClick={handleSubmit}
          disabled={!canProceed() || submitMutation.isPending}
          data-testid="button-continue"
        >
          {submitMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : null}
          Continue
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardFooter>
    </Card>
  );
}
