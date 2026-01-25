import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface FlowOption {
  value: string;
  label: string;
  hint?: string;
}

interface FlowNode {
  id: string;
  type: "message" | "question" | "terminal";
  text: string;
  inputType?: "MULTI_SELECT" | "SINGLE_SELECT" | "TEXT" | "NUMBER" | "ZIP_LIST";
  options?: FlowOption[];
  validation?: {
    required?: boolean;
    minSelections?: number;
    maxSelections?: number;
    min?: number;
    max?: number;
  };
}

interface QuestionRendererProps {
  node: FlowNode;
  value: unknown;
  onChange: (value: unknown) => void;
}

export function QuestionRenderer({ node, value, onChange }: QuestionRendererProps) {
  switch (node.inputType) {
    case "MULTI_SELECT":
      return (
        <MultiSelectInput
          options={node.options || []}
          value={(value as string[]) || []}
          onChange={onChange}
          nodeId={node.id}
        />
      );

    case "SINGLE_SELECT":
      return (
        <SingleSelectInput
          options={node.options || []}
          value={(value as string) || ""}
          onChange={onChange}
          nodeId={node.id}
        />
      );

    case "TEXT":
      return (
        <TextInput
          value={(value as string) || ""}
          onChange={onChange}
          nodeId={node.id}
        />
      );

    case "NUMBER":
      return (
        <NumberInput
          value={(value as number) || 0}
          onChange={onChange}
          validation={node.validation}
          nodeId={node.id}
        />
      );

    case "ZIP_LIST":
      return (
        <ZipListInput
          value={(value as string) || ""}
          onChange={onChange}
          nodeId={node.id}
        />
      );

    default:
      return (
        <p className="text-muted-foreground">
          Unknown input type: {node.inputType}
        </p>
      );
  }
}

function MultiSelectInput({
  options,
  value,
  onChange,
  nodeId,
}: {
  options: FlowOption[];
  value: string[];
  onChange: (value: string[]) => void;
  nodeId: string;
}) {
  const handleToggle = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  return (
    <div className="space-y-3" data-testid={`input-multiselect-${nodeId}`}>
      {options.map((option) => (
        <div
          key={option.value}
          className="flex items-start space-x-3 p-3 rounded-md border hover-elevate cursor-pointer"
          onClick={() => handleToggle(option.value)}
        >
          <Checkbox
            id={`${nodeId}-${option.value}`}
            checked={value.includes(option.value)}
            onCheckedChange={() => handleToggle(option.value)}
            data-testid={`checkbox-${option.value}`}
          />
          <div className="space-y-1 flex-1">
            <Label
              htmlFor={`${nodeId}-${option.value}`}
              className="cursor-pointer font-medium"
            >
              {option.label}
            </Label>
            {option.hint && (
              <p className="text-sm text-muted-foreground">{option.hint}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function SingleSelectInput({
  options,
  value,
  onChange,
  nodeId,
}: {
  options: FlowOption[];
  value: string;
  onChange: (value: string) => void;
  nodeId: string;
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={onChange}
      className="space-y-3"
      data-testid={`input-singleselect-${nodeId}`}
    >
      {options.map((option) => (
        <div
          key={option.value}
          className="flex items-start space-x-3 p-3 rounded-md border hover-elevate cursor-pointer"
          onClick={() => onChange(option.value)}
        >
          <RadioGroupItem
            value={option.value}
            id={`${nodeId}-${option.value}`}
            data-testid={`radio-${option.value}`}
          />
          <div className="space-y-1 flex-1">
            <Label
              htmlFor={`${nodeId}-${option.value}`}
              className="cursor-pointer font-medium"
            >
              {option.label}
            </Label>
            {option.hint && (
              <p className="text-sm text-muted-foreground">{option.hint}</p>
            )}
          </div>
        </div>
      ))}
    </RadioGroup>
  );
}

function TextInput({
  value,
  onChange,
  nodeId,
}: {
  value: string;
  onChange: (value: string) => void;
  nodeId: string;
}) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Enter your response..."
      className="min-h-[100px]"
      data-testid={`input-text-${nodeId}`}
    />
  );
}

function NumberInput({
  value,
  onChange,
  validation,
  nodeId,
}: {
  value: number;
  onChange: (value: number) => void;
  validation?: { min?: number; max?: number };
  nodeId: string;
}) {
  return (
    <Input
      type="number"
      value={value || ""}
      onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
      min={validation?.min}
      max={validation?.max}
      className="max-w-[200px]"
      data-testid={`input-number-${nodeId}`}
    />
  );
}

function ZipListInput({
  value,
  onChange,
  nodeId,
}: {
  value: string;
  onChange: (value: string) => void;
  nodeId: string;
}) {
  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter ZIP codes separated by commas (e.g., 12345, 67890, 11223)"
        className="min-h-[80px]"
        data-testid={`input-ziplist-${nodeId}`}
      />
      <p className="text-sm text-muted-foreground">
        Enter 5-digit ZIP codes separated by commas
      </p>
    </div>
  );
}
