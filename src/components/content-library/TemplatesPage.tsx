import { useEffect, useState } from "react";
import { useContentLibraryStore } from "@/stores/contentLibraryStore";
import {
  RiFileList3Line,
  RiAddLine,
  RiFileCopyLine,
  RiDeleteBinLine,
  RiEditLine,
  RiMailLine,
  RiChat3Line,
  RiFileTextLine,
  RiLightbulbLine,
  RiMoreLine,
  RiAlertLine,
  RiTeamLine,
  RiUserLine,
  RiShareLine,
  RiPlayLine,
} from "@remixicon/react";
import { Separator } from "@/components/ui/separator";
import { AppShell } from "@/components/layout/AppShell";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/sonner";
import { TemplateEditorDialog } from "./TemplateEditorDialog";
import { TemplateVariableInputDialog } from "./TemplateVariableInputDialog";
import type { Template, ContentType } from "@/types/content-library";

/**
 * Get icon for content type
 */
function getContentTypeIcon(type: ContentType) {
  switch (type) {
    case "email":
      return RiMailLine;
    case "social":
      return RiChat3Line;
    case "testimonial":
      return RiFileTextLine;
    case "insight":
      return RiLightbulbLine;
    case "other":
    default:
      return RiMoreLine;
  }
}

/**
 * Get badge color variant for content type
 */
function getContentTypeBadgeClass(type: ContentType): string {
  switch (type) {
    case "email":
      return "bg-info-bg text-info-text";
    case "social":
      return "bg-info-bg text-info-text";
    case "testimonial":
      return "bg-success-bg text-success-text";
    case "insight":
      return "bg-warning-bg text-warning-text";
    case "other":
    default:
      return "bg-neutral-bg text-neutral-text";
  }
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Truncate text for preview
 */
function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + "...";
}

interface TemplateCardProps {
  template: Template;
  onEdit?: (template: Template) => void;
  onUse?: (template: Template) => void;
  isShared?: boolean;
}

/**
 * Template card component with actions
 *
 * Displays template preview with use, copy, edit, and delete functionality.
 * Use button opens the variable input dialog for personalization.
 * Copy button copies raw template content to clipboard and increments usage count.
 */
function TemplateCard({ template, onEdit, onUse, isShared = false }: TemplateCardProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  const deleteTemplateItem = useContentLibraryStore((state) => state.deleteTemplateItem);
  const incrementTemplateUsage = useContentLibraryStore((state) => state.incrementTemplateUsage);

  const Icon = getContentTypeIcon(template.content_type);
  const badgeClass = getContentTypeBadgeClass(template.content_type);

  /**
   * Handle copy to clipboard
   */
  const handleCopy = async () => {
    if (isCopying) return;

    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(template.template_content);

      // Increment usage count after successful copy
      await incrementTemplateUsage(template.id);

      toast.success("Template copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy template");
    } finally {
      setIsCopying(false);
    }
  };

  /**
   * Handle delete confirmation
   */
  const handleDelete = async () => {
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      const success = await deleteTemplateItem(template.id);

      if (success) {
        toast.success("Template deleted successfully");
        setIsDeleteDialogOpen(false);
      } else {
        toast.error("Failed to delete template");
      }
    } catch (error) {
      toast.error("Failed to delete template");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow group">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
              <CardTitle className="text-base font-medium truncate">{template.name}</CardTitle>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Badge className={badgeClass} variant="outline">
                {template.content_type}
              </Badge>
              {template.is_shared && (
                <Badge variant="secondary" className="text-xs">
                  <RiShareLine className="w-3 h-3 mr-1" />
                  Shared
                </Badge>
              )}
              {/* Action buttons - visible on hover */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                {/* Use button - opens variable input dialog */}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onUse?.(template)}
                  title="Use template"
                  className="text-primary hover:text-primary"
                >
                  <RiPlayLine className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleCopy}
                  disabled={isCopying}
                  title="Copy raw template"
                >
                  <RiFileCopyLine className="w-4 h-4" />
                </Button>
                {!isShared && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onEdit?.(template)}
                      title="Edit template"
                    >
                      <RiEditLine className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setIsDeleteDialogOpen(true)}
                      disabled={isDeleting}
                      title="Delete"
                      className="hover:text-destructive"
                    >
                      <RiDeleteBinLine className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Description */}
          {template.description && (
            <p className="text-sm text-muted-foreground">
              {truncateText(template.description, 100)}
            </p>
          )}

          {/* Template content preview */}
          <div className="bg-muted/50 rounded-md p-2">
            <p className="text-xs font-mono text-muted-foreground line-clamp-3">
              {truncateText(template.template_content, 150)}
            </p>
          </div>

          {/* Variables */}
          {template.variables.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {template.variables.slice(0, 4).map((variable) => (
                <Badge key={variable.name} variant="outline" className="text-xs font-mono">
                  {`{{${variable.name}}}`}
                </Badge>
              ))}
              {template.variables.length > 4 && (
                <Badge variant="outline" className="text-xs">
                  +{template.variables.length - 4}
                </Badge>
              )}
            </div>
          )}

          {/* Footer: usage count and date */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
            <span>Used {template.usage_count} {template.usage_count === 1 ? "time" : "times"}</span>
            <span>{formatDate(template.created_at)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-destructive mb-2">
              <RiAlertLine className="h-5 w-5" />
              <AlertDialogTitle>Delete Template</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-left space-y-2">
              <p className="text-foreground">
                Are you sure you want to delete <strong>"{template.name}"</strong>?
              </p>
              <p className="text-sm text-muted-foreground">
                This action cannot be undone. The template will be permanently removed.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="hollow"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Template section component for grouping templates
 */
interface TemplateSectionProps {
  title: string;
  icon: React.ElementType;
  templates: Template[];
  emptyMessage: string;
  onEdit?: (template: Template) => void;
  onUse?: (template: Template) => void;
  isShared?: boolean;
}

function TemplateSection({ title, icon: SectionIcon, templates, emptyMessage, onEdit, onUse, isShared = false }: TemplateSectionProps) {
  if (templates.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <SectionIcon className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{title}</h2>
          <Badge variant="secondary" className="ml-2">0</Badge>
        </div>
        <p className="text-sm text-muted-foreground italic">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <SectionIcon className="w-5 h-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">{title}</h2>
        <Badge variant="secondary" className="ml-2">{templates.length}</Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onEdit={onEdit}
            onUse={onUse}
            isShared={isShared}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Templates Browser Page
 *
 * Displays all templates with loading, error, and empty states.
 * Separates personal templates from team/shared templates.
 * Following the pattern from ContentLibraryPage.tsx.
 */
export function TemplatesPage() {
  const templates = useContentLibraryStore((state) => state.templates);
  const sharedTemplates = useContentLibraryStore((state) => state.sharedTemplates);
  const isLoading = useContentLibraryStore((state) => state.templatesLoading);
  const error = useContentLibraryStore((state) => state.templatesError);
  const fetchAllTemplates = useContentLibraryStore((state) => state.fetchAllTemplates);

  // Editor dialog state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  // Variable input dialog state
  const [variableInputOpen, setVariableInputOpen] = useState(false);
  const [usingTemplate, setUsingTemplate] = useState<Template | null>(null);

  // Fetch templates on mount
  useEffect(() => {
    fetchAllTemplates();
  }, [fetchAllTemplates]);

  // Handle creating new template
  const handleNewTemplate = () => {
    setEditingTemplate(null);
    setEditorOpen(true);
  };

  // Handle editing template
  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    setEditorOpen(true);
  };

  // Handle using template (opens variable input dialog)
  const handleUseTemplate = (template: Template) => {
    setUsingTemplate(template);
    setVariableInputOpen(true);
  };

  // Handle template saved
  const handleTemplateSaved = () => {
    // Refresh templates after save
    fetchAllTemplates();
  };

  // Loading state
  if (isLoading) {
    return (
      <AppShell>
        <div className="h-full flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </AppShell>
    );
  }

  // Error state
  if (error) {
    return (
      <AppShell>
        <div className="h-full flex items-center justify-center py-20">
          <p className="text-muted-foreground">
            Failed to load templates. Please try again.
          </p>
        </div>
      </AppShell>
    );
  }

  // Total templates count
  const totalTemplates = templates.length + sharedTemplates.length;

  // Empty state - no templates at all
  if (totalTemplates === 0) {
    return (
      <AppShell>
        <div className="h-full flex flex-col overflow-hidden">
          <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-8 h-8 rounded-lg bg-vibe-orange/10 flex items-center justify-center flex-shrink-0"
                aria-hidden="true"
              >
                <RiFileList3Line className="h-4 w-4 text-vibe-orange" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-ink uppercase tracking-wide">
                  TEMPLATES
                </h2>
                <p className="text-xs text-ink-muted">
                  Create reusable templates with variable placeholders
                </p>
              </div>
            </div>
            <Button onClick={handleNewTemplate}>
              <RiAddLine className="w-4 h-4 mr-2" />
              New Template
            </Button>
          </header>

          <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-4 p-6 text-center">
            <RiFileList3Line className="w-12 h-12 text-muted-foreground" />
            <p className="text-lg text-foreground">No templates yet</p>
            <p className="text-sm text-muted-foreground">
              Create your first template to save time on repetitive content
            </p>
            <Button onClick={handleNewTemplate} className="mt-4">
              <RiAddLine className="w-4 h-4 mr-2" />
              Create Your First Template
            </Button>
          </div>

          <TemplateEditorDialog
            open={editorOpen}
            onOpenChange={setEditorOpen}
            template={editingTemplate}
            onTemplateSaved={handleTemplateSaved}
          />

          <TemplateVariableInputDialog
            open={variableInputOpen}
            onOpenChange={setVariableInputOpen}
            template={usingTemplate}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="h-full flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-8 h-8 rounded-lg bg-vibe-orange/10 flex items-center justify-center flex-shrink-0"
              aria-hidden="true"
            >
              <RiFileList3Line className="h-4 w-4 text-vibe-orange" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-ink uppercase tracking-wide">
                TEMPLATES
              </h2>
              <p className="text-xs text-ink-muted">
                {totalTemplates} {totalTemplates === 1 ? "template" : "templates"} available
              </p>
            </div>
          </div>
          <Button onClick={handleNewTemplate}>
            <RiAddLine className="w-4 h-4 mr-2" />
            New Template
          </Button>
        </header>

        <div className="flex-1 p-6 overflow-auto">
          <div className="space-y-8">
            <TemplateSection
              title="My Templates"
              icon={RiUserLine}
              templates={templates}
              emptyMessage="You haven't created any templates yet. Click 'New Template' to get started."
              onEdit={handleEditTemplate}
              onUse={handleUseTemplate}
            />

            {sharedTemplates.length > 0 && (
              <>
                <Separator />
                <TemplateSection
                  title="Team Templates"
                  icon={RiTeamLine}
                  templates={sharedTemplates}
                  emptyMessage="No shared templates from your team."
                  onUse={handleUseTemplate}
                  isShared={true}
                />
              </>
            )}
          </div>
        </div>

        <TemplateEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          template={editingTemplate}
          onTemplateSaved={handleTemplateSaved}
        />

        <TemplateVariableInputDialog
          open={variableInputOpen}
          onOpenChange={setVariableInputOpen}
          template={usingTemplate}
        />
      </div>
    </AppShell>
  );
}

export default TemplatesPage;
