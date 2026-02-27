import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import {
  RiLoader2Line,
  RiRobot2Line,
} from "@remixicon/react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import { getSafeUser } from "@/lib/auth-utils";
import { AdminModelManager } from "./AdminModelManager";
import { Label } from "@/components/ui/label";
import { useAvailableModels } from "@/components/chat/model-selector";

export default function AITab() {
  const [loading, setLoading] = useState(true);

  // Dynamic Model Loading
  const { models, defaultModel: systemDefault, isLoading: modelsLoading } = useAvailableModels();

  const [selectedModel, setSelectedModel] = useState<string>(""); // Initialize empty, set after load

  // Group models by provider
  const modelGroups = useMemo(() => {
    const groups: Record<string, typeof models> = {};
    models.forEach(model => {
      const provider = model.provider || 'Other';
      if (!groups[provider]) groups[provider] = [];
      groups[provider].push(model);
    });
    return groups;
  }, [models]);

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'ADMIN' });
      setIsAdmin(!!data);
    };
    checkAdmin();
  }, []);

  const [savedModel, setSavedModel] = useState("");
  const [modelSaving, setModelSaving] = useState(false);

  // Map legacy preset values to new ID format if needed
  const mapLegacyPreset = (preset: string): string => {
    const legacyMap: Record<string, string> = {
      'openai': 'openai/gpt-4o',
      'fast': 'openai/gpt-4o-mini',
      'quality': 'openai/gpt-4.1',
      'best': 'anthropic/claude-3-5-sonnet',
      'anthropic': 'anthropic/claude-3-5-sonnet',
      'google': 'google/gemini-2.0-flash',
      'balanced': 'openai/gpt-4o',
    };
    return legacyMap[preset] || preset;
  };

  // Load saved AI model preference on mount
  useEffect(() => {
    const loadModelPreference = async () => {
      try {
        setLoading(true);
        const { user, error: authError } = await getSafeUser();
        if (authError || !user) return;

        const { data: settings } = await supabase
          .from("user_settings")
          .select("ai_model_preset")
          .eq("user_id", user.id)
          .maybeSingle();

        if (settings?.ai_model_preset) {
          const mapped = mapLegacyPreset(settings.ai_model_preset);
          setSelectedModel(mapped);
          setSavedModel(mapped);
        }
      } catch (error) {
        logger.error("Error loading model preference", error);
      } finally {
        setLoading(false);
      }
    };
    loadModelPreference();
  }, []);

  // Sync selectedModel with systemDefault if nothing selected yet, OR if selected is invalid
  useEffect(() => {
    // 1. If nothing selected, set default
    if (!selectedModel && systemDefault) {
      setSelectedModel(systemDefault);
    }
    // 2. If selected but not in list (and list is loaded), reset to default
    else if (selectedModel && models.length > 0 && !modelsLoading) {
       const isValid = models.find(m => m.id === selectedModel);
       if (!isValid) {
         console.warn(`Selected model ${selectedModel} invalid. Resetting to default.`);
         // Prevent infinite loop if systemDefault is also somehow invalid (unlikely)
         if (systemDefault && models.find(m => m.id === systemDefault)) {
            setSelectedModel(systemDefault);
         } else if (models.length > 0) {
            setSelectedModel(models[0].id);
         }
       }
    }
  }, [selectedModel, systemDefault, models, modelsLoading]);

  // Save AI model preference
  const handleModelChange = async (newModel: string) => {
    setSelectedModel(newModel);
    setModelSaving(true);

    try {
      const { user, error: authError } = await getSafeUser();
      if (authError || !user) {
        toast.error("Not authenticated");
        setSelectedModel(savedModel);
        return;
      }

      const { error } = await supabase
        .from("user_settings")
        .upsert(
          { user_id: user.id, ai_model_preset: newModel },
          { onConflict: "user_id" }
        );

      if (error) {
        logger.error("Error saving model preference", error);
        toast.error("Failed to save model preference");
        setSelectedModel(savedModel);
      } else {
        setSavedModel(newModel);
        const modelName = models.find(m => m.id === newModel)?.name || newModel;
        toast.success(`AI model updated to ${modelName}`);
      }
    } catch (error) {
      logger.error("Error saving model preference", error);
      toast.error("Failed to save model preference");
      setSelectedModel(savedModel);
    } finally {
      setModelSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RiLoader2Line className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Get current model details for display
  const currentModelDetails = models.find(m => m.id === selectedModel);

  return (
    <div>
      <Separator className="mb-12" />

      {/* AI Model Configuration Section */}
      <div className="space-y-4 mb-12">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-gray-50">
            AI Model Configuration
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
            Choose the AI model used for metadata extraction and analysis
          </p>
        </div>

        {/* Model Selection Card */}
        <div className="relative py-6 px-6 bg-card border border-border dark:border-cb-border-dark rounded-lg">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-20 bg-vibe-orange cv-vertical-marker" />

          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-1">
              <RiRobot2Line className="h-6 w-6 text-ink-muted" />
            </div>

            <div className="flex-1 space-y-4">
            <div className="flex flex-col gap-2">
              <Label>Default Chat Model</Label>
              <Select
                value={selectedModel}
                  onValueChange={handleModelChange}
                  disabled={modelSaving || modelsLoading}
                >
                  <SelectTrigger className="w-full">
                    {modelSaving || modelsLoading ? (
                      <div className="flex items-center gap-2">
                        <RiLoader2Line className="h-4 w-4 animate-spin" />
                        <span>{modelSaving ? "Saving..." : "Loading Models..."}</span>
                      </div>
                    ) : (
                      <SelectValue placeholder="Select AI model">
                        {currentModelDetails ? (
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{currentModelDetails.name}</span>
                            <span className="text-muted-foreground">({currentModelDetails.provider})</span>
                          </div>
                        ) : (
                           selectedModel || "Select Model"
                        )}
                      </SelectValue>
                    )}
                  </SelectTrigger>
                   <SelectContent className="max-h-[400px]">
                    {Object.entries(modelGroups).map(([provider, providerModels]) => (
                      providerModels.length > 0 && (
                        <SelectGroup key={provider}>
                          <SelectLabel className="capitalize">{provider}</SelectLabel>
                          {providerModels.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{model.name}</span>
                                  {model.contextLength && (
                                    <span className="text-2xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                      {Math.round(model.contextLength / 1000)}k
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground">{model.id}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {currentModelDetails && (
                <div className="pt-3 border-t border-border dark:border-cb-border-dark">
                  <p className="text-xs text-muted-foreground">
                    <strong>Current:</strong> {currentModelDetails.name} ({currentModelDetails.provider})
                     {currentModelDetails.pricing && ` · $${currentModelDetails.pricing.prompt}/1M input`}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {isAdmin && (
        <div className="mt-12 pt-12 border-t border-border">
          <AdminModelManager />
        </div>
      )}
    </div>
  );
}
