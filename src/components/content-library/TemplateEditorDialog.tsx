import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { parseVariables, createVariableDefinitions } from "@/lib/template-engine";
import { useContentLibraryStore } from "@/stores/contentLibraryStore";
import { useBankContext } from "@/hooks/useBankContext";
import type { Template, TemplateInput, ContentType, TemplateVariable } from "@/types/content-library";
import { RiPriceTag3Line } from "@remixicon/react";

/**
 * Content type options for the template content type dropdown
 */
const CONTENT_TYPE_OPTIONS: Array<{ value: ContentType; label: string }> = [
  { value: "email", label: "Email" },
  { value: "social", label: "Social Media" },
  { value: "testimonial", label: "Testimonial" },
  { value: "insight", label: "Insight" },
  { value: "other", label: "Other" },
];

/**
 * Validation constants from spec
 */
const MAX_NAME_LENGTH = 255;
const MAX_CONTENT_LENGTH = 50000;

interface TemplateEditorDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Existing template for edit mode, null for create mode */
  template?: Template | null;
  /** Callback when template is saved/updated */
  onTemplateSaved?: (template: Template) => void;
}

/**
 * Template Editor Dialog Component
 *
 * Dialog for creating and editing templates with variable support.
 * Follows patterns from ManualTagDialog.tsx and EditFolderDialog.tsx.
 *
 * Features:
 * - Name and description inputs
 * - Template content textarea with {{variable}} syntax
 * - Auto-detection and display of template variables
 * - Content type selection
 * - Team sharing toggle (is_shared)
 * - Validation for required fields and character limits
 */
export function TemplateEditorDialog({
  open,
  onOpenChange,
  template,
  onTemplateSaved,
}: TemplateEditorDialogProps) {
  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [showDescription, setShowDescription] = useState(false);
  const [templateContent, setTemplateContent] = useState("");
  const [contentType, setContentType] = useState<ContentType>("email");
  const [isShared, setIsShared] = useState(false);
  const [saving, setSaving] = useState(false);

  // Store actions
  const saveNewTemplate = useContentLibraryStore((state) => state.saveNewTemplate);
  const { activeBankId } = useBankContext();

  // Ref for focus management
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Determine if in edit mode
  const isEditMode = !!template;

  // Parse variables from template content
  const detectedVariables = useMemo(() => {
    return parseVariables(templateContent);
  }, [templateContent]);

  // Handle focus when dialog opens
  const handleOpenAutoFocus = useCallback((event: Event) => {
    event.preventDefault();
    setTimeout(() => {
      nameInputRef.current?.focus();
      if (isEditMode) {
        nameInputRef.current?.select();
      }
    }, 0);
  }, [isEditMode]);

  // Initialize/reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (template) {
        // Edit mode - populate form with template data
        setName(template.name || "");
        setDescription(template.description || "");
        setShowDescription(!!template.description);
        setTemplateContent(template.template_content || "");
        setContentType(template.content_type || "email");
        setIsShared(template.is_shared || false);
      } else {
        // Create mode - reset form
        setName("");
        setDescription("");
        setShowDescription(false);
        setTemplateContent("");
        setContentType("email");
        setIsShared(false);
      }
    }
  }, [open, template]);

  // Validate form
  const validateForm = (): { valid: boolean; error?: string } => {
    const trimmedName = name.trim();
    const trimmedContent = templateContent.trim();

    if (!trimmedName) {
      return { valid: false, error: "Template name is required" };
    }

    if (trimmedName.length > MAX_NAME_LENGTH) {
      return { valid: false, error: `Template name must be ${MAX_NAME_LENGTH} characters or less` };
    }

    if (!trimmedContent) {
      return { valid: false, error: "Template content is required" };
    }

    if (trimmedContent.length > MAX_CONTENT_LENGTH) {
      return { valid: false, error: `Template content must be ${MAX_CONTENT_LENGTH.toLocaleString()} characters or less` };
    }

    return { valid: true };
  };

  // Check if form is valid for enabling save button
  const isFormValid = useMemo(() => {
    return name.trim().length > 0 && templateContent.trim().length > 0;
  }, [name, templateContent]);

  // Handle save
  const handleSave = async () => {
    const validation = validateForm();
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setSaving(true);
    try {
      // Create variable definitions from detected variables
      const variables: TemplateVariable[] = createVariableDefinitions(templateContent, true);

      const templateInput: TemplateInput = {
        name: name.trim(),
        description: showDescription && description.trim() ? description.trim() : null,
        template_content: templateContent.trim(),
        content_type: contentType,
        is_shared: isShared,
        variables,
      };

      if (isEditMode && template) {
        // TODO: Implement template update when updateTemplate action is added to store
        // For now, we only support creating new templates
        toast.error("Template editing is not yet implemented");
        return;
      }

      // Create new template
      const savedTemplate = await saveNewTemplate(templateInput, activeBankId);

      if (savedTemplate) {
        toast.success("Template saved successfully");
        onTemplateSaved?.(savedTemplate);
        onOpenChange(false);
      } else {
        toast.error("Failed to save template");
      }
    } catch (error) {
      logger.error("Error saving template", error);
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.metaKey && isFormValid && !saving) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={handleOpenAutoFocus}
        aria-describedby="template-editor-description"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader>
          <DialogTitle>
            {isEditMode ? "Edit Template" : "Create Template"}
          </DialogTitle>
          <DialogDescription id="template-editor-description">
            {isEditMode
              ? "Update your template. Use {{variableName}} syntax for placeholders."
              : "Create a reusable template. Use {{variableName}} syntax for placeholders that can be filled in later."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Template Name */}
          <div className="space-y-2">
            <Label htmlFor="template-name">
              Template Name <span className="text-destructive">*</span>
            </Label>
            <Input
              ref={nameInputRef}
              id="template-name"
              placeholder="e.g., Follow-up Email Template"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={MAX_NAME_LENGTH}
              className="w-full"
              aria-describedby="template-name-hint"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span id="template-name-hint">A descriptive name for your template</span>
              <span>{name.length}/{MAX_NAME_LENGTH}</span>
            </div>
          </div>

          {/* Content Type */}
          <div className="space-y-2">
            <Label htmlFor="template-content-type">
              Content Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={contentType}
              onValueChange={(value) => setContentType(value as ContentType)}
            >
              <SelectTrigger id="template-content-type" className="w-full">
                <SelectValue placeholder="Select content type" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-card">
                {CONTENT_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Optional Description */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="show-description"
                checked={showDescription}
                onCheckedChange={(checked) => setShowDescription(checked === true)}
              />
              <Label htmlFor="show-description" className="text-sm font-normal cursor-pointer">
                Add description
              </Label>
            </div>
            {showDescription && (
              <Input
                id="template-description"
                placeholder="Brief description of when to use this template"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full"
              />
            )}
          </div>

          {/* Template Content */}
          <div className="space-y-2">
            <Label htmlFor="template-content">
              Template Content <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="template-content"
              placeholder={`Write your template content here. Use {{variableName}} for placeholders.

Example:
Hi {{firstName}},

Thank you for your time on our call. As discussed, I wanted to follow up regarding {{topic}}.

Best regards,
{{senderName}}`}
              value={templateContent}
              onChange={(e) => setTemplateContent(e.target.value)}
              maxLength={MAX_CONTENT_LENGTH}
              className="min-h-[200px] font-mono text-sm"
              aria-describedby="template-content-hint"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span id="template-content-hint">
                Use {"{{variableName}}"} for dynamic placeholders
              </span>
              <span>{templateContent.length.toLocaleString()}/{MAX_CONTENT_LENGTH.toLocaleString()}</span>
            </div>
          </div>

          {/* Detected Variables */}
          {detectedVariables.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <RiPriceTag3Line className="h-4 w-4 text-muted-foreground" />
                Detected Variables ({detectedVariables.length})
              </Label>
              <div className="flex flex-wrap gap-2">
                {detectedVariables.map((variable) => (
                  <span
                    key={variable}
                    className="inline-flex items-center px-2.5 py-1 rounded-md bg-muted text-sm font-mono"
                  >
                    {`{{${variable}}}`}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                These variables will be replaced with actual values when using the template.
              </p>
            </div>
          )}

          {/* Team Sharing */}
          <div className="flex items-center gap-2 pt-2">
            <Checkbox
              id="is-shared"
              checked={isShared}
              onCheckedChange={(checked) => setIsShared(checked === true)}
            />
            <Label htmlFor="is-shared" className="text-sm font-normal cursor-pointer">
              Share with team members
            </Label>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            When enabled, team members can view and use this template.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="hollow" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !isFormValid}
          >
            {saving ? "Saving..." : isEditMode ? "Save Changes" : "Create Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TemplateEditorDialog;
