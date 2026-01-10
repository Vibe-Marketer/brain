import { useCallback } from "react";
import {
  RiAddLine,
  RiDeleteBinLine,
  RiParenthesesLine,
} from "@remixicon/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

type ConditionType =
  | "field"
  | "transcript"
  | "participant"
  | "category"
  | "tag"
  | "sentiment"
  | "time"
  | "custom";

type ConditionOperator =
  | "="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "matches"
  | "not_matches"
  | "in"
  | "not_in"
  | "is_empty"
  | "is_not_empty"
  | "between";

type LogicOperator = "AND" | "OR";

interface ConditionValue {
  value?: string | number | boolean;
  values?: string[];
  min?: number;
  max?: number;
  pattern?: string;
  flags?: string;
}

interface Condition {
  id?: string;
  field?: string;
  operator?: ConditionOperator;
  value?: ConditionValue;
  condition_type?: ConditionType;
  logic_operator?: LogicOperator;
  conditions?: Condition[];
}

interface ConditionGroup {
  operator: LogicOperator;
  conditions: Condition[];
}

// ============================================================================
// Constants
// ============================================================================

const CONDITION_TYPES: Array<{ value: ConditionType; label: string; description: string }> = [
  { value: "field", label: "Call Field", description: "Match against call properties (title, duration, etc.)" },
  { value: "transcript", label: "Transcript", description: "Search within the call transcript" },
  { value: "participant", label: "Participant", description: "Match participant emails or names" },
  { value: "category", label: "Category", description: "Match the assigned category" },
  { value: "tag", label: "Tag", description: "Match assigned tags" },
  { value: "sentiment", label: "Sentiment", description: "Match sentiment analysis result" },
  { value: "time", label: "Time", description: "Match based on call time (day of week, hour)" },
];

const FIELD_OPTIONS: Array<{ value: string; label: string; type: "string" | "number" }> = [
  { value: "call.title", label: "Title", type: "string" },
  { value: "call.duration_minutes", label: "Duration (minutes)", type: "number" },
  { value: "call.participant_count", label: "Participant Count", type: "number" },
  { value: "call.summary", label: "Summary", type: "string" },
];

const TIME_FIELD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "day_of_week", label: "Day of Week" },
  { value: "hour", label: "Hour of Day" },
];

const STRING_OPERATORS: Array<{ value: ConditionOperator; label: string }> = [
  { value: "=", label: "Equals" },
  { value: "!=", label: "Does not equal" },
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Does not contain" },
  { value: "starts_with", label: "Starts with" },
  { value: "ends_with", label: "Ends with" },
  { value: "matches", label: "Matches regex" },
  { value: "is_empty", label: "Is empty" },
  { value: "is_not_empty", label: "Is not empty" },
];

const NUMBER_OPERATORS: Array<{ value: ConditionOperator; label: string }> = [
  { value: "=", label: "Equals" },
  { value: "!=", label: "Does not equal" },
  { value: ">", label: "Greater than" },
  { value: ">=", label: "Greater than or equal" },
  { value: "<", label: "Less than" },
  { value: "<=", label: "Less than or equal" },
  { value: "between", label: "Between" },
];

const SENTIMENT_VALUES = [
  { value: "positive", label: "Positive" },
  { value: "neutral", label: "Neutral" },
  { value: "negative", label: "Negative" },
];

const DAYS_OF_WEEK = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return `cond-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getOperatorsForType(conditionType: ConditionType, field?: string): Array<{ value: ConditionOperator; label: string }> {
  switch (conditionType) {
    case "field": {
      const fieldConfig = FIELD_OPTIONS.find((f) => f.value === field);
      return fieldConfig?.type === "number" ? NUMBER_OPERATORS : STRING_OPERATORS;
    }
    case "transcript":
    case "participant":
    case "category":
    case "tag":
      return STRING_OPERATORS;
    case "sentiment":
      return [
        { value: "=", label: "Equals" },
        { value: "!=", label: "Does not equal" },
      ];
    case "time":
      return NUMBER_OPERATORS;
    default:
      return STRING_OPERATORS;
  }
}

function needsValueInput(operator: ConditionOperator): boolean {
  return operator !== "is_empty" && operator !== "is_not_empty";
}

// ============================================================================
// Sub-Components
// ============================================================================

interface ConditionRowProps {
  condition: Condition;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  logicOperator: LogicOperator;
  onUpdate: (condition: Condition) => void;
  onRemove: () => void;
  onToggleLogic: () => void;
}

function ConditionRow({
  condition,
  index,
  isFirst,
  isLast,
  logicOperator,
  onUpdate,
  onRemove,
  onToggleLogic,
}: ConditionRowProps) {
  const conditionType = condition.condition_type || "field";
  const operators = getOperatorsForType(conditionType, condition.field);
  const showValue = condition.operator ? needsValueInput(condition.operator) : true;

  const handleTypeChange = (type: ConditionType) => {
    // Reset field and operator when changing type
    onUpdate({
      ...condition,
      condition_type: type,
      field: undefined,
      operator: undefined,
      value: undefined,
    });
  };

  const handleFieldChange = (field: string) => {
    onUpdate({
      ...condition,
      field,
      operator: undefined,
      value: undefined,
    });
  };

  const handleOperatorChange = (operator: ConditionOperator) => {
    onUpdate({
      ...condition,
      operator,
      value: operator === "is_empty" || operator === "is_not_empty" ? undefined : condition.value,
    });
  };

  const handleValueChange = (value: string | number) => {
    onUpdate({
      ...condition,
      value: { value },
    });
  };

  const handleBetweenChange = (min: number, max: number) => {
    onUpdate({
      ...condition,
      value: { min, max },
    });
  };

  const renderValueInput = () => {
    if (!showValue) return null;

    const operator = condition.operator;

    // Sentiment type - show dropdown
    if (conditionType === "sentiment") {
      return (
        <Select
          value={String(condition.value?.value || "")}
          onValueChange={(v) => handleValueChange(v)}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {SENTIMENT_VALUES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Time type with day_of_week - show dropdown
    if (conditionType === "time" && condition.field === "day_of_week") {
      return (
        <Select
          value={String(condition.value?.value ?? "")}
          onValueChange={(v) => handleValueChange(Number(v))}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Select day..." />
          </SelectTrigger>
          <SelectContent>
            {DAYS_OF_WEEK.map((d) => (
              <SelectItem key={d.value} value={d.value}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Between operator - show min/max inputs
    if (operator === "between") {
      return (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={condition.value?.min ?? ""}
            onChange={(e) =>
              handleBetweenChange(Number(e.target.value), condition.value?.max ?? 0)
            }
            className="w-20"
          />
          <span className="text-sm text-muted-foreground">and</span>
          <Input
            type="number"
            placeholder="Max"
            value={condition.value?.max ?? ""}
            onChange={(e) =>
              handleBetweenChange(condition.value?.min ?? 0, Number(e.target.value))
            }
            className="w-20"
          />
        </div>
      );
    }

    // Number field - show number input
    const fieldConfig = FIELD_OPTIONS.find((f) => f.value === condition.field);
    if (fieldConfig?.type === "number" || conditionType === "time") {
      return (
        <Input
          type="number"
          placeholder="Value..."
          value={condition.value?.value ?? ""}
          onChange={(e) => handleValueChange(Number(e.target.value))}
          className="w-[140px]"
        />
      );
    }

    // Default - text input
    return (
      <Input
        type="text"
        placeholder="Value..."
        value={String(condition.value?.value ?? "")}
        onChange={(e) => handleValueChange(e.target.value)}
        className="w-[180px]"
      />
    );
  };

  const renderFieldSelector = () => {
    switch (conditionType) {
      case "field":
        return (
          <Select
            value={condition.field || ""}
            onValueChange={handleFieldChange}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select field..." />
            </SelectTrigger>
            <SelectContent>
              {FIELD_OPTIONS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "time":
        return (
          <Select
            value={condition.field || ""}
            onValueChange={handleFieldChange}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select time field..." />
            </SelectTrigger>
            <SelectContent>
              {TIME_FIELD_OPTIONS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "transcript":
      case "participant":
      case "category":
      case "tag":
      case "sentiment":
        // These types don't need a field selector
        return null;

      default:
        return null;
    }
  };

  return (
    <div className="relative">
      {/* Logic operator connector - shows between conditions */}
      {!isFirst && (
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-px bg-border" />
          <button
            type="button"
            onClick={onToggleLogic}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-semibold transition-colors",
              "border-2 cursor-pointer",
              logicOperator === "AND"
                ? "bg-blue-500/10 text-blue-600 border-blue-500/30 hover:bg-blue-500/20 dark:text-blue-400"
                : "bg-orange-500/10 text-orange-600 border-orange-500/30 hover:bg-orange-500/20 dark:text-orange-400"
            )}
          >
            {logicOperator}
          </button>
          <div className="flex-1 h-px bg-border" />
        </div>
      )}

      {/* Condition row */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border/50">
        <div className="flex-1 flex flex-wrap items-center gap-2">
          {/* Condition type */}
          <Select
            value={conditionType}
            onValueChange={(v) => handleTypeChange(v as ConditionType)}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Type..." />
            </SelectTrigger>
            <SelectContent>
              {CONDITION_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Field selector (for field and time types) */}
          {renderFieldSelector()}

          {/* Operator */}
          <Select
            value={condition.operator || ""}
            onValueChange={(v) => handleOperatorChange(v as ConditionOperator)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Operator..." />
            </SelectTrigger>
            <SelectContent>
              {operators.map((op) => (
                <SelectItem key={op.value} value={op.value}>
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Value input */}
          {renderValueInput()}
        </div>

        {/* Remove button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="shrink-0 text-muted-foreground hover:text-destructive"
        >
          <RiDeleteBinLine className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface ConditionBuilderProps {
  conditions: ConditionGroup;
  onChange: (conditions: ConditionGroup) => void;
}

export function ConditionBuilder({ conditions, onChange }: ConditionBuilderProps) {
  const conditionList = conditions.conditions || [];
  const logicOperator = conditions.operator || "AND";

  const handleAddCondition = useCallback(() => {
    const newCondition: Condition = {
      id: generateId(),
      condition_type: "field",
      field: undefined,
      operator: undefined,
      value: undefined,
    };
    onChange({
      ...conditions,
      conditions: [...conditionList, newCondition],
    });
  }, [conditions, conditionList, onChange]);

  const handleUpdateCondition = useCallback(
    (index: number, updatedCondition: Condition) => {
      const newConditions = [...conditionList];
      newConditions[index] = updatedCondition;
      onChange({
        ...conditions,
        conditions: newConditions,
      });
    },
    [conditions, conditionList, onChange]
  );

  const handleRemoveCondition = useCallback(
    (index: number) => {
      const newConditions = conditionList.filter((_, i) => i !== index);
      onChange({
        ...conditions,
        conditions: newConditions,
      });
    },
    [conditions, conditionList, onChange]
  );

  const handleToggleLogic = useCallback(() => {
    onChange({
      ...conditions,
      operator: logicOperator === "AND" ? "OR" : "AND",
    });
  }, [conditions, logicOperator, onChange]);

  return (
    <div className="space-y-4">
      {/* Condition list */}
      {conditionList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center border-2 border-dashed border-border rounded-lg">
          <RiParenthesesLine className="h-8 w-8 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            No conditions added yet. Add conditions to filter when this rule runs.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={handleAddCondition} className="gap-2">
            <RiAddLine className="h-4 w-4" />
            Add Condition
          </Button>
        </div>
      ) : (
        <div className="space-y-0">
          {conditionList.map((condition, index) => (
            <ConditionRow
              key={condition.id || index}
              condition={condition}
              index={index}
              isFirst={index === 0}
              isLast={index === conditionList.length - 1}
              logicOperator={logicOperator}
              onUpdate={(updated) => handleUpdateCondition(index, updated)}
              onRemove={() => handleRemoveCondition(index)}
              onToggleLogic={handleToggleLogic}
            />
          ))}
        </div>
      )}

      {/* Add condition button (shown when there are conditions) */}
      {conditionList.length > 0 && (
        <Button type="button" variant="outline" size="sm" onClick={handleAddCondition} className="gap-2">
          <RiAddLine className="h-4 w-4" />
          Add Condition
        </Button>
      )}

      {/* Logic summary */}
      {conditionList.length > 1 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 text-sm">
          <span className="text-muted-foreground">Matching:</span>
          <span className="font-medium">
            {logicOperator === "AND" ? (
              <>
                <span className="text-blue-600 dark:text-blue-400">ALL</span> conditions must be true
              </>
            ) : (
              <>
                <span className="text-orange-600 dark:text-orange-400">ANY</span> condition can be true
              </>
            )}
          </span>
          <span className="text-muted-foreground ml-auto text-xs">
            Click the {logicOperator} button to toggle
          </span>
        </div>
      )}
    </div>
  );
}

export default ConditionBuilder;
