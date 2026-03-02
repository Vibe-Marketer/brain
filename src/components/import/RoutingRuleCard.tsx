/**
 * RoutingRuleCard — Single routing rule card within the sortable list.
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { RiDraggable } from '@remixicon/react';
import { cn } from '@/lib/utils';
import type { RoutingRule, RoutingCondition } from '@/types/routing';

const FIELD_LABELS: Record<RoutingCondition['field'], string> = {
  title: 'title',
  participant: 'participant',
  source: 'source',
  duration: 'duration',
  tag: 'tag',
  date: 'date',
};

const OPERATOR_LABELS: Record<string, string> = {
  contains: 'contains',
  not_contains: "doesn't contain",
  equals: 'is',
  not_equals: 'is not',
  starts_with: 'starts with',
  greater_than: 'is greater than',
  less_than: 'is less than',
  after: 'is after',
  before: 'is before',
};

export function summarizeConditions(
  conditions: RoutingCondition[],
  logicOperator: 'AND' | 'OR'
): string {
  if (conditions.length === 0) return 'No conditions';

  const parts = conditions.map((c) => {
    const field = FIELD_LABELS[c.field] ?? c.field;
    const operator = OPERATOR_LABELS[c.operator] ?? c.operator;
    const value =
      typeof c.value === 'string' ? `"${c.value}"` : c.value;
    return `${field} ${operator} ${value}`;
  });

  const joiner = ` ${logicOperator} `;
  return `When ${parts.join(joiner)}`;
}

interface RoutingRuleCardProps {
  rule: RoutingRule;
  workspaceName?: string;
  folderName?: string;
  onEdit: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
}

export function RoutingRuleCard({
  rule,
  workspaceName,
  folderName,
  onEdit,
  onToggle,
}: RoutingRuleCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rule.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const conditionSummary = summarizeConditions(rule.conditions, rule.logic_operator);

  const destination = workspaceName
    ? folderName
      ? `${workspaceName} / ${folderName}`
      : workspaceName
    : rule.target_vault_id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3.5',
        'transition-all hover:bg-muted/20',
        !rule.enabled && 'opacity-60',
        isDragging && 'opacity-50 shadow-lg border-brand-400/40'
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label="Drag to reorder"
        className={cn(
          'shrink-0 flex items-center justify-center w-6 h-6 rounded',
          'text-muted-foreground hover:text-foreground',
          'cursor-grab active:cursor-grabbing',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'touch-none select-none'
        )}
        {...attributes}
        {...listeners}
      >
        <RiDraggable className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => onEdit(rule.id)}
        className="flex-1 min-w-0 text-left focus:outline-none"
        aria-label={`Edit rule: ${rule.name}`}
      >
        <p
          className={cn(
            'text-sm font-semibold text-foreground leading-snug',
            !rule.enabled && 'line-through'
          )}
        >
          {rule.name}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {conditionSummary}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          <span className="text-foreground/60">Route to:</span> {destination}
        </p>
      </button>

      <div
        role="none"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className="shrink-0"
      >
        <button
          type="button"
          role="switch"
          aria-checked={rule.enabled}
          aria-label={`${rule.enabled ? 'Disable' : 'Enable'} rule "${rule.name}"`}
          onClick={() => onToggle(rule.id, !rule.enabled)}
          className={cn(
            'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
            'transition-colors duration-200 ease-in-out',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            rule.enabled ? 'bg-brand-400' : 'bg-muted'
          )}
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm',
              'transform transition-transform duration-200 ease-in-out',
              rule.enabled ? 'translate-x-4' : 'translate-x-0'
            )}
          />
        </button>
      </div>
    </div>
  );
}
