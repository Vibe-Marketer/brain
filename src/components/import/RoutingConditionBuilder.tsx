/**
 * RoutingConditionBuilder — Sentence-like condition editor for routing rules.
 */

import { RiAddLine, RiDeleteBinLine } from '@remixicon/react';
import { cn } from '@/lib/utils';
import type { RoutingCondition } from '@/types/routing';

type ValueType = 'text' | 'number' | 'select' | 'date';

interface FieldConfig {
  value: RoutingCondition['field'];
  label: string;
  operators: string[];
  valueType: ValueType;
  options?: Array<{ value: string; label: string }>;
}

const ROUTING_CONDITION_FIELDS: FieldConfig[] = [
  {
    value: 'title',
    label: 'Title',
    operators: ['contains', 'not_contains', 'equals', 'starts_with'],
    valueType: 'text',
  },
  {
    value: 'participant',
    label: 'Participant',
    operators: ['contains', 'equals'],
    valueType: 'text',
  },
  {
    value: 'source',
    label: 'Source',
    operators: ['equals'],
    valueType: 'select',
    options: [
      { value: 'fathom', label: 'Fathom' },
      { value: 'zoom', label: 'Zoom' },
      { value: 'youtube', label: 'YouTube' },
      { value: 'file-upload', label: 'File Upload' },
    ],
  },
  {
    value: 'duration',
    label: 'Duration (min)',
    operators: ['greater_than', 'less_than'],
    valueType: 'number',
  },
  {
    value: 'tag',
    label: 'Tag',
    operators: ['equals', 'contains'],
    valueType: 'text',
  },
  {
    value: 'date',
    label: 'Date',
    operators: ['after', 'before'],
    valueType: 'date',
  },
];

const OPERATOR_LABELS: Record<string, string> = {
  contains:     'contains',
  not_contains: 'does not contain',
  equals:       'is',
  starts_with:  'starts with',
  greater_than: 'greater than',
  less_than:    'less than',
  after:        'is after',
  before:       'is before',
};

const MAX_CONDITIONS = 5;

const controlClass = cn(
  'h-8 rounded-md border border-border bg-background px-2.5 py-1',
  'text-sm text-foreground',
  'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0',
  'disabled:opacity-50 disabled:cursor-not-allowed'
);

interface RoutingConditionBuilderProps {
  conditions: RoutingCondition[];
  logicOperator: 'AND' | 'OR';
  onConditionsChange: (conditions: RoutingCondition[]) => void;
  onLogicOperatorChange: (op: 'AND' | 'OR') => void;
}

export function RoutingConditionBuilder({
  conditions,
  logicOperator,
  onConditionsChange,
  onLogicOperatorChange,
}: RoutingConditionBuilderProps) {

  function getFieldConfig(field: RoutingCondition['field']): FieldConfig {
    return ROUTING_CONDITION_FIELDS.find((f) => f.value === field) ?? ROUTING_CONDITION_FIELDS[0];
  }

  function handleFieldChange(index: number, newField: RoutingCondition['field']) {
    const fieldConfig = ROUTING_CONDITION_FIELDS.find((f) => f.value === newField)!;
    const updated = conditions.map((c, i) =>
      i === index
        ? {
            field: newField,
            operator: fieldConfig.operators[0],
            value: fieldConfig.valueType === 'select'
              ? (fieldConfig.options?.[0]?.value ?? '')
              : fieldConfig.valueType === 'number'
              ? 0
              : '',
          }
        : c
    );
    onConditionsChange(updated);
  }

  function handleOperatorChange(index: number, operator: string) {
    const updated = conditions.map((c, i) =>
      i === index ? { ...c, operator } : c
    );
    onConditionsChange(updated);
  }

  function handleValueChange(index: number, value: string | number) {
    const updated = conditions.map((c, i) =>
      i === index ? { ...c, value } : c
    );
    onConditionsChange(updated);
  }

  function handleAddCondition() {
    if (conditions.length >= MAX_CONDITIONS) return;
    const defaultField = ROUTING_CONDITION_FIELDS[0];
    onConditionsChange([
      ...conditions,
      {
        field: defaultField.value,
        operator: defaultField.operators[0],
        value: '',
      },
    ]);
  }

  function handleDeleteCondition(index: number) {
    if (conditions.length <= 1) return;
    onConditionsChange(conditions.filter((_, i) => i !== index));
  }

  function toggleLogicOperator() {
    onLogicOperatorChange(logicOperator === 'AND' ? 'OR' : 'AND');
  }

  return (
    <div className="space-y-0">
      {conditions.map((condition, index) => {
        const fieldConfig = getFieldConfig(condition.field);

        return (
          <div key={index}>
            <div className="flex items-center gap-2 py-1.5">
              <span className="text-sm text-muted-foreground w-10 shrink-0 text-right">
                {index === 0 ? 'When' : ''}
              </span>

              <select
                value={condition.field}
                onChange={(e) => handleFieldChange(index, e.target.value as RoutingCondition['field'])}
                aria-label="Condition field"
                className={cn(controlClass, 'cursor-pointer')}
              >
                {ROUTING_CONDITION_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>

              <select
                value={condition.operator}
                onChange={(e) => handleOperatorChange(index, e.target.value)}
                aria-label="Condition operator"
                className={cn(controlClass, 'cursor-pointer')}
              >
                {fieldConfig.operators.map((op) => (
                  <option key={op} value={op}>
                    {OPERATOR_LABELS[op] ?? op}
                  </option>
                ))}
              </select>

              {fieldConfig.valueType === 'select' ? (
                <select
                  value={String(condition.value)}
                  onChange={(e) => handleValueChange(index, e.target.value)}
                  aria-label="Condition value"
                  className={cn(controlClass, 'cursor-pointer flex-1')}
                >
                  {fieldConfig.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : fieldConfig.valueType === 'number' ? (
                <input
                  type="number"
                  value={condition.value === 0 ? '' : String(condition.value)}
                  onChange={(e) => handleValueChange(index, e.target.value === '' ? 0 : Number(e.target.value))}
                  placeholder="minutes"
                  min={0}
                  aria-label="Duration in minutes"
                  className={cn(controlClass, 'flex-1 min-w-0')}
                />
              ) : fieldConfig.valueType === 'date' ? (
                <input
                  type="date"
                  value={String(condition.value)}
                  onChange={(e) => handleValueChange(index, e.target.value)}
                  aria-label="Date value"
                  className={cn(controlClass, 'flex-1 min-w-0')}
                />
              ) : (
                <input
                  type="text"
                  value={String(condition.value)}
                  onChange={(e) => handleValueChange(index, e.target.value)}
                  placeholder={`Enter ${fieldConfig.label.toLowerCase()}`}
                  aria-label="Condition value"
                  className={cn(controlClass, 'flex-1 min-w-0')}
                />
              )}

              <button
                type="button"
                onClick={() => handleDeleteCondition(index)}
                disabled={conditions.length <= 1}
                aria-label="Remove condition"
                className={cn(
                  'shrink-0 flex items-center justify-center w-7 h-7 rounded-md',
                  'text-muted-foreground hover:text-destructive hover:bg-destructive/10',
                  'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'disabled:opacity-30 disabled:cursor-not-allowed'
                )}
              >
                <RiDeleteBinLine className="h-4 w-4" />
              </button>
            </div>

            {index < conditions.length - 1 && (
              <div className="flex items-center gap-2 py-1 pl-10">
                <button
                  type="button"
                  onClick={toggleLogicOperator}
                  className={cn(
                    'inline-flex items-center justify-center px-2.5 py-0.5 rounded-full',
                    'text-xs font-semibold tracking-wide',
                    'border transition-colors',
                    logicOperator === 'AND'
                      ? 'bg-brand-400/10 border-brand-400/30 text-brand-600 hover:bg-brand-400/20'
                      : 'bg-amber-400/10 border-amber-400/30 text-amber-600 hover:bg-amber-400/20'
                  )}
                >
                  {logicOperator}
                </button>
              </div>
            )}
          </div>
        );
      })}

      <div className="pt-2 pl-10">
        <button
          type="button"
          onClick={handleAddCondition}
          disabled={conditions.length >= MAX_CONDITIONS}
          className={cn(
            'inline-flex items-center gap-1.5 text-sm text-brand-600',
            'hover:text-brand-700 transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded',
            'disabled:opacity-40 disabled:cursor-not-allowed'
          )}
        >
          <RiAddLine className="h-4 w-4" />
          Add another condition
          {conditions.length >= MAX_CONDITIONS && (
            <span className="text-muted-foreground font-normal">(max {MAX_CONDITIONS})</span>
          )}
        </button>
      </div>
    </div>
  );
}
