import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import {
  RiAlertLine,
  RiFileCopyLine,
  RiCheckLine,
} from "@remixicon/react";
import type { Template, TemplateVariableValues } from "@/types/content-library";
import {
  interpolateWithValidation,
  previewTemplate,
  validateVariables,
} from "@/lib/template-engine";
import { useContentLibraryStore } from "@/stores/contentLibraryStore";

interface TemplateVariableInputDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template | null;
  onContentGenerated?: (content: string) => void;
}

/**
 * Template Variable Input Dialog
 *
 * Displays input fields for each template variable, validates required variables,
 * shows a live preview of the interpolated content, and allows copying the final content.
 *
 * Following ManualTagDialog.tsx patterns for dialog structure.
 */
export function TemplateVariableInputDialog({
  open,
  onOpenChange,
  template,
  onContentGenerated,
}: TemplateVariableInputDialogProps) {
  // State for variable values
  const [variableValues, setVariableValues] = useState<TemplateVariableValues>({});
  const [isCopying, setIsCopying] = useState(false);
  const [copied, setCopied] = useState(false);

  // Store actions
  const incrementTemplateUsage = useContentLibraryStore(
    (state) => state.incrementTemplateUsage
  );

  // Reset state when dialog opens with a new template
  useEffect(() => {
    if (open && template) {
      // Initialize with default values from template variables
      const initialValues: TemplateVariableValues = {};
      for (const variable of template.variables) {
        if (variable.defaultValue) {
          initialValues[variable.name] = variable.defaultValue;
        } else {
          initialValues[variable.name] = "";
        }
      }
      setVariableValues(initialValues);
      setCopied(false);
    }
  }, [open, template?.id]);

  // Validate current variable values
  const validation = useMemo(() => {
    if (!template) return { missing: [], empty: [] };
    return validateVariables(template.variables, variableValues);
  }, [template, variableValues]);

  // Check if all required variables are filled
  const hasValidationErrors = validation.missing.length > 0 || validation.empty.length > 0;
  const missingVariableNames = [...validation.missing, ...validation.empty];

  // Generate preview content
  const previewContent = useMemo(() => {
    if (!template) return "";
    return previewTemplate(template.template_content, variableValues);
  }, [template, variableValues]);

  // Generate final interpolated content
  const finalContent = useMemo(() => {
    if (!template) return { content: "", missingVariables: [], hasWarnings: false };
    return interpolateWithValidation(
      template.template_content,
      variableValues,
      template.variables
    );
  }, [template, variableValues]);

  /**
   * Handle variable value change
   */
  const handleVariableChange = (name: string, value: string) => {
    setVariableValues((prev) => ({
      ...prev,
      [name]: value,
    }));
    setCopied(false);
  };

  /**
   * Handle apply button - copy final content to clipboard
   */
  const handleApply = async () => {
    if (!template || isCopying) return;

    // Don't proceed if there are validation errors
    if (hasValidationErrors) {
      toast.error("Please fill in all required variables");
      return;
    }

    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(finalContent.content);

      // Increment usage count
      await incrementTemplateUsage(template.id);

      setCopied(true);
      toast.success("Content copied to clipboard");

      // Call callback if provided
      onContentGenerated?.(finalContent.content);

      // Optionally close dialog after a short delay
      setTimeout(() => {
        onOpenChange(false);
      }, 500);
    } catch (error) {
      toast.error("Failed to copy content");
    } finally {
      setIsCopying(false);
    }
  };

  if (!template) {
    return null;
  }

  const hasVariables = template.variables.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Use Template: {template.name}</DialogTitle>
          <DialogDescription>
            {hasVariables
              ? "Fill in the variable values below to personalize your content."
              : "This template has no variables. Preview and copy the content below."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-2">
          {/* Variable Input Fields */}
          {hasVariables && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-foreground">Variables</h3>
              <div className="grid gap-4">
                {template.variables.map((variable) => {
                  const isMissing = missingVariableNames.includes(variable.name);
                  return (
                    <div key={variable.name} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor={`var-${variable.name}`}
                          className="text-sm font-mono"
                        >
                          {`{{${variable.name}}}`}
                        </Label>
                        {variable.required && (
                          <span className="text-xs text-destructive font-medium">
                            Required
                          </span>
                        )}
                      </div>
                      <Input
                        id={`var-${variable.name}`}
                        type="text"
                        placeholder={
                          variable.defaultValue
                            ? `Default: ${variable.defaultValue}`
                            : `Enter ${variable.name}...`
                        }
                        value={variableValues[variable.name] || ""}
                        onChange={(e) =>
                          handleVariableChange(variable.name, e.target.value)
                        }
                        className={
                          isMissing
                            ? "border-destructive focus:ring-destructive"
                            : ""
                        }
                      />
                      {isMissing && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <RiAlertLine className="w-3 h-3" />
                          This variable is required
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Validation Summary */}
          {hasValidationErrors && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
              <div className="flex items-center gap-2 text-destructive">
                <RiAlertLine className="w-4 h-4" />
                <span className="text-sm font-medium">Missing required variables</span>
              </div>
              <p className="text-xs text-destructive/80 mt-1">
                Please fill in: {missingVariableNames.join(", ")}
              </p>
            </div>
          )}

          {/* Preview Section */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">Preview</h3>
            <div className="bg-muted/50 rounded-md p-4 min-h-[100px] max-h-[200px] overflow-y-auto">
              <pre className="text-sm whitespace-pre-wrap font-sans text-foreground/90">
                {previewContent || (
                  <span className="text-muted-foreground italic">
                    Content preview will appear here...
                  </span>
                )}
              </pre>
            </div>
            {finalContent.hasWarnings && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <RiAlertLine className="w-3 h-3" />
                Some variables may not be filled in. Empty variables will be removed.
              </p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="hollow" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={isCopying || hasValidationErrors}
            className="min-w-[120px]"
          >
            {copied ? (
              <>
                <RiCheckLine className="w-4 h-4 mr-2" />
                Copied!
              </>
            ) : isCopying ? (
              "Copying..."
            ) : (
              <>
                <RiFileCopyLine className="w-4 h-4 mr-2" />
                Apply & Copy
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TemplateVariableInputDialog;
