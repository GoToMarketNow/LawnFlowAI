import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check, Edit2, Loader2 } from "lucide-react";

interface SummaryAnswer {
  nodeId: string;
  question: string;
  answer: unknown;
}

interface ReviewStepProps {
  answers: SummaryAnswer[];
  onEdit: (nodeId: string, newAnswer: unknown) => void;
  onConfirm: () => void;
  isSubmitting: boolean;
}

export function ReviewStep({ answers, onEdit, onConfirm, isSubmitting }: ReviewStepProps) {
  const [editingAnswer, setEditingAnswer] = useState<SummaryAnswer | null>(null);
  const [editValue, setEditValue] = useState<unknown>(null);

  const handleEditClick = (answer: SummaryAnswer) => {
    setEditingAnswer(answer);
    setEditValue(answer.answer);
  };

  const handleSaveEdit = () => {
    if (editingAnswer) {
      onEdit(editingAnswer.nodeId, editValue);
      setEditingAnswer(null);
      setEditValue(null);
    }
  };

  const formatAnswer = (answer: unknown): string => {
    if (Array.isArray(answer)) {
      return answer.join(", ");
    }
    if (typeof answer === "boolean") {
      return answer ? "Yes" : "No";
    }
    if (answer === null || answer === undefined) {
      return "-";
    }
    return String(answer);
  };

  return (
    <>
      <Card className="max-w-2xl mx-auto" data-testid="card-review-step">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-primary/10 p-2">
              <Check className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Review Your Answers</CardTitle>
              <CardDescription>
                Please review your setup configuration before we activate LawnFlow AI
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {answers.map((answer) => (
            <div
              key={answer.nodeId}
              className="flex items-start justify-between gap-4 p-3 rounded-md border"
              data-testid={`review-item-${answer.nodeId}`}
            >
              <div className="flex-1 space-y-1">
                <p className="text-sm text-muted-foreground">{answer.question}</p>
                <p className="font-medium">{formatAnswer(answer.answer)}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleEditClick(answer)}
                data-testid={`button-edit-${answer.nodeId}`}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>

        <CardFooter className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground text-center">
            By confirming, LawnFlow AI will be configured with these settings. You can always adjust them later in Settings.
          </p>
          <Button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="w-full"
            data-testid="button-confirm-setup"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Confirm and Activate
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={!!editingAnswer} onOpenChange={() => setEditingAnswer(null)}>
        <DialogContent data-testid="dialog-edit-answer">
          <DialogHeader>
            <DialogTitle>Edit Answer</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">{editingAnswer?.question}</p>
            <EditInput
              value={editValue}
              onChange={setEditValue}
              originalValue={editingAnswer?.answer}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAnswer(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} data-testid="button-save-edit">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EditInput({
  value,
  onChange,
  originalValue,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
  originalValue: unknown;
}) {
  if (Array.isArray(originalValue)) {
    const currentArr = Array.isArray(value) ? value : [];
    return (
      <Textarea
        value={currentArr.join(", ")}
        onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
        placeholder="Enter values separated by commas"
        data-testid="input-edit-array"
      />
    );
  }

  if (typeof originalValue === "number") {
    return (
      <Input
        type="number"
        value={value as number || ""}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        data-testid="input-edit-number"
      />
    );
  }

  return (
    <Textarea
      value={String(value || "")}
      onChange={(e) => onChange(e.target.value)}
      data-testid="input-edit-text"
    />
  );
}
